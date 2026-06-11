# Labor Genie · standalone demo — design

**Date**: 2026-06-11
**Owner**: jonathan.whiteley@databricks.com
**Target workspace**: https://adb-2548836972759138.18.azuredatabricks.net (logfood)
**Target schema**: `home_jonathan_whiteley.demos`
**Status**: design approved, plan pending

## 1. Goal

Stand up a focused, demo-quality Genie space scoped to the **Labor** subset of the Lakehouse Market dataset, in a brand-new workspace + schema, **without** re-running the full 5-notebook pipeline or deploying the app. Output: 4 tables and one robust Genie space.

## 2. Non-goals

- No Lakebase, no Model Serving, no Databricks App.
- No data for Loyalty, Supply, Sentiment, or Maintenance domains.
- No DAB bundle, no `resources/*.yml`, no `databricks.yml` — purely two notebooks.
- No automated cross-workspace data copy; we regenerate from synthetic seed.

## 3. Why Labor (not the full 21-table space)

The parent design doc (`2026-05-30-lakehouse-market-demo-design.md` §11) explicitly flagged the risk that Genie answer quality may degrade with 21 tables in one space and proposed splitting into 5 smaller spaces as the fallback. Of the 5 domains, Labor is the strongest candidate for a *simple* standalone Genie because:

- Smallest table count (3 + `stores` = 4).
- Cleanest fact shape: store × date × daypart for forecasts, store × hour for actuals.
- Forecast-vs-actuals is the canonical Genie question (compare two tables on the same grain), needs zero ML to land.
- Most universally understood narrative for a Bay-Area QSR-themed DAIS audience.

## 4. Scope

### 4.1 Tables (4 total) materialized into `home_jonathan_whiteley.demos`

| Table | Grain | Rows (approx) | Source |
|---|---|---|---|
| `stores` | one row per store | 25 | `01_generate_data.py` L22-82 |
| `daily_sales_forecast` | (store_id, date, daypart) | 9,000 (25 × 90 × 4) | L83-104 |
| `hourly_transactions` | (store_id, ts) | 18,000 (25 × 30 × 24) | L106-115 |
| `staff_roster` | (store_id, role, employee_name) | ~1,500 (25 × 4 × 3-8) | L117-124 |

All four are overwrite-mode `saveAsTable` calls → safe to re-run.

### 4.2 Genie space

- **Title**: `lhm-labor-genie`
- **Description**: "Labor operations assistant for the Lakehouse Market demo. Answers questions about forecasted vs actual sales by store and daypart, hourly transaction trends, and staff roster across a 25-store QSR chain."
- **Tables in scope**: the four tables above, fully-qualified as `home_jonathan_whiteley.demos.<table>`.
- **Instructions** (persona + anchors):
  - Audience: QSR store manager using the Homebase ops console.
  - Scope: single store unless the user asks to compare.
  - Day-parts are exactly: `Breakfast`, `Lunch`, `Dinner`, `Late`.
  - Synthetic data ends `2025-10-30`; anchor "today" / "this week" to the latest date present in the relevant table.
  - For forecast-vs-actuals, bucket `HOUR(ts)` from `hourly_transactions` into dayparts: Breakfast 5-10, Lunch 11-14, Dinner 17-21, Late 22-04.
- **Sample questions** (10):
  1. Which stores beat their revenue forecast last week?
  2. Show the biggest forecast-vs-actuals miss by daypart yesterday at store 1.
  3. Top 5 stores by Sunday brunch revenue.
  4. Hourly transaction trend at store 1 over the last 14 days.
  5. Which daypart at store 1 is consistently under-forecasted?
  6. Compare lunch revenue across all Bay Area stores last weekend.
  7. Rank stores by total revenue last 7 days.
  8. Headcount and total hourly wage by role at store 1.
  9. What hour of day does store 5 peak on weekdays?
  10. Average revenue per labor-hour by store last week (assume 8-hour shifts).
- **Example SQLs** (5), each anchored to a `(store_id, recent date)` pattern:
  1. Forecast vs actuals by daypart, last 7 days at a store — joins `daily_sales_forecast` with `hourly_transactions` aggregated by daypart bucket.
  2. Hourly revenue trend, last 14 days at a store — straight from `hourly_transactions`.
  3. Top 5 stores by revenue last week — sums `hourly_transactions`, joins `stores` for city.
  4. Forecast accuracy ranking by store last 7 days — `ABS(actual - forecast) / forecast` per store.
  5. Staff cost snapshot at a store — `staff_roster` rolled up by role with `SUM(hourly_wage)`.

## 5. Components

Two standalone Databricks notebooks, both in `notebooks/standalone-labor/` of the existing `lakehouse-market-e2e-DAIS-demo` repo.

### 5.1 `load_labor_tables.py`

- **Inputs (widgets)**: `catalog` (default `home_jonathan_whiteley`), `schema` (default `demos`).
- **Cells**:
  1. `%pip install dbldatagen mimesis`
  2. `%restart_python`
  3. Read widgets, `USE CATALOG`, `CREATE SCHEMA IF NOT EXISTS`, `USE SCHEMA`.
  4. Generate `stores` (lift L22-82 from `01_generate_data.py`, same Bay Area pinned cities so demo defaults to a recognizable city).
  5. Generate `daily_sales_forecast` (L83-104).
  6. Generate `hourly_transactions` (L106-115).
  7. Generate `staff_roster` (L117-124).
  8. Print `SELECT COUNT(*)` for all 4 tables as a sanity check.
- **Idempotence**: all writes use `mode("overwrite")` + `option("overwriteSchema", "true")`.

### 5.2 `ensure_labor_genie_space.py`

Cloned-and-pruned from `notebooks/06_ensure_genie_space.py`.

- **Inputs (widgets)**:
  - `catalog` (default `home_jonathan_whiteley`)
  - `schema` (default `demos`)
  - `warehouse_id` (required — logfood SQL warehouse id)
  - `space_id` (optional — if set, PATCH existing; if blank, CREATE new)
- **Cells**:
  1. `%pip install --quiet --upgrade "databricks-sdk>=0.40"`
  2. `%restart_python`
  3. Imports, widgets, build the qualified table list.
  4. TITLE, DESCRIPTION, INSTRUCTIONS constants per §4.2.
  5. `SAMPLE_QUESTIONS` and `EXAMPLE_SQLS` constants per §4.2.
  6. Build the space spec.
  7. Build the `payload` dict (`title`, `description`, `warehouse_id`, `serialized_space` JSON). If `space_id` is empty: `w.api_client.do("POST", "/api/2.0/genie/spaces", body=payload)` and capture the new id. Else: `w.api_client.do("PATCH", f"/api/2.0/genie/spaces/{space_id}", body=payload)`. (Mirrors the raw-REST pattern in `06_ensure_genie_space.py`; the typed SDK surface for Genie spaces is not stable yet.)
  8. Print the resulting `space_id` and the workspace Genie URL (`{host}/genie/rooms/{space_id}`).
- **Idempotence**: pass back the captured `space_id` on re-runs to PATCH in place.

## 6. Run procedure

1. From local: `databricks workspace import-dir notebooks/standalone-labor /Workspace/Users/jonathan.whiteley@databricks.com/standalone-labor --profile logfood`
2. In the logfood workspace UI, open `load_labor_tables.py` and run all (defaults are fine).
3. Find a serverless SQL warehouse id in logfood.
4. Open `ensure_labor_genie_space.py`, set `warehouse_id`, leave `space_id` blank, run all.
5. Capture the printed `space_id` and Genie URL from the final cell.
6. (Optional) Re-run `ensure_labor_genie_space.py` with `space_id` filled to update the space without creating a duplicate.

## 7. Success criteria

1. `SELECT COUNT(*) FROM home_jonathan_whiteley.demos.daily_sales_forecast` returns ~9,000 rows.
2. The Genie space appears in the logfood workspace UI with all 4 tables scoped, instructions visible, 10 sample questions populated, 5 example SQLs populated.
3. The seeded question "Top 5 stores by revenue last week" returns a sensible result with store city names.

## 8. Risks and open questions

- **Authentication to logfood**: the `databricks workspace import-dir` step assumes a configured CLI profile (`logfood` or equivalent) pointing at `adb-2548836972759138.18.azuredatabricks.net`. If not configured, the user falls back to manually uploading the two `.py` files via the workspace UI.
- **Warehouse id discovery**: the user supplies this at runtime; no automated lookup. Acceptable since it's a one-time setup.
- **Genie API surface drift**: we hit `/api/2.0/genie/spaces` directly via the SDK's `api_client.do(...)` rather than a typed method, because the typed surface isn't stable yet. The `serialized_space` schema (version 2, sorted ids) is the protocol the existing `06_ensure_genie_space.py` already follows; cloning it keeps us within proven shape. If Databricks changes the protocol, both the parent notebook and this one need the same fix.
- **Synthetic data anchor date**: hard-coded to `2025-10-30` end-of-window. If we ever want "today" to behave differently, regenerate with a different end_date in the gen notebook. Out of scope here.
