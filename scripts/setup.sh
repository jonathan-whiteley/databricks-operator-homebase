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
#   scripts/setup.sh                 # full deploy
#   WAREHOUSE_ID=abc scripts/setup.sh  # pin a specific warehouse

set -euo pipefail

cd "$(dirname "$0")/.."

# ---------- helpers ----------
log() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m✗ %s\033[0m\n" "$*"; exit 1; }

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

# Temporarily stash the Lakebase binding + Serving endpoint
python3 - <<'PY'
import re, pathlib
app_yml = pathlib.Path("resources/app.yml")
srv_yml = pathlib.Path("resources/serving.yml")
# Comment out the database binding block
text = app_yml.read_text()
text = re.sub(r"^(        - name: homebase-db.*?(?=\n        - |\n      |\Z))",
              lambda m: "\n".join("        # " + l.lstrip() for l in m.group(0).splitlines()),
              text, flags=re.MULTILINE | re.DOTALL)
app_yml.write_text(text)
# Strip the serving endpoint to a no-op
srv_yml.write_text("resources: {}\n")
PY

databricks bundle deploy --var "warehouse_id=$WAREHOUSE_ID"

# ---------- 4. grants ----------
log "Granting App SP access to UC catalog + schema"
APP_SP_ID=$(databricks apps get lakehouse-market-homebase -o json | jq -r '.service_principal_client_id')
[[ -z "$APP_SP_ID" || "$APP_SP_ID" == "null" ]] && fail "Could not resolve App SP id"
log "App SP: $APP_SP_ID"
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
databricks bundle run lhm_init_job

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

# Plug in the right Genie space + dev-prefixed serving endpoint name
python3 - <<PY
import pathlib, re
app_yaml = pathlib.Path("app.yaml")
text = app_yaml.read_text()
text = re.sub(r"^(\s*-\s*name:\s*GENIE_SPACE_ID\s*\n\s*#[^\n]*\n\s*value:\s*\")[^\"]*(\")",
              r"\g<1>$SPACE_ID\g<2>", text, flags=re.MULTILINE)
# Dev-mode serving prefix (only if target is in dev mode)
user_email = "$(databricks current-user me -o json | jq -r .userName)"
user_prefix = user_email.split("@")[0].replace(".", "_").replace("-", "_")
text = re.sub(r"^(\s*-\s*name:\s*LABOR_ENDPOINT\s*\n\s*#[^\n]*\n\s*value:\s*)[^\n]+",
              rf"\g<1>dev_{user_prefix}_lhm-labor-recommender", text, flags=re.MULTILINE)
app_yaml.write_text(text)
PY

databricks bundle deploy --var "warehouse_id=$WAREHOUSE_ID"

# ---------- 8. app source restart ----------
log "Re-deploying app source"
databricks bundle run homebase

# ---------- 9. wait for ready + URL ----------
log "Waiting for app to reach RUNNING"
for i in {1..30}; do
  s=$(databricks apps get lakehouse-market-homebase -o json | jq -r '.app_status.state // "?"')
  if [[ "$s" == "RUNNING" ]]; then break; fi
  echo "  ($s)"
  sleep 6
done
URL=$(databricks apps get lakehouse-market-homebase -o json | jq -r '.url')
log "App is live: $URL"
