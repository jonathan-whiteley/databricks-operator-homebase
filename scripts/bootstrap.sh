#!/usr/bin/env bash
# scripts/bootstrap.sh: one-shot deploy to a fresh workspace. Idempotent.
#
# Prereqs: databricks CLI v0.230+ authenticated; uv; node >= 20; jq.
#
# Why this is not a single `databricks bundle deploy`:
#   A Databricks App `database` binding requires the Lakebase instance to already
#   be AVAILABLE at terraform-apply time. Creating the instance inside the same
#   bundle deploy races the app binding and fails ("database instance does not
#   exist"). So the instance is provisioned out of band here (idempotent, waits
#   for AVAILABLE), then the bundle deploys with the binding pointing at it.
#   Likewise the App service principal id is not known until the app deploys, so
#   the Genie CAN_RUN grant is applied here after the init job, not baked into it.
#
# Steps:
#   1. Resolve a SQL warehouse (WAREHOUSE_ID env wins) + bump auto_stop_mins
#   2. Ensure the Lakebase instance exists and is AVAILABLE (out of band)
#   3. Build the UI and `databricks bundle deploy` (app + init job)
#   4. Grant the App SP USE CATALOG / USE SCHEMA / SELECT (scripts/grants.sql)
#   5. `databricks bundle run lhm_init_job` (data gen + scoring + Genie space)
#   6. Grant the App SP CAN_RUN on the Genie space (id read from app_config)
#   7. Deploy app source, then print the URL
#
# Overrides (env): WAREHOUSE_ID, LHM_CATALOG, LHM_SCHEMA, LAKEBASE_INSTANCE,
#   LAKEBASE_CAPACITY, APP_NAME, DAB_TARGET. Anything unset falls back to the
#   matching databricks.yml variable default.
#
# Teardown: `databricks bundle destroy -t <target>` removes the app + job. The
#   Lakebase instance is NOT bundle-managed, so delete it separately if desired:
#   `databricks database delete-database-instance <name>`.
set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf "\n\033[1;34m> %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31mx %s\033[0m\n" "$*"; exit 1; }

DAB_TARGET="${DAB_TARGET:-default}"
TARGET_ARGS=(--target "$DAB_TARGET")

# Read variable defaults once from the bundle summary; env overrides win.
SUMMARY=$(databricks bundle summary "${TARGET_ARGS[@]}" -o json 2>/dev/null || echo '{}')
var_default() { jq -r ".variables.$1.value // .variables.$1.default // \"$2\"" <<<"$SUMMARY"; }

# `databricks bundle ...` commands take --target and read the profile from
# databricks.yml. Everything else (warehouses, apps, database, api, sql) is a
# plain workspace command: run from inside a bundle directory it errors with
# "please specify target" and, worse, exits 0. So resolve the target's profile
# and pass it explicitly as -p to every non-bundle CLI call via PROFILE_ARGS.
DAB_PROFILE=$(jq -r '.workspace.profile // empty' <<<"$SUMMARY")
PROFILE_ARGS=()
[[ -n "$DAB_PROFILE" ]] && PROFILE_ARGS=(-p "$DAB_PROFILE")

LHM_CATALOG="${LHM_CATALOG:-$(var_default catalog main)}"
LHM_SCHEMA="${LHM_SCHEMA:-$(var_default schema lakehouse_market)}"
LAKEBASE_INSTANCE="${LAKEBASE_INSTANCE:-$(var_default lakebase_instance lakehouse-market-app-db)}"
LAKEBASE_CAPACITY="${LAKEBASE_CAPACITY:-$(var_default lakebase_capacity CU_1)}"
APP_NAME="${APP_NAME:-$(var_default app_name lakehouse-market-homebase)}"
export LHM_CATALOG LHM_SCHEMA

# Vars passed to every deploy/run so the app, job, and binding stay consistent.
DEPLOY_VARS=(
  --var "catalog=$LHM_CATALOG"
  --var "schema=$LHM_SCHEMA"
  --var "lakebase_instance=$LAKEBASE_INSTANCE"
  --var "app_name=$APP_NAME"
)

# ---------- 1. warehouse ----------
log "Resolving SQL warehouse"
if [[ -z "${WAREHOUSE_ID:-}" ]]; then
  WAREHOUSE_ID=$(databricks warehouses list "${PROFILE_ARGS[@]}" -o json | jq -r '
    [.[] | select(.state == "RUNNING")][0].id //
    [.[] | select(.enable_serverless_compute == true)][0].id //
    .[0].id // ""')
fi
[[ -z "$WAREHOUSE_ID" ]] && fail "No SQL warehouse available in this workspace"
export WAREHOUSE_ID
DEPLOY_VARS+=(--var "warehouse_id=$WAREHOUSE_ID")
log "Using warehouse $WAREHOUSE_ID (catalog=$LHM_CATALOG schema=$LHM_SCHEMA instance=$LAKEBASE_INSTANCE)"
databricks warehouses edit "$WAREHOUSE_ID" "${PROFILE_ARGS[@]}" --auto-stop-mins 120 >/dev/null 2>&1 || true

# ---------- 2. Lakebase instance (out of band) ----------
# Note: `databricks database ...` exits 0 even on error, so never trust its exit
# code. Create it (create-database-instance blocks up to --timeout for AVAILABLE),
# then poll defensively in case the create returns before the state settles.
lakebase_state() {
  databricks database get-database-instance "$LAKEBASE_INSTANCE" "${PROFILE_ARGS[@]}" -o json 2>/dev/null | jq -r '.state // ""'
}
log "Ensuring Lakebase instance $LAKEBASE_INSTANCE is AVAILABLE"
STATE=$(lakebase_state)
if [[ -z "$STATE" ]]; then
  log "Creating Lakebase instance $LAKEBASE_INSTANCE ($LAKEBASE_CAPACITY); this can take several minutes"
  databricks database create-database-instance "$LAKEBASE_INSTANCE" --capacity "$LAKEBASE_CAPACITY" "${PROFILE_ARGS[@]}" >/dev/null 2>&1 || true
fi
# Poll up to ~20 minutes for AVAILABLE (create may return before the state settles).
for _ in $(seq 1 120); do
  STATE=$(lakebase_state)
  [[ "$STATE" == "AVAILABLE" ]] && break
  [[ -z "$STATE" ]] && STATE="(provisioning)"
  printf "  Lakebase state: %s\n" "$STATE"
  sleep 10
done
[[ "$STATE" == "AVAILABLE" ]] || fail "Lakebase instance $LAKEBASE_INSTANCE not AVAILABLE after wait (state: '${STATE:-missing}'). Check the workspace and re-run bootstrap."

# ---------- 3. build + deploy ----------
log "Building UI"
make build >/dev/null
log "Deploying bundle (app + init job)"
databricks bundle deploy "${TARGET_ARGS[@]}" "${DEPLOY_VARS[@]}"

# ---------- 4. UC grants ----------
log "Granting App SP access to $LHM_CATALOG.$LHM_SCHEMA"
APP_SP_ID=$(databricks apps get "$APP_NAME" "${PROFILE_ARGS[@]}" -o json | jq -r '.service_principal_client_id')
[[ -z "$APP_SP_ID" || "$APP_SP_ID" == "null" ]] && fail "Could not resolve App SP id"
export APP_SP_ID
envsubst < scripts/grants.sql | while IFS= read -r stmt; do
  [[ -z "$stmt" || "$stmt" == "--"* ]] && continue
  databricks api post /api/2.0/sql/statements "${PROFILE_ARGS[@]}" \
    --json "{\"statement\":$(jq -Rs <<<"$stmt"),\"warehouse_id\":\"$WAREHOUSE_ID\",\"wait_timeout\":\"30s\"}" >/dev/null \
    && echo "  ok: $stmt"
done

# ---------- 5. init job ----------
log "Running init job (data gen + scoring + Genie space)"
databricks bundle run "${TARGET_ARGS[@]}" "${DEPLOY_VARS[@]}" lhm_init_job

# ---------- 6. Genie CAN_RUN grant ----------
# The init job wrote the space id into <catalog>.<schema>.app_config. The App SP
# id is only known after the app deploys, so grant CAN_RUN here.
log "Granting App SP CAN_RUN on the Genie space"
SPACE_ID=$(databricks api post /api/2.0/sql/statements "${PROFILE_ARGS[@]}" \
  --json "{\"statement\":\"SELECT config_value FROM ${LHM_CATALOG}.${LHM_SCHEMA}.app_config WHERE config_key = 'genie_space_id'\",\"warehouse_id\":\"$WAREHOUSE_ID\",\"wait_timeout\":\"30s\"}" 2>/dev/null \
  | jq -r '.result.data_array[0][0] // ""')
if [[ -n "$SPACE_ID" ]]; then
  databricks api put "/api/2.0/permissions/genie/$SPACE_ID" "${PROFILE_ARGS[@]}" \
    --json "{\"access_control_list\":[{\"service_principal_name\":\"$APP_SP_ID\",\"permission_level\":\"CAN_RUN\"}]}" >/dev/null \
    && echo "  granted CAN_RUN on space $SPACE_ID" \
    || echo "  WARN: could not grant CAN_RUN on space $SPACE_ID (Genie tab will show 'not configured')"
else
  echo "  WARN: no genie_space_id in app_config; skipping grant (Genie tab will show 'not configured')"
fi

# ---------- 7. deploy app source + URL ----------
log "Deploying app source"
databricks bundle run "${TARGET_ARGS[@]}" "${DEPLOY_VARS[@]}" homebase

URL=$(databricks apps get "$APP_NAME" "${PROFILE_ARGS[@]}" -o json | jq -r '.url')
log "Done. App: $URL"
