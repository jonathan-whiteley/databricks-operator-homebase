# Lakehouse Market · Homebase — deploy learnings

Everything that broke and what fixed it. Read this before re-deploying to a new workspace.

## DAB validate gotchas

| Symptom | Fix |
|---|---|
| `Error: reference does not exist: ${workspace.default_warehouse_id}` | There's no `workspace.default_warehouse_id` built-in. Add an explicit `warehouse_id` variable to `databricks.yml` and reference it as `${var.warehouse_id}` in `resources/app.yml` |
| `Error: notebook resources/notebooks/01_generate_data.py not found` | Notebook paths in `resources/jobs.yml` resolve relative to the resources folder, so use `../notebooks/01_generate_data.py` |
| `Error: expected a notebook for ... but got a file: ... is not a notebook` | The magic header `# Databricks notebook source` must be on **line 1** of every `.py` notebook, not line 2+ |
| `Warning: required field "instance_name" is not set` | The App `database` resource binding uses `instance_name` (the Lakebase instance), not `database_name` alone. Both are required when binding |
| `App deployment failed: No command to run and no Python file found` | `source_code_path: .` in `resources/app.yml` resolves to the `resources/` folder, not the bundle root. Use `source_code_path: ${workspace.file_path}` |
| Built UI directory missing in deployed bundle | `src/lakehouse_market/static/` is gitignored. DAB respects `.gitignore` by default. Add a `sync.include` block in `databricks.yml` to force-include built assets |

## Two-stage deploy is required

A single `databricks bundle deploy` will fail on a clean workspace because:

1. The App's `database` resource binding references a Lakebase instance that's still being provisioned by the same bundle apply.
2. The Model Serving endpoint references a registered model `${catalog}.${schema}.lhm_labor_recommender` that doesn't exist until notebook `02_train_labor_model.py` runs.

**Solution: deploy in two stages** (the `scripts/setup.sh` script automates this):

1. Comment out the `database:` binding on the app and the `model_serving_endpoints` block. Deploy. Run the init job. The Lakebase instance comes up + the model gets registered.
2. Uncomment both. Re-deploy. Re-deploy the app source.

## Data generation pitfalls

| Bug | Fix |
|---|---|
| `numpy.str_` from `rng.choice(...)` fails Spark Connect schema inference with `CANNOT_INFER_TYPE_FOR_FIELD` | Always wrap in `str(...)` before adding to a dict that goes through `spark.createDataFrame` |
| `daily_sales_forecast` had 1-3 dayparts per (store, date) because `dbldatagen` randomly picks dayparts | Drop dbldatagen for this table. Generate deterministically via `CROSS JOIN stores × dates × dayparts` so every (store, date) has all four |
| MLflow `log_model` failed UC registration: "Model passed for registration did not contain any signature metadata" | Add `signature=infer_signature(X, preds)` and `input_example=X.head(2)` to the `mlflow.sklearn.log_model` call |
| Reviews table shipped with placeholder `placeholder-review-N` text | Notebook 05 (`05_label_reviews.py`) needs to generate plausible review text, not just sentiment labels. We do it with a deterministic CASE statement keyed off rating + `mod(review_id, 5)` |

## App runtime config gotchas

| Symptom | Root cause | Fix |
|---|---|---|
| `MALFORMED_REQUEST: Path /sql/1.0/warehouses/ must match pattern` | `DATABRICKS_WAREHOUSE_ID` env empty in App runtime; the `sql_warehouse` resource binding doesn't auto-inject it | Set `DATABRICKS_WAREHOUSE_ID` explicitly in `app.yaml` env |
| `Provided authentication token is not a valid JWT encoding` | Lakebase Postgres uses short-lived OAuth tokens, not static passwords | Mint a fresh token per pool creation via `w.database.generate_database_credential(instance_names=[...])` (high-level SDK call, not raw httpx) |
| `Request URL is missing an 'http://' or 'https://' protocol` | `DATABRICKS_HOST` env can be empty in App runtime | Use `w.config.host` from the SDK, not `os.getenv("DATABRICKS_HOST")` |
| `No API found for 'POST /database/generate-database-credential'` | Raw API path is `/api/2.0/database/credentials` and needs a `request_id` body field + `X-Databricks-Org-Id` header | Use `w.database.generate_database_credential(...)` from the SDK; don't hand-roll the REST call |
| `permission denied for schema public` when migration runs | App SP has `CAN_CONNECT_AND_CREATE` on the DB but not CREATE on `public` | Put all app tables in a dedicated schema (we use `lhm_app`). Set asyncpg pool's `search_path = lhm_app, public` and fully-qualify INSERTs to `lhm_app.app_*` |
| `relation "app_labor_overrides" does not exist` even though migration ran | `search_path` doesn't always stick across connection acquires in asyncpg pools | Always fully-qualify INSERTs to `lhm_app.app_*` — don't rely on `search_path` |
| `invalid input for query argument $2: '2025-10-30' ('str' object has no attribute 'toordinal')` | asyncpg's DATE encoder rejects strings even if SQL has `::date` cast — bind happens before the cast | Convert `req.target_date` strings to `datetime.date.fromisoformat(...)` before passing to `conn.fetchrow()` |
| Stale session: `Invalid SessionHandle ... is closed` | Serverless Warehouse auto-stops after idle; cached SQL connection still references the dead session | Retry once after busting `get_warehouse_client.cache_clear()`. Bump the warehouse `auto_stop_mins` from the default 10 to 120 |
| Queries that filter on "today" return empty | Synthetic data has a fixed date window (e.g. ends 2025-10-30) | Use a dynamic anchor: `get_anchor_date()` queries `MAX(date) FROM daily_sales_forecast` once per process. Never hardcode the date |

## Permissions you have to grant manually

All of these need a one-time grant after the App SP is created (after the first `databricks bundle deploy`). The setup script does these automatically.

**UC catalog + schema (via SQL warehouse):**
```sql
GRANT USE CATALOG ON CATALOG ${catalog} TO `${app_sp_id}`;
GRANT USE SCHEMA  ON SCHEMA  ${catalog}.${schema} TO `${app_sp_id}`;
GRANT SELECT      ON SCHEMA  ${catalog}.${schema} TO `${app_sp_id}`;
```

**Genie space (via REST):**
```
PUT /api/2.0/permissions/genie/${space_id}
{ "access_control_list": [{"service_principal_name": "${app_sp_id}", "permission_level": "CAN_RUN"}] }
```

**Lakebase instance** is auto-granted by the App's `database` resource binding with `permission: CAN_CONNECT_AND_CREATE`.

## Genie API quirks

| Pitfall | Reality |
|---|---|
| The endpoint to start a conversation is **not** `/conversations` | It's `POST /api/2.0/genie/spaces/{id}/start-conversation` |
| `serialized_space` in create-space is a versioned proto blob | Must include `version: 2`, sorted uuid IDs in `data_sources.tables`, `instructions.text_instructions`, `instructions.example_question_sqls`, and `config.sample_questions`. See `notebooks/06_ensure_genie_space.py` for the exact shape |
| `message.content` on the start-conversation response | Is the user's prompt echoed back, **not** Genie's reply |
| Genie's actual answer lives in `attachments[].query.description` (for SQL queries) or `attachments[].text.content` (for text answers) | Pull from there. To render the data, call `GET .../attachments/{attachment_id}/query-result` |
| start-conversation often returns before Genie's done composing | Always poll `GET .../conversations/{conv}/messages/{msg}` until `status` ∈ `{COMPLETED, FAILED}` |
| The raw API response is wrapped | `{conversation, conversation_id, message, message_id}` — the message envelope lives under `.message`, not at the top level |

## Frontend / SPA gotchas

| Bug | Fix |
|---|---|
| `/labor`, `/loyalty`, etc. return 404 from FastAPI | Add a SPA fallback route in `app.py` that returns `index.html` for any non-`/api/*` path that doesn't match a literal file |
| Tailwind 4 alpha inlines `@import "tailwindcss"` ahead of other `@import` rules → "must precede other statements" warning if you import Google Fonts via CSS | Load fonts via `<link rel="stylesheet">` in `index.html` instead. Bundle the `.ttf` files locally |
| Toast notifications obscured by Leaflet map | Leaflet's map panes go up to z-index ~700. Set toast container `z-index: 9999` |
| Genie 422: "tab_id field required" | The frontend GenieChat must include `tab_id` (derived from the current route) and `store_id` in the POST body, not just `question` |
| Vite build output `src/lakehouse_market/static/` is gitignored | Add a `sync.include` block to `databricks.yml`: `sync: { include: ["src/lakehouse_market/static/**"] }` |

## Demo data: dynamic anchor

Use `sql_utils.get_anchor_date()` which queries `MAX(date) FROM daily_sales_forecast` once and caches the result for the process lifetime. Every router calls this instead of a hardcoded date. The demo continues working even months after data was generated, and re-running the init job with current dates requires zero code changes.

Override for tests/local runs: set `DEMO_ANCHOR_DATE=YYYY-MM-DD` env.

## Final deploy state (what runs in production)

```
App: lakehouse-market-homebase
├─ Resources bound:
│  ├─ warehouse-default (sql_warehouse, CAN_USE)
│  └─ homebase-db (database, instance_name=lakehouse-market-app-db, CAN_CONNECT_AND_CREATE)
├─ Env:
│  ├─ DATABRICKS_WAREHOUSE_ID, LHM_CATALOG, LHM_SCHEMA, LAKEBASE_INSTANCE,
│  │  LAKEBASE_HOST, LAKEBASE_DB, LAKEBASE_USER, GENIE_SPACE_ID,
│  │  LABOR_ENDPOINT, FM_ENDPOINT, DEMO_ANCHOR_DATE
└─ Routes:
   ├─ /api/health, /api/today/brief, /api/stores
   ├─ /api/labor/{today,recommend,override}
   ├─ /api/loyalty/{kpis,at-risk,map,offer-push,win-back}
   ├─ /api/supply/{reorder-queue,tomorrow-deliveries,release-po}
   ├─ /api/sentiment/{inbox,digest,timeline,review-action}
   ├─ /api/maintenance/{at-risk,telemetry,work-order,work-order/status}
   └─ /api/genie/ask

Lakebase: lakehouse-market-app-db (CU_1, default db `databricks_postgres`)
└─ schema lhm_app (SP-owned)
   ├─ app_labor_overrides
   ├─ app_offer_pushes
   ├─ app_purchase_orders
   ├─ app_review_responses
   └─ app_work_orders

UC: ${catalog}.lakehouse_market (21 tables read by the app)

Genie space: lhm-ops-assistant (scoped to all 21 UC tables, CAN_RUN granted to App SP)

Model Serving: lhm-labor-recommender (1 small ElasticNet, scale-to-zero)
```
