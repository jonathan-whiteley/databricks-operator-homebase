# Generic, DAB-Native, Lightweight Homebase — Design

**Date:** 2026-07-27
**Goal:** Turn `lakehouse-market-e2e-DAIS-demo` into a widely reusable, generic QSR demo that any Databricks SA can stand up in their own workspace with minimal friction and few failure modes. Keep the full demo narrative (Lakebase write-back, Genie chat, UC reads, 6 modules, tour mode); shed everything that is personal, workspace-specific, or exists only to work around a resource we can remove.

---

## 1. Context & findings

- The repo is **already brand-generic**: zero references to LCE / Little Caesars / any real customer. The fiction is "Lakehouse Market," a fictional QSR. "Make generic" therefore means **scrub personal + workspace-specific values**, not de-brand a customer.
- What actually leaks and blocks reuse:
  - `app.yaml`: `LHM_CATALOG=jdub_demo`, `LABOR_ENDPOINT=dev_jonathan_whiteley_lhm-labor-recommender`, hardcoded `GENIE_SPACE_ID`, sibling-app URLs with workspace ids (`CONTRACT_RECON_URL`, `COMPUTER_VISION_URL`, `IRREGULAR_OPS_URL`).
  - `databricks.yml`: `user_email` default = `jonathan.whiteley@databricks.com`; `warehouse_id` default = a pinned id.
  - `pyproject.toml`: author = personal name/email.
  - `README.md`, `ui/src/pages/ArchitectureView.tsx`, `docs/*`: deployed workspace URL, workspace id `66306676349647`, `fe-vm-...` host, branch name, `jdub_demo`.
  - **Naming inconsistency:** `config.py` / notebook defaults use `retail_consumer_goods` / `tth_ops_homebase`; `app.yaml` uses `jdub_demo` / `lakehouse_market`. These are unified via a single source of truth (see §6: catalog `main`, schema `lakehouse_market`, defined once in `databricks.yml`).
- `scripts/setup.sh` (10 stages) is long and error-prone for two reasons that we are removing:
  - **Model Serving two-stage stash/restore** — Python edits `serving.yml`/`app.yml`, deploys, then `git checkout` restores them, because the serving endpoint references a UC model that does not exist until the init job runs.
  - **Genie id capture + `app.yaml` regex rewrite** — after notebook 06 runs, the script scrapes the new space id and rewrites env values in `app.yaml`.
- The app **already degrades gracefully** at startup: `lifespan()` wraps Lakebase migration and cache pre-warm in try/except; a missing DB or warehouse does not block boot.

### Decisions locked in (from brainstorming)
1. **Drop the Model Serving endpoint.** `/api/labor/recommend` computes in-process from the trained model's coefficients. Keep notebook 02 training + registering the model to UC (preserves the MLflow / lineage story); the app just does not call a live endpoint.
2. **Keep Lakebase**, with graceful degradation so deploy ordering never blocks deployability.
3. **Genie self-wires.** Notebook 06 creates the space, grants the App SP `CAN_RUN`, and writes the resulting `space_id` to a UC config table the app reads lazily. No hardcoded id, no post-run rewrite.
4. **Keep a slimmed bootstrap script** (`scripts/bootstrap.sh`, `make setup`) rather than forcing pure `bundle` commands — the proven warehouse/grants/Genie orchestration stays, only the fragile Model-Serving and id-rewrite machinery is removed.
5. **Delete `notebooks/standalone-labor/`** (a separate mini-demo; dead weight).

---

## 2. Deploy model — slim bootstrap (4 steps, was 10)

`make setup` → `scripts/bootstrap.sh`:

1. **Resolve warehouse** — `WAREHOUSE_ID` env wins; else first RUNNING serverless; else first available. Bump `auto_stop_mins` to 120 so the demo stays warm.
2. **`databricks bundle deploy`** — provisions the Lakebase instance + app + init job in one shot. App boots immediately; write-back activates once the instance is ready.
3. **Grant App SP** `USE CATALOG` / `USE SCHEMA` / `SELECT` on the UC scope via the proven `scripts/grants.sql` path.
4. **`databricks bundle run lhm_init_job`** — data gen + scoring + self-wiring Genie (notebook 06 creates space, grants App SP `CAN_RUN`, writes `space_id` to UC config table).

**Removed vs. old setup.sh:** the Model-Serving stash/restore Python block, the stage-2 redeploy, the `git checkout -- resources/...` mid-run, the `app.yaml` regex rewrite, and the `LABOR_ENDPOINT` dev-prefix logic. `jq` and `envsubst` may still be used for warehouse resolution + grants; that's fine and proven.

### Lakebase ordering (user preference honored)
The user prefers "instance first, then app." Because the app degrades gracefully, we support both without code hacks:
- **One-shot (default):** `databricks bundle deploy` provisions instance + app together; write buttons return a friendly "write-back not yet available" toast until the instance is ready.
- **Explicit two-phase:** documented as two `databricks bundle deploy` invocations if the user wants the instance fully up before the app binds. **Default: document the two-command sequence in the README** (no separate DAB target), since graceful degradation makes ordering optional for correctness. A dedicated `--target infra` split is explicitly out of scope unless it proves free.

---

## 3. Model Serving removal

- **Delete** `resources/serving.yml` and the `model_serving_endpoints` resource.
- **`src/lakehouse_market/routers/labor.py`** `/recommend`: replace the `invoke_serving(...)` call with an in-process computation. Notebook 02 writes the trained ElasticNet coefficients (intercept + `forecast_revenue` weight + per-daypart offsets) to a small UC table (e.g. `<catalog>.<schema>.labor_model_coefficients`); the app reads them once (cached) and computes `headcount = round(intercept + w_rev*forecast_revenue + daypart_offset)`. If the coefficients table is absent, fall back to a documented heuristic so `/recommend` never 500s.
- **Delete** `src/lakehouse_market/serving.py` and its import in `labor.py`.
- Notebook 02 keeps training + registering the model to UC (MLflow lineage) **and** additionally persists the coefficients table used by the app.
- Remove `LABOR_ENDPOINT` and `labor_endpoint` from `app.yaml` / `config.py`.

---

## 4. Genie self-wiring

- **Notebook 06** (`06_ensure_genie_space.py`), after create/PATCH:
  1. Grant the App SP `CAN_RUN` on the space via `PUT /api/2.0/permissions/genie/{space_id}` (moves this out of `setup.sh`). The App SP client id is passed as a job parameter or resolved in-notebook.
  2. Write the resolved `space_id` (and space title) to a UC config table, e.g. `<catalog>.<schema>.app_config(key STRING, value STRING)` with `key='genie_space_id'`. `MERGE`/overwrite so it's idempotent.
- **`src/lakehouse_market/config.py` / a small `app_config` reader:** if `GENIE_SPACE_ID` env is empty, lazily read it from `<catalog>.<schema>.app_config` via the warehouse (cached for the process). Env still wins if explicitly set.
- **`genie.py` router:** if no space id resolves (env empty AND config table absent/empty), the Genie panel returns a friendly "Genie space not configured yet" message instead of erroring.
- Remove the hardcoded `GENIE_SPACE_ID` from `app.yaml`.

---

## 5. Generic-ization scrub

| File | Change |
|---|---|
| `app.yaml` | **Delete the entire `env:` section** — keep only `command:`. All env moves to `resources/app.yml` `config.env`, sourced from DAB vars (§6.2). |
| `resources/app.yml` | Add `config.env` block with every env var sourced from `${var.*}`. Remove `LABOR_ENDPOINT`, `GENIE_SPACE_ID`. Sibling-app URLs default to empty (launcher hides when unset). |
| `databricks.yml` | `user_email` default removed/neutralized — bootstrap resolves it via `databricks current-user me`; `run_as` uses that. `warehouse_id` uses the existing name-lookup (`Serverless Starter Warehouse`), not a pinned id. Full var table (single source of truth) in §6.2. |
| `pyproject.toml` | author → generic (`Databricks Field Engineering`). |
| `README.md` | Remove deployed URL, workspace id `66306676349647`, `fe-vm-...` host, branch name, `jdub_demo`. Full rewrite per §7. |
| `ui/src/pages/ArchitectureView.tsx` | `jdub_demo.lakehouse_market · 21 tables …` → uses neutral catalog/schema label (or reads from `/api/meta`). |
| `docs/demo-script.md`, `docs/slides.md`, specs/plans | Scrub personal/workspace refs; keep content. |

### `/apps` launcher behavior
The `/api/meta/apps` endpoint / `AppsLanding` must **hide** any sibling app whose URL env is empty, so a fresh workspace shows a clean launcher rather than dead links.

---

## 6. Naming standardization & single-source parameterization

### 6.1 Standard catalog/schema
Use **one** neutral pair everywhere (`config.py` fallback defaults, `databricks.yml` var defaults, notebooks, README, ArchitectureView):

- **Catalog default:** `main` (the conventional Unity Catalog default catalog present in most workspaces, so a fresh deploy has a sensible target). Deployer overrides with one `--var catalog=...`.
- **Schema default:** `lakehouse_market`

All references currently using `jdub_demo` / `retail_consumer_goods` (catalog) or `tth_ops_homebase` (schema) are updated to match.

### 6.2 Single source of truth (verified against DAB schema v0.299)
Goal: a deployer changes **only `databricks.yml` variable defaults** (or `--var` flags) to retarget the whole demo — nothing else.

**This is achievable natively.** Verified against `databricks bundle schema`: the DAB **App resource supports an inline `config.env` block** (`resources.AppConfig` → `env` → list of `{name, value, value_from}`), and each `value` is a string that resolves `${var.*}` substitutions. Therefore:

- **Delete the entire `env:` section from `app.yaml`.** `app.yaml` keeps only the `command:` block (how uvicorn boots). The Apps runtime merges env from the resource's `config.env`.
- **Define all env once in `resources/app.yml`** under `apps.homebase.config.env`, every value sourced from a `${var.*}`:
  ```yaml
  config:
    env:
      - name: LHM_CATALOG
        value: ${var.catalog}
      - name: LHM_SCHEMA
        value: ${var.schema}
      - name: DEMO_ANCHOR_DATE
        value: ${var.demo_anchor_date}
      - name: LHM_QUERY_CACHE_TTL
        value: ${var.query_cache_ttl}
      # sibling-app launcher URLs — default empty, hidden when unset
      - name: CONTRACT_RECON_URL
        value: ${var.contract_recon_url}
      - name: COMPUTER_VISION_URL
        value: ${var.computer_vision_url}
      - name: IRREGULAR_OPS_URL
        value: ${var.irregular_ops_url}
      - name: LAKEBASE_INSTANCE
        value: ${var.lakebase_instance}
      - name: LAKEBASE_DB
        value: ${var.lakebase_db}
      # warehouse id + Lakebase creds still injected via `value_from` resource bindings
  ```
  `DATABRICKS_WAREHOUSE_ID` continues to use `value_from: warehouse-default` (the sql_warehouse binding); Lakebase `PGHOST/PGUSER/PGPASSWORD` continue to be injected by the `homebase-db` database binding. `GENIE_SPACE_ID` and `LABOR_ENDPOINT` are **removed** (Genie self-wires via UC config table §4; Model Serving is gone §3).
- **`config.py`** keeps env-var reads with the standard defaults (§6.1) as a **safety net for local dev only** (where there's no DAB). In a deployed app the values always come from `config.env`. This is not a second source of truth — it's a fallback, and the defaults match the DAB var defaults so behavior is identical either way.

**DAB variables in `databricks.yml`** (the one place to edit):

| Var | Default | Used by |
|---|---|---|
| `catalog` | `main` | app config.env, notebooks, grants |
| `schema` | `lakehouse_market` | app config.env, notebooks, grants |
| `app_name` | `lakehouse-market-homebase` | resources/app.yml |
| `warehouse_id` | lookup by name `Serverless Starter Warehouse` (not a pinned id) | app binding, jobs |
| `lakebase_instance` | `lakehouse-market-app-db` | resources/lakebase.yml, app binding + config.env |
| `lakebase_db` | `databricks_postgres` | app config.env |
| `lakebase_capacity` | `CU_1` | resources/lakebase.yml |
| `demo_anchor_date` | `2025-10-30` | app config.env |
| `query_cache_ttl` | `86400` | app config.env |
| `genie_space_title` | `lhm-ops-assistant` | notebook 06 param |
| `contract_recon_url` | `""` | app config.env (launcher hides if empty) |
| `computer_vision_url` | `""` | app config.env |
| `irregular_ops_url` | `""` | app config.env |

`user_email` is **removed as a hardcoded default**; `run_as`/deployer identity resolves from `databricks current-user me` in the bootstrap (supplied via `--var user_email=$(...)` if DAB requires it), not committed.

**Net result:** retargeting to any workspace = edit `databricks.yml` var defaults (or pass `--var`). `app.yaml` has no environment-specific content at all.

---

## 7. README rewrite (punchy)

Target: scannable in under a minute. Sections:

1. **Title + one-liner** — what it is (store-manager ops console for a fictional QSR, end-to-end on Databricks).
2. **Screenshot/really-short module list** — Today / Labor / Inventory / Equipment / Loyalty / Feedback.
3. **Architecture** — the existing 4-line ASCII sketch (UI → FastAPI → UC / Lakebase / Genie). No workspace-specific detail.
4. **Quick Start** — prereqs (databricks CLI, uv, node ≥ 20, jq) + the bootstrap:
   ```bash
   make setup            # warehouse + deploy + grants + init (data + Genie)
   ```
   plus the one-line redeploy for UI-only changes.
5. **Local dev** — `make install`, `.env`, `make dev`, `make test`.
6. **What's inside** — brief table of modules + where writes land.
7. **What's intentionally not here** — synthetic data, App SP auth, desktop-only, demo-grade ML.

Move the deep material out of the README into `docs/` and link it:
- "How writes work", "How Genie works", full troubleshooting matrix, data-domain table, tour internals → `docs/architecture.md` (new) or existing `docs/learnings.md`.

---

## 8. Slimming (YAGNI)

- **Delete `notebooks/standalone-labor/`** — separate mini-demo (own README, Genie space, table loader). Confirmed for removal.
- **Delete `scripts/setup.sh`'s removed stages** — replaced by slim `scripts/bootstrap.sh`. Keep `scripts/grants.sql`.
- **Keep** all 6 modules, tour mode, tests, Genie, `docs/slides.md` + `docs/demo-script.md` (scrubbed) — these are demo impact, not deploy cost.

---

## 9. Non-goals / out of scope

- No new modules or UI features.
- No multi-brand theming (the theme seam stays; only one brand ships).
- No change to the synthetic data model / 21-table schema (only the catalog/schema *names* standardize).
- No production auth / PII / mobile.

---

## 10. Success criteria

1. `git grep -niE "jonathan|jdub|whiteley|66306676349647|fe-vm|little.?caesar|lce"` over shipping files (`app.yaml`, `databricks.yml`, `pyproject.toml`, `src/**`, `ui/src/**`) returns **zero** hits (docs may retain scrubbed generic references only).
   Additionally, retargeting catalog/schema (or any env) requires editing **only `databricks.yml` var defaults** (or passing `--var`) — `app.yaml` has no environment-specific content, so no other file edits.
2. On a fresh workspace, `make setup` deploys the app to `RUNNING` with **no manual file edits** and **no two-stage stash/restore**.
3. App boots and all read tabs work even if Lakebase/Genie aren't ready yet; write + Genie surfaces degrade with friendly messages, then light up once the init job + instance are ready.
4. `/api/labor/recommend` returns a headcount with **no** Model Serving endpoint deployed.
5. README Quick Start is the bootstrap command + prereqs, and the deep material lives in `docs/` behind links.
6. `make test` passes (tests updated for the serving removal + Genie config-table read).
