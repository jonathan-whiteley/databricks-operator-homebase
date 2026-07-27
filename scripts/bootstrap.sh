#!/usr/bin/env bash
# scripts/bootstrap.sh — one-shot deploy to a fresh workspace. Idempotent.
#
# Prereqs: databricks CLI v0.230+ authenticated; uv; node >= 20; jq.
#
# Steps:
#   1. Resolve a SQL warehouse (WAREHOUSE_ID env wins) + bump auto_stop_mins
#   2. Build the UI and `databricks bundle deploy` (app + Lakebase + init job)
#   3. Grant the App SP USE CATALOG / USE SCHEMA / SELECT (scripts/grants.sql)
#   4. `databricks bundle run lhm_init_job` (data gen + scoring + self-wiring Genie)
set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf "\n\033[1;34m> %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31mx %s\033[0m\n" "$*"; exit 1; }

DAB_TARGET="${DAB_TARGET:-default}"
TARGET_ARGS=(--target "$DAB_TARGET")

# Export as LHM_CATALOG / LHM_SCHEMA so both `--var` and grants.sql (envsubst) see them.
LHM_CATALOG="${LHM_CATALOG:-$(databricks bundle summary "${TARGET_ARGS[@]}" -o json 2>/dev/null | jq -r '.variables.catalog.value // .variables.catalog.default // "main"')}"
LHM_SCHEMA="${LHM_SCHEMA:-$(databricks bundle summary "${TARGET_ARGS[@]}" -o json 2>/dev/null | jq -r '.variables.schema.value // .variables.schema.default // "lakehouse_market"')}"
export LHM_CATALOG LHM_SCHEMA

# 1. warehouse
log "Resolving SQL warehouse"
if [[ -z "${WAREHOUSE_ID:-}" ]]; then
  WAREHOUSE_ID=$(databricks warehouses list "${TARGET_ARGS[@]}" -o json | jq -r '
    [.[] | select(.state == "RUNNING")][0].id //
    [.[] | select(.enable_serverless_compute == true)][0].id //
    .[0].id // ""')
fi
[[ -z "$WAREHOUSE_ID" ]] && fail "No SQL warehouse available in this workspace"
export WAREHOUSE_ID
log "Using warehouse $WAREHOUSE_ID (catalog=$LHM_CATALOG schema=$LHM_SCHEMA)"
databricks warehouses edit "$WAREHOUSE_ID" "${TARGET_ARGS[@]}" --auto-stop-mins 120 >/dev/null 2>&1 || true

# 2. build + deploy
log "Building UI"
make build >/dev/null
log "Deploying bundle (app + Lakebase instance + init job)"
databricks bundle deploy "${TARGET_ARGS[@]}" \
  --var "warehouse_id=$WAREHOUSE_ID" --var "catalog=$LHM_CATALOG" --var "schema=$LHM_SCHEMA" \
  --var "user_email=$(databricks current-user me "${TARGET_ARGS[@]}" -o json | jq -r '.userName')"

# 3. grants
log "Granting App SP access to $LHM_CATALOG.$LHM_SCHEMA"
APP_NAME=$(databricks bundle summary "${TARGET_ARGS[@]}" -o json | jq -r '.resources.apps.homebase.name // "lakehouse-market-homebase"')
APP_SP_ID=$(databricks apps get "$APP_NAME" "${TARGET_ARGS[@]}" -o json | jq -r '.service_principal_client_id')
[[ -z "$APP_SP_ID" || "$APP_SP_ID" == "null" ]] && fail "Could not resolve App SP id"
export APP_SP_ID
envsubst < scripts/grants.sql | while IFS= read -r stmt; do
  [[ -z "$stmt" || "$stmt" == "--"* ]] && continue
  databricks api post /api/2.0/sql/statements "${TARGET_ARGS[@]}" \
    --json "{\"statement\":$(jq -Rs <<<"$stmt"),\"warehouse_id\":\"$WAREHOUSE_ID\",\"wait_timeout\":\"30s\"}" >/dev/null \
    && echo "  ok: $stmt"
done

# 4. init job (data gen + scoring + self-wiring Genie; pass App SP for CAN_RUN grant)
log "Running init job (data gen + scoring + Genie space)"
databricks bundle run "${TARGET_ARGS[@]}" lhm_init_job --var "app_sp_id=$APP_SP_ID"

URL=$(databricks apps get "$APP_NAME" "${TARGET_ARGS[@]}" -o json | jq -r '.url')
log "Done. App: $URL"
