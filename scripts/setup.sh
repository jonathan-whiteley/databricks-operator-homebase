#!/usr/bin/env bash
# scripts/setup.sh
#
# One-shot deploy to a fresh workspace. Idempotent: safe to re-run.
#
# Prereqs:
#   - databricks CLI v0.230+ authenticated to the target workspace
#       (`databricks auth login` if needed)
#   - uv, node ≥ 20, jq
#
# What it does, in order:
#   1. Picks a SQL warehouse (env WAREHOUSE_ID wins; otherwise first running
#      Serverless warehouse; otherwise first available)
#   2. Builds the UI (`make build`)
#   3. Validates + deploys the bundle WITHOUT the Lakebase binding and Model
#      Serving endpoint (Stage 1) so the App SP gets created
#   4. Grants the App SP USE CATALOG / USE SCHEMA / SELECT on the UC scope
#   5. Bumps the warehouse auto_stop_mins to 120 so the demo doesn't go cold
#   6. Runs the init job (5 notebooks: data gen + ML training + scoring + Genie space)
#   7. Captures the Genie space id and grants the App SP CAN_RUN on it
#   8. Uncomments the Lakebase binding + Serving endpoint and re-deploys (Stage 2)
#   9. Re-deploys the app source so it picks up the new env vars
#  10. Tails the app status until RUNNING and prints the URL
#
# Usage:
#   scripts/setup.sh                            # default DAB target, default catalog/schema
#   DAB_TARGET=dais scripts/setup.sh            # deploy to the `dais` DAB target
#   LHM_CATALOG=foo LHM_SCHEMA=bar scripts/setup.sh   # override catalog/schema
#   WAREHOUSE_ID=abc scripts/setup.sh           # pin a specific warehouse

set -euo pipefail

cd "$(dirname "$0")/.."

# ---------- helpers ----------
log() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m✗ %s\033[0m\n" "$*"; exit 1; }

# ---------- 0. target + catalog/schema ----------
DAB_TARGET="${DAB_TARGET:-default}"
TARGET_ARGS=(--target "$DAB_TARGET")

# Resolve the CLI profile for raw `databricks` commands (anything outside `databricks bundle`).
# `databricks bundle` reads the target's workspace.profile from databricks.yml directly; everything
# else (warehouses list, apps get, sql/statements, genie list-spaces, etc.) honours $DATABRICKS_CONFIG_PROFILE.
DAB_PROFILE=$(databricks bundle summary --target "$DAB_TARGET" -o json 2>/dev/null \
  | jq -r '.workspace.profile // empty' 2>/dev/null || true)
if [[ -n "$DAB_PROFILE" ]]; then
  export DATABRICKS_CONFIG_PROFILE="$DAB_PROFILE"
  log "Using CLI profile: $DAB_PROFILE"
fi

# Target mode (development vs production) controls dev_user_ prefixing of serving endpoints.
TARGET_MODE=$(databricks bundle summary --target "$DAB_TARGET" -o json 2>/dev/null \
  | jq -r '.bundle.mode // "development"' 2>/dev/null || echo "development")

# Catalog/schema resolution: env wins; else read DAB var defaults for this target.
if [[ -z "${LHM_CATALOG:-}" ]]; then
  LHM_CATALOG=$(databricks bundle summary --target "$DAB_TARGET" -o json 2>/dev/null \
    | jq -r '.variables.catalog.value // .variables.catalog.default // "retail_consumer_goods"' || echo "retail_consumer_goods")
fi
if [[ -z "${LHM_SCHEMA:-}" ]]; then
  LHM_SCHEMA=$(databricks bundle summary --target "$DAB_TARGET" -o json 2>/dev/null \
    | jq -r '.variables.schema.value // .variables.schema.default // "tth_ops_homebase"' || echo "tth_ops_homebase")
fi
export LHM_CATALOG LHM_SCHEMA
log "Target: $DAB_TARGET ($TARGET_MODE) · catalog=$LHM_CATALOG · schema=$LHM_SCHEMA"

# ---------- 1. warehouse ----------
log "Resolving SQL warehouse"
if [[ -z "${WAREHOUSE_ID:-}" ]]; then
  WAREHOUSE_ID=$(databricks warehouses list -o json | jq -r '
    [.[] | select(.state == "RUNNING")][0].id //
    [.[] | select(.enable_serverless_compute == true)][0].id //
    .[0].id // ""')
fi
[[ -z "$WAREHOUSE_ID" ]] && fail "No SQL warehouse available in this workspace"
log "Using warehouse: $WAREHOUSE_ID"
export WAREHOUSE_ID

# Bump auto-stop so demos don't go cold mid-walkthrough
databricks warehouses edit "$WAREHOUSE_ID" --auto-stop-mins 120 > /dev/null 2>&1 || \
  warn "Could not bump auto_stop_mins on the warehouse"

# ---------- 2. build ----------
log "Building UI"
make build > /dev/null

# ---------- 3. stage-1 deploy ----------
log "Stage 1 deploy — App + Lakebase instance + Init job (no DB binding, no Serving endpoint)"

# Temporarily stash the Lakebase binding + Serving endpoint.
# Stage 1 deploys WITHOUT the homebase-db resource binding (the Lakebase instance
# doesn't exist yet) and WITHOUT the serving endpoint (the registered model
# doesn't exist yet). Stage 2 restores both from git and re-deploys.
python3 - <<'PY'
import pathlib
app_yml = pathlib.Path("resources/app.yml")
srv_yml = pathlib.Path("resources/serving.yml")

# Drop the entire homebase-db list item from the App's resources block.
# Item starts with `        - name: homebase-db` and continues for all lines
# that are indented MORE than 8 spaces (i.e. continuation lines of the item).
out_lines = []
in_db_item = False
for line in app_yml.read_text().splitlines():
    stripped = line.lstrip()
    if line == "        - name: homebase-db":
        in_db_item = True
        continue
    if in_db_item:
        # Continuation lines start with 10+ spaces; the item ends when we hit
        # the next list item (8 spaces + dash) or a shallower YAML key.
        if line.startswith("          ") or stripped == "":
            continue
        in_db_item = False
    out_lines.append(line)
app_yml.write_text("\n".join(out_lines) + "\n")

# Strip the serving endpoint to a no-op (entity_name references a UC model
# that doesn't exist until the init job runs).
srv_yml.write_text("resources: {}\n")
PY

databricks bundle deploy "${TARGET_ARGS[@]}" \
  --var "warehouse_id=$WAREHOUSE_ID" \
  --var "catalog=$LHM_CATALOG" \
  --var "schema=$LHM_SCHEMA"

# ---------- 4. grants ----------
log "Granting App SP access to UC catalog + schema"
APP_NAME=$(databricks bundle summary "${TARGET_ARGS[@]}" -o json | jq -r '.resources.apps.homebase.name // "lakehouse-market-homebase"')
APP_SP_ID=$(databricks apps get "$APP_NAME" -o json | jq -r '.service_principal_client_id')
[[ -z "$APP_SP_ID" || "$APP_SP_ID" == "null" ]] && fail "Could not resolve App SP id"
log "App: $APP_NAME · SP: $APP_SP_ID"
export APP_SP_ID

envsubst < scripts/grants.sql > /tmp/lhm_grants.sql
cat /tmp/lhm_grants.sql | while IFS= read -r stmt; do
  [[ -z "$stmt" || "$stmt" == "--"* ]] && continue
  databricks api post /api/2.0/sql/statements \
    --json "{\"statement\":$(jq -Rs <<<"$stmt"),\"warehouse_id\":\"$WAREHOUSE_ID\",\"wait_timeout\":\"30s\"}" \
    > /dev/null && echo "  ✓ $stmt"
done

# ---------- 5. init job ----------
log "Running init job (data gen + ML training + scoring + Genie space)"
databricks bundle run "${TARGET_ARGS[@]}" lhm_init_job

# ---------- 6. capture Genie space id ----------
log "Resolving Genie space id"
SPACE_ID=$(databricks genie list-spaces -o json | jq -r '
  if type == "array" then .[] else .spaces[] end |
  select(.title == "lhm-ops-assistant") | .space_id' | head -1)
[[ -z "$SPACE_ID" ]] && fail "Could not find Genie space 'lhm-ops-assistant'"
log "Genie space: $SPACE_ID"

databricks api put "/api/2.0/permissions/genie/$SPACE_ID" \
  --json "{\"access_control_list\":[{\"service_principal_name\":\"$APP_SP_ID\",\"permission_level\":\"CAN_RUN\"}]}" \
  > /dev/null
log "Granted App SP CAN_RUN on Genie space"

# ---------- 7. stage-2 deploy ----------
log "Stage 2 deploy — re-enable Lakebase binding + Serving endpoint"

# Restore the stashed files from git so we re-deploy the canonical version
git checkout -- resources/app.yml resources/serving.yml

# Plug in the resolved Genie space id; dev-prefix the serving endpoint only when
# the target is in development mode (DAB strips the prefix in production targets).
DAB_TARGET="$DAB_TARGET" TARGET_MODE="$TARGET_MODE" SPACE_ID="$SPACE_ID" python3 - <<'PY'
import os, pathlib, re

target_mode = os.environ.get("TARGET_MODE", "development")
space_id = os.environ.get("SPACE_ID", "")
app_yaml = pathlib.Path("app.yaml")
text = app_yaml.read_text()

# Update GENIE_SPACE_ID value (matches the empty default or any prior value).
text = re.sub(
    r'^(\s*-\s*name:\s*GENIE_SPACE_ID\s*\n(?:\s*#[^\n]*\n)?\s*value:\s*)"[^"]*"',
    rf'\g<1>"{space_id}"',
    text,
    flags=re.MULTILINE,
)

# Update LABOR_ENDPOINT value based on target mode.
if target_mode == "development":
    import subprocess, json
    out = subprocess.check_output(["databricks", "current-user", "me", "-o", "json"])
    user_email = json.loads(out).get("userName", "")
    user_prefix = user_email.split("@")[0].replace(".", "_").replace("-", "_")
    endpoint = f"dev_{user_prefix}_lhm-labor-recommender"
else:
    endpoint = "lhm-labor-recommender"

text = re.sub(
    r'^(\s*-\s*name:\s*LABOR_ENDPOINT\s*\n(?:\s*#[^\n]*\n)*\s*value:\s*).*$',
    rf'\g<1>{endpoint}',
    text,
    flags=re.MULTILINE,
)
app_yaml.write_text(text)
print(f"app.yaml updated: GENIE_SPACE_ID={space_id}  LABOR_ENDPOINT={endpoint}")
PY

databricks bundle deploy "${TARGET_ARGS[@]}" \
  --var "warehouse_id=$WAREHOUSE_ID" \
  --var "catalog=$LHM_CATALOG" \
  --var "schema=$LHM_SCHEMA"

# ---------- 8. app source restart ----------
log "Re-deploying app source"
databricks bundle run "${TARGET_ARGS[@]}" homebase

# ---------- 9. wait for ready + URL ----------
log "Waiting for app to reach RUNNING"
for i in {1..30}; do
  s=$(databricks apps get "$APP_NAME" -o json | jq -r '.app_status.state // "?"')
  if [[ "$s" == "RUNNING" ]]; then break; fi
  echo "  ($s)"
  sleep 6
done
URL=$(databricks apps get "$APP_NAME" -o json | jq -r '.url')
log "App is live: $URL"
