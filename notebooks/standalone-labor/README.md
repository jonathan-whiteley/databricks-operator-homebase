# Standalone Labor Genie demo

Two notebooks that stand up a focused Genie space scoped to the Labor subset
of the Lakehouse Market dataset, in any workspace + schema. No DAB, no app,
no Lakebase, no Model Serving.

**Default target**: workspace `adb-2548836972759138.18.azuredatabricks.net`
(logfood), catalog `home_jonathan_whiteley`, schema `demos`.

## Run order

1. `databricks workspace import-dir notebooks/standalone-labor /Workspace/Users/<you>/standalone-labor --profile <profile>`
2. Open `load_labor_tables.py` in the target workspace, run all. Defaults match the target above; override via widgets if needed.
3. Find a serverless SQL warehouse id in the workspace UI (SQL → Warehouses).
4. Open `ensure_labor_genie_space.py`, set `warehouse_id` widget, leave `space_id` blank, run all.
5. Copy the printed `space_id` and Genie URL from the final cell.
6. (Optional) To update the space later: re-run notebook 2 with `space_id` set.

## Tables created

- `stores` (25 rows)
- `daily_sales_forecast` (~9,000 rows, store × date × daypart)
- `hourly_transactions` (~18,000 rows, store × hour, last 30 days)
- `staff_roster` (~550 rows, current crew snapshot)

## Source

Cloned from `notebooks/01_generate_data.py` (lines 22-124) and
`notebooks/06_ensure_genie_space.py`. Kept standalone so this demo can run
independently of the full Lakehouse Market pipeline.
