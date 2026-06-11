# Labor Genie · standalone demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up two standalone Databricks notebooks that (1) load 4 Labor tables into `home_jonathan_whiteley.demos` in the logfood workspace and (2) create a focused Genie space scoped to those tables, with seeded questions and example SQLs.

**Architecture:** Clone-and-prune from existing `01_generate_data.py` (labor portion only) and `06_ensure_genie_space.py` (labor scope only). Both notebooks are idempotent: tables use `overwrite` mode, Genie space supports CREATE-or-PATCH via `space_id` widget.

**Tech Stack:** Databricks notebooks (Python), `dbldatagen`, `mimesis`, `databricks-sdk` (raw REST via `api_client.do(...)`), Databricks CLI for upload.

**Spec:** `docs/superpowers/specs/2026-06-11-labor-genie-standalone-design.md`

**Testing model:** These are one-shot Databricks notebooks, not unit-testable functions. Verification is per-task: AST-parse locally for syntax, plus row-count + Genie-space-exists checks after each notebook runs in the target workspace.

---

## File Structure

- **Create:** `notebooks/standalone-labor/load_labor_tables.py` (~120 lines, single notebook)
- **Create:** `notebooks/standalone-labor/ensure_labor_genie_space.py` (~200 lines, single notebook)
- **Create:** `notebooks/standalone-labor/README.md` (~40 lines, run-order doc)
- **Reference (do not modify):** `notebooks/01_generate_data.py` lines 22-124, `notebooks/06_ensure_genie_space.py` (full file)

---

## Task 1: Scaffold directory and README

**Files:**
- Create: `notebooks/standalone-labor/README.md`

- [ ] **Step 1: Create directory**

```bash
mkdir -p notebooks/standalone-labor
```

- [ ] **Step 2: Write README.md**

```markdown
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
- `staff_roster` (~1,500 rows, current crew snapshot)

## Source

Cloned from `notebooks/01_generate_data.py` (lines 22-124) and
`notebooks/06_ensure_genie_space.py`. Kept standalone so this demo can run
independently of the full Lakehouse Market pipeline.
```

- [ ] **Step 3: Commit**

```bash
git add notebooks/standalone-labor/README.md
git commit -m "scaffold: standalone labor genie demo dir + README"
```

---

## Task 2: Build `load_labor_tables.py` — header, widgets, schema setup

**Files:**
- Create: `notebooks/standalone-labor/load_labor_tables.py`

- [ ] **Step 1: Write the file with header through schema setup**

```python
# Databricks notebook source
"""
load_labor_tables.py

Idempotent loader for the 4 Labor tables used by the standalone Labor Genie
demo. Generates synthetic data in-place; all writes use overwrite mode.

Source: lifted from notebooks/01_generate_data.py lines 22-124. Kept
standalone so this demo runs without the full Lakehouse Market pipeline.

Tables:
  - stores                  (25 rows)
  - daily_sales_forecast    (~9,000 rows)
  - hourly_transactions     (~18,000 rows)
  - staff_roster            (~1,500 rows)
"""

# COMMAND ----------
# MAGIC %pip install --quiet dbldatagen mimesis

# COMMAND ----------
# MAGIC %restart_python

# COMMAND ----------
import random
from datetime import date

import dbldatagen as dg
from mimesis import Address, Person
from pyspark.sql import functions as F

SEED = 42
STORE_COUNT = 25

try:
    dbutils.widgets.text("catalog", "home_jonathan_whiteley", "Unity Catalog catalog")
    dbutils.widgets.text("schema", "demos", "Schema within catalog")
except NameError:
    pass

CATALOG = dbutils.widgets.get("catalog").strip() or "home_jonathan_whiteley"
SCHEMA = dbutils.widgets.get("schema").strip() or "demos"

spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
spark.sql(f"USE SCHEMA {SCHEMA}")

print(f"Target: {CATALOG}.{SCHEMA}")
```

- [ ] **Step 2: AST-parse locally to verify syntax**

Run: `python3 -c "import ast; ast.parse(open('notebooks/standalone-labor/load_labor_tables.py').read())"`
Expected: exits 0 with no output.

- [ ] **Step 3: Commit**

```bash
git add notebooks/standalone-labor/load_labor_tables.py
git commit -m "feat(labor-genie): notebook 1 header + schema setup"
```

---

## Task 3: Add `stores` generation to `load_labor_tables.py`

**Files:**
- Modify: `notebooks/standalone-labor/load_labor_tables.py` (append cells)

**Reference:** `notebooks/01_generate_data.py` lines 22-82.

- [ ] **Step 1: Append the stores cell**

```python

# COMMAND ----------
# Stores dim — first 12 pinned to Bay Area cities so demos default to a
# recognizable store; remaining 13 are randomized across CA.
addr = Address("en")
per = Person("en")
random.seed(SEED)

BAY_AREA = [
    ("San Jose",        "CA", "95113", 37.3382, -121.8863),
    ("Mountain View",   "CA", "94041", 37.3861, -122.0839),
    ("Sunnyvale",       "CA", "94086", 37.3688, -122.0363),
    ("Palo Alto",       "CA", "94301", 37.4419, -122.1430),
    ("Fremont",         "CA", "94538", 37.5485, -121.9886),
    ("Hayward",         "CA", "94541", 37.6688, -122.0808),
    ("Redwood City",    "CA", "94063", 37.4852, -122.2364),
    ("San Mateo",       "CA", "94401", 37.5630, -122.3255),
    ("San Francisco",   "CA", "94103", 37.7749, -122.4194),
    ("Daly City",       "CA", "94014", 37.7058, -122.4622),
    ("Oakland",         "CA", "94612", 37.8044, -122.2712),
    ("Berkeley",        "CA", "94704", 37.8716, -122.2727),
]

stores_rows = []
for i in range(1, STORE_COUNT + 1):
    if i <= len(BAY_AREA):
        city, state, zip_code, lat, lon = BAY_AREA[i - 1]
    else:
        city = addr.city()
        state = "CA"
        zip_code = addr.zip_code()
        lat = 37.0 + random.uniform(-3, 3)
        lon = -119.0 + random.uniform(-3, 3)
    stores_rows.append({
        "store_id": i,
        "store_name": f"LHM #{i:03d} {city}",
        "city": city,
        "state": state,
        "zip_code": zip_code,
        "lat": lat,
        "lon": lon,
        "manager_name": per.full_name(),
        "opened_date": str(date(2018, 1, 1) + (date(2024, 1, 1) - date(2018, 1, 1)) * (i % 7) // 7),
    })

(spark.createDataFrame(stores_rows)
    .write.mode("overwrite").option("overwriteSchema", "true").saveAsTable("stores"))
```

- [ ] **Step 2: AST-parse to verify syntax**

Run: `python3 -c "import ast; ast.parse(open('notebooks/standalone-labor/load_labor_tables.py').read())"`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add notebooks/standalone-labor/load_labor_tables.py
git commit -m "feat(labor-genie): add stores generation"
```

---

## Task 4: Add `daily_sales_forecast` generation

**Files:**
- Modify: `notebooks/standalone-labor/load_labor_tables.py`

**Reference:** `notebooks/01_generate_data.py` lines 83-104.

- [ ] **Step 1: Append the forecast cell**

```python

# COMMAND ----------
# daily_sales_forecast: cross join of store × date × daypart. Synthetic
# revenue/transactions are deterministic-by-seed within plausible ranges.
BASE_DATE = "2025-08-01"
END_DATE = "2025-10-29"
DAYPARTS = ["Breakfast", "Lunch", "Dinner", "Late"]

stores_df = spark.range(1, STORE_COUNT + 1).select(F.col("id").cast("int").alias("store_id"))
dates_df = spark.sql(
    f"SELECT explode(sequence(to_date('{BASE_DATE}'), to_date('{END_DATE}'), interval 1 day)) AS date"
)
dayparts_df = spark.createDataFrame([(d,) for d in DAYPARTS], "daypart string")

fc = (
    stores_df.crossJoin(dates_df).crossJoin(dayparts_df)
    .withColumn("forecast_revenue", F.round(F.rand(SEED) * (5500 - 300) + 300, 2))
    .withColumn("forecast_transactions", (F.rand(SEED + 1) * (900 - 40) + 40).cast("int"))
)
fc.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable("daily_sales_forecast")
```

- [ ] **Step 2: AST-parse to verify syntax**

Run: `python3 -c "import ast; ast.parse(open('notebooks/standalone-labor/load_labor_tables.py').read())"`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add notebooks/standalone-labor/load_labor_tables.py
git commit -m "feat(labor-genie): add daily_sales_forecast generation"
```

---

## Task 5: Add `hourly_transactions` generation

**Files:**
- Modify: `notebooks/standalone-labor/load_labor_tables.py`

**Reference:** `notebooks/01_generate_data.py` lines 106-115.

- [ ] **Step 1: Append the hourly cell**

```python

# COMMAND ----------
# hourly_transactions: last 30 days of hourly actuals (store_id, ts,
# transactions, revenue). Random within plausible per-hour ranges.
ht = (
    dg.DataGenerator(spark, rows=STORE_COUNT * 30 * 24, partitions=4)
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("ts", "timestamp", begin="2025-10-01 00:00:00", end="2025-10-30 23:00:00")
    .withColumn("transactions", "int", minValue=5, maxValue=120, random=True)
    .withColumn("revenue", "double", minValue=20.0, maxValue=2200.0, random=True)
    .build()
)
ht.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable("hourly_transactions")
```

- [ ] **Step 2: AST-parse to verify syntax**

Run: `python3 -c "import ast; ast.parse(open('notebooks/standalone-labor/load_labor_tables.py').read())"`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add notebooks/standalone-labor/load_labor_tables.py
git commit -m "feat(labor-genie): add hourly_transactions generation"
```

---

## Task 6: Add `staff_roster` + row-count summary

**Files:**
- Modify: `notebooks/standalone-labor/load_labor_tables.py`

**Reference:** `notebooks/01_generate_data.py` lines 117-124.

- [ ] **Step 1: Append the staff_roster + summary cells**

```python

# COMMAND ----------
# staff_roster: current crew per store, by role. Snapshot, no time
# dimension. 3-8 employees per (store, role).
ROLES = ["Cashier", "Cook", "Runner", "Manager"]
roster_rows = []
for s in range(1, STORE_COUNT + 1):
    for r in ROLES:
        for _ in range(random.randint(3, 8)):
            roster_rows.append({
                "store_id": s,
                "role": r,
                "employee_name": per.full_name(),
                "hourly_wage": round(random.uniform(15, 28), 2),
            })

(spark.createDataFrame(roster_rows)
    .write.mode("overwrite").option("overwriteSchema", "true").saveAsTable("staff_roster"))

# COMMAND ----------
# Summary: verify all 4 tables landed.
for t in ["stores", "daily_sales_forecast", "hourly_transactions", "staff_roster"]:
    n = spark.table(t).count()
    print(f"  {CATALOG}.{SCHEMA}.{t:<28s}  {n:>8,} rows")
```

- [ ] **Step 2: AST-parse to verify syntax**

Run: `python3 -c "import ast; ast.parse(open('notebooks/standalone-labor/load_labor_tables.py').read())"`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add notebooks/standalone-labor/load_labor_tables.py
git commit -m "feat(labor-genie): add staff_roster + summary cell"
```

---

## Task 7: Smoke-run `load_labor_tables.py` in logfood workspace

**Files:** none modified. Manual verification only.

This task confirms the loader notebook runs cleanly against the target workspace before we build the Genie notebook on top of it.

- [ ] **Step 1: Upload to logfood**

Run:
```bash
databricks workspace import-dir notebooks/standalone-labor \
    /Workspace/Users/jonathan.whiteley@databricks.com/standalone-labor \
    --profile logfood --overwrite
```
Expected: command prints uploaded paths and exits 0.

If the `logfood` profile doesn't exist, configure it first:
```bash
databricks configure --profile logfood --host https://adb-2548836972759138.18.azuredatabricks.net
```

- [ ] **Step 2: Run `load_labor_tables.py` in the workspace UI**

Open `/Workspace/Users/jonathan.whiteley@databricks.com/standalone-labor/load_labor_tables` in the logfood workspace, attach to a serverless cluster, and click "Run all". Wait for it to finish.

- [ ] **Step 3: Verify row counts from the final cell output**

Expected printout:
```
  home_jonathan_whiteley.demos.stores                            25 rows
  home_jonathan_whiteley.demos.daily_sales_forecast           9,000 rows
  home_jonathan_whiteley.demos.hourly_transactions           18,000 rows
  home_jonathan_whiteley.demos.staff_roster                   ~1,500 rows
```
(staff_roster varies 3-8 per role, expected range ~1,200-2,000.)

- [ ] **Step 4: Spot-check the data via SQL Editor**

Run in the workspace SQL Editor:
```sql
SELECT city, store_id FROM home_jonathan_whiteley.demos.stores ORDER BY store_id LIMIT 5;
SELECT daypart, COUNT(*) AS n FROM home_jonathan_whiteley.demos.daily_sales_forecast GROUP BY daypart;
```
Expected: 5 Bay Area cities including San Jose; each of 4 dayparts has 2,250 rows (25 stores × 90 days).

If any of the above fails, fix the loader and re-run. Do not proceed to Task 8 until row counts and spot-checks pass.

---

## Task 8: Build `ensure_labor_genie_space.py` — header, widgets, constants

**Files:**
- Create: `notebooks/standalone-labor/ensure_labor_genie_space.py`

**Reference:** `notebooks/06_ensure_genie_space.py` lines 1-90 (header + widget pattern).

- [ ] **Step 1: Write header + widgets + constants**

```python
# Databricks notebook source
"""
ensure_labor_genie_space.py

Idempotent CREATE-or-PATCH of the standalone Labor Genie space. Scoped to
the 4 Labor tables loaded by load_labor_tables.py.

  - If `space_id` widget is set (or env GENIE_SPACE_ID is non-empty),
    PATCHes that space with the spec defined below.
  - Otherwise CREATEs a new space and prints the new id. Capture it for
    future idempotent re-runs.

Source: cloned-and-pruned from notebooks/06_ensure_genie_space.py.
The Genie API surface is hit via raw REST (`api_client.do(...)`) because
the typed SDK method isn't stable yet.
"""

# COMMAND ----------
# MAGIC %pip install --quiet --upgrade "databricks-sdk>=0.40"

# COMMAND ----------
# MAGIC %restart_python

# COMMAND ----------
import json
import os
from uuid import uuid4

from databricks.sdk import WorkspaceClient

try:
    dbutils.widgets.text("catalog", "home_jonathan_whiteley", "Unity Catalog catalog")
    dbutils.widgets.text("schema", "demos", "Schema within catalog")
    dbutils.widgets.text("warehouse_id", "", "SQL warehouse id for the Genie space (required)")
    dbutils.widgets.text("space_id", "", "Existing Genie space id (leave blank to create new)")
except NameError:
    pass

def _widget(name: str, default: str = "") -> str:
    try:
        v = dbutils.widgets.get(name).strip()
        if v:
            return v
    except Exception:
        pass
    return os.getenv(name.upper(), default)

CATALOG = _widget("catalog", "home_jonathan_whiteley")
SCHEMA = _widget("schema", "demos")
WAREHOUSE_ID = _widget("warehouse_id", "")
SPACE_ID = _widget("space_id", "")

if not WAREHOUSE_ID:
    raise RuntimeError("warehouse_id widget / WAREHOUSE_ID env must be set for Genie space creation")

TITLE = "lhm-labor-genie"
DESCRIPTION = (
    "Labor operations assistant for the Lakehouse Market demo. Answers questions "
    "about forecasted vs actual sales by store and daypart, hourly transaction "
    "trends, and staff roster across a 25-store QSR chain."
)

INSTRUCTIONS = (
    "You are answering questions from a Lakehouse Market store manager. "
    "Scope answers to a single store unless the user asks to compare. "
    "Day-parts are exactly: Breakfast, Lunch, Dinner, Late. "
    "Synthetic data ends 2025-10-30 — anchor 'today' / 'this week' to the latest "
    "date in the relevant table. "
    "For forecast-vs-actuals, bucket HOUR(ts) from hourly_transactions into dayparts: "
    "Breakfast 5-10, Lunch 11-14, Dinner 17-21, Late 22-04."
)

print(f"Target: {CATALOG}.{SCHEMA}")
print(f"Warehouse: {WAREHOUSE_ID}")
print(f"Mode: {'PATCH ' + SPACE_ID if SPACE_ID else 'CREATE'}")
```

- [ ] **Step 2: AST-parse to verify syntax**

Run: `python3 -c "import ast; ast.parse(open('notebooks/standalone-labor/ensure_labor_genie_space.py').read())"`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add notebooks/standalone-labor/ensure_labor_genie_space.py
git commit -m "feat(labor-genie): notebook 2 header + widgets + constants"
```

---

## Task 9: Add `SAMPLE_QUESTIONS` and `EXAMPLE_SQLS`

**Files:**
- Modify: `notebooks/standalone-labor/ensure_labor_genie_space.py`

- [ ] **Step 1: Append the constants cell**

```python

# COMMAND ----------
SAMPLE_QUESTIONS = [
    "Which stores beat their revenue forecast last week?",
    "Show the biggest forecast-vs-actuals miss by daypart yesterday at store 1.",
    "Top 5 stores by Sunday brunch revenue.",
    "Hourly transaction trend at store 1 over the last 14 days.",
    "Which daypart at store 1 is consistently under-forecasted?",
    "Compare lunch revenue across all Bay Area stores last weekend.",
    "Rank stores by total revenue last 7 days.",
    "Headcount and total hourly wage by role at store 1.",
    "What hour of day does store 5 peak on weekdays?",
    "Average revenue per labor-hour by store last week (assume 8-hour shifts).",
]

EXAMPLE_SQLS = [
    {
        "title": "Forecast vs actuals by daypart, last 7 days at a store",
        "sql": (
            "WITH anchor AS (SELECT MAX(date) AS d FROM "
            f"{CATALOG}.{SCHEMA}.daily_sales_forecast), "
            "actuals AS ( "
            "  SELECT store_id, "
            "    CASE WHEN HOUR(ts) BETWEEN 5 AND 10 THEN 'Breakfast' "
            "         WHEN HOUR(ts) BETWEEN 11 AND 14 THEN 'Lunch' "
            "         WHEN HOUR(ts) BETWEEN 17 AND 21 THEN 'Dinner' "
            "         ELSE 'Late' END AS daypart, "
            "    SUM(revenue) AS actual_revenue "
            f"  FROM {CATALOG}.{SCHEMA}.hourly_transactions "
            "  WHERE ts >= (SELECT d FROM anchor) - INTERVAL 7 DAYS "
            "  GROUP BY store_id, daypart) "
            "SELECT f.store_id, f.daypart, "
            "  SUM(f.forecast_revenue) AS forecast, "
            "  SUM(a.actual_revenue)   AS actual "
            f"FROM {CATALOG}.{SCHEMA}.daily_sales_forecast f "
            "JOIN actuals a USING (store_id, daypart) "
            "WHERE f.store_id = 1 AND f.date >= (SELECT d FROM anchor) - INTERVAL 7 DAYS "
            "GROUP BY f.store_id, f.daypart ORDER BY f.daypart"
        ),
    },
    {
        "title": "Hourly revenue trend, last 14 days at a store",
        "sql": (
            "SELECT date_trunc('hour', ts) AS hr, SUM(revenue) AS rev "
            f"FROM {CATALOG}.{SCHEMA}.hourly_transactions "
            "WHERE store_id = 1 AND ts >= (SELECT MAX(ts) FROM "
            f"{CATALOG}.{SCHEMA}.hourly_transactions) - INTERVAL 14 DAYS "
            "GROUP BY 1 ORDER BY 1"
        ),
    },
    {
        "title": "Top 5 stores by revenue last 7 days",
        "sql": (
            "SELECT s.store_id, s.city, SUM(h.revenue) AS rev "
            f"FROM {CATALOG}.{SCHEMA}.hourly_transactions h "
            f"JOIN {CATALOG}.{SCHEMA}.stores s USING (store_id) "
            "WHERE h.ts >= (SELECT MAX(ts) FROM "
            f"{CATALOG}.{SCHEMA}.hourly_transactions) - INTERVAL 7 DAYS "
            "GROUP BY s.store_id, s.city ORDER BY rev DESC LIMIT 5"
        ),
    },
    {
        "title": "Forecast accuracy ranking by store, last 7 days",
        "sql": (
            "WITH anchor AS (SELECT MAX(date) AS d FROM "
            f"{CATALOG}.{SCHEMA}.daily_sales_forecast), "
            "actuals AS ( "
            "  SELECT store_id, DATE(ts) AS d, SUM(revenue) AS actual "
            f"  FROM {CATALOG}.{SCHEMA}.hourly_transactions "
            "  WHERE ts >= (SELECT d FROM anchor) - INTERVAL 7 DAYS "
            "  GROUP BY store_id, DATE(ts)) "
            "SELECT f.store_id, "
            "  AVG(ABS(a.actual - f_day.forecast) / NULLIF(f_day.forecast, 0)) AS mape "
            "FROM ( "
            "  SELECT store_id, date, SUM(forecast_revenue) AS forecast "
            f"  FROM {CATALOG}.{SCHEMA}.daily_sales_forecast "
            "  WHERE date >= (SELECT d FROM anchor) - INTERVAL 7 DAYS "
            "  GROUP BY store_id, date) f_day "
            "JOIN ( "
            "  SELECT store_id, date, SUM(forecast_revenue) AS forecast "
            f"  FROM {CATALOG}.{SCHEMA}.daily_sales_forecast "
            "  GROUP BY store_id, date) f USING (store_id, date) "
            "JOIN actuals a ON a.store_id = f.store_id AND a.d = f.date "
            "GROUP BY f.store_id ORDER BY mape ASC"
        ),
    },
    {
        "title": "Staff cost snapshot by role at a store",
        "sql": (
            "SELECT role, COUNT(*) AS headcount, "
            "  ROUND(SUM(hourly_wage), 2) AS total_hourly_wage_cost, "
            "  ROUND(AVG(hourly_wage), 2) AS avg_hourly_wage "
            f"FROM {CATALOG}.{SCHEMA}.staff_roster "
            "WHERE store_id = 1 GROUP BY role ORDER BY total_hourly_wage_cost DESC"
        ),
    },
]
```

- [ ] **Step 2: AST-parse to verify syntax**

Run: `python3 -c "import ast; ast.parse(open('notebooks/standalone-labor/ensure_labor_genie_space.py').read())"`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add notebooks/standalone-labor/ensure_labor_genie_space.py
git commit -m "feat(labor-genie): add sample questions + example SQLs"
```

---

## Task 10: Add `build_serialized_space()` and the CREATE/PATCH call

**Files:**
- Modify: `notebooks/standalone-labor/ensure_labor_genie_space.py`

**Reference:** `notebooks/06_ensure_genie_space.py` lines 160-243 (serialized_space shape + the api_client.do call). Read this file first to get the exact key structure for `serialized_space` (version 2, sorted ids). Lift only the labor-relevant fields.

- [ ] **Step 1: Append the builder + CREATE/PATCH cell**

```python

# COMMAND ----------
# Labor scope: 4 tables qualified to CATALOG.SCHEMA.
TABLES = [
    f"{CATALOG}.{SCHEMA}.stores",
    f"{CATALOG}.{SCHEMA}.daily_sales_forecast",
    f"{CATALOG}.{SCHEMA}.hourly_transactions",
    f"{CATALOG}.{SCHEMA}.staff_roster",
]

def build_serialized_space() -> dict:
    """Build the serialized_space JSON. Mirrors the v2 protocol from
    notebooks/06_ensure_genie_space.py — deterministic ids by sorting."""
    sample_qs = [
        {"id": str(uuid4()), "question": q} for q in SAMPLE_QUESTIONS
    ]
    example_sqls = [
        {"id": str(uuid4()), "title": s["title"], "sql": s["sql"]}
        for s in EXAMPLE_SQLS
    ]
    tables = [{"id": str(uuid4()), "name": t} for t in TABLES]
    return {
        "version": 2,
        "instructions": INSTRUCTIONS,
        "tables": tables,
        "config": {
            "sample_questions": sample_qs,
            "example_sqls": example_sqls,
        },
    }

# COMMAND ----------
w = WorkspaceClient()
payload = {
    "title": TITLE,
    "description": DESCRIPTION,
    "warehouse_id": WAREHOUSE_ID,
    "serialized_space": json.dumps(build_serialized_space()),
}

if SPACE_ID:
    print(f"Patching existing Genie space {SPACE_ID} ...")
    resp = w.api_client.do(
        "PATCH",
        f"/api/2.0/genie/spaces/{SPACE_ID}",
        body=payload,
    )
    print(f"Patched: {resp.get('title')} ({resp.get('space_id')})")
else:
    print("Creating new Genie space ...")
    resp = w.api_client.do("POST", "/api/2.0/genie/spaces", body=payload)
    new_id = resp.get("space_id")
    print(f"Created: {resp.get('title')} ({new_id})")
    print()
    print(f"  space_id: {new_id}")
    print(f"  URL: {w.config.host}/genie/rooms/{new_id}")
```

- [ ] **Step 2: AST-parse to verify syntax**

Run: `python3 -c "import ast; ast.parse(open('notebooks/standalone-labor/ensure_labor_genie_space.py').read())"`
Expected: exits 0.

- [ ] **Step 3: Cross-check against `06_ensure_genie_space.py` builder**

Read `notebooks/06_ensure_genie_space.py` around lines 160-202 (`build_serialized_space()`). Confirm that the `{"version": 2, "instructions": ..., "tables": [...], "config": {...}}` shape used above matches the parent notebook's contract. If the parent notebook uses additional top-level keys (e.g., `description`, `metadata`), add them here verbatim. If it differs, update this notebook to match — do not invent new keys.

If there's a mismatch, fix it inline and re-run Step 2.

- [ ] **Step 4: Commit**

```bash
git add notebooks/standalone-labor/ensure_labor_genie_space.py
git commit -m "feat(labor-genie): add serialized_space builder + CREATE/PATCH call"
```

---

## Task 11: Smoke-run `ensure_labor_genie_space.py` in logfood

**Files:** none modified. Manual verification.

- [ ] **Step 1: Re-upload notebooks to logfood**

Run:
```bash
databricks workspace import-dir notebooks/standalone-labor \
    /Workspace/Users/jonathan.whiteley@databricks.com/standalone-labor \
    --profile logfood --overwrite
```
Expected: command exits 0.

- [ ] **Step 2: Find a SQL warehouse id**

In the logfood workspace UI: SQL → Warehouses. Pick a serverless warehouse and copy its id (the hash in the URL, e.g. `1234abcd5678efgh`).

- [ ] **Step 3: Run `ensure_labor_genie_space.py` with widgets set**

Open the notebook in the logfood UI. Set widgets:
- `catalog`: `home_jonathan_whiteley`
- `schema`: `demos`
- `warehouse_id`: (paste from Step 2)
- `space_id`: (leave blank)

Click "Run all".

- [ ] **Step 4: Capture the created `space_id` and URL**

Expected final-cell output:
```
Creating new Genie space ...
Created: lhm-labor-genie (<some-uuid>)

  space_id: <some-uuid>
  URL: https://adb-2548836972759138.18.azuredatabricks.net/genie/rooms/<some-uuid>
```

Record `space_id` somewhere (paste into the spec doc or a note) so re-runs can PATCH it.

- [ ] **Step 5: Open the Genie space in the UI and verify**

Visit the URL from Step 4. Confirm:
- Title is `lhm-labor-genie`
- All 4 tables (`stores`, `daily_sales_forecast`, `hourly_transactions`, `staff_roster`) are listed under Sources.
- 10 sample questions appear in the sidebar/example panel.
- 5 example SQLs appear in the saved-queries / instructions area.
- The instructions block matches §4.2 of the spec.

If anything is missing or off, fix the notebook, re-run Step 1, then re-run the notebook in the workspace with `space_id` set (PATCH path) to update without creating a duplicate.

---

## Task 12: Live-fire one seeded question through Genie

**Files:** none modified. Functional acceptance test.

- [ ] **Step 1: Open the Genie space**

Use the URL captured in Task 11 Step 4.

- [ ] **Step 2: Ask "Top 5 stores by revenue last week"**

Type the question verbatim (it's one of the 10 seeded sample_questions).

- [ ] **Step 3: Verify the answer**

Expected:
- Genie generates a SQL that joins `hourly_transactions` and `stores`.
- The result is 5 rows with store cities (San Jose, Mountain View, etc., depending on the random seed) and revenue numbers.
- Query completes against the configured warehouse without error.

If the answer is wrong or Genie picks a weird table, iterate on `INSTRUCTIONS` or `EXAMPLE_SQLS` in `ensure_labor_genie_space.py`, re-run with `space_id` set (PATCH), and re-ask.

- [ ] **Step 4: Try one comparison question to stress-test joins**

Ask: "Show the biggest forecast-vs-actuals miss by daypart yesterday at store 1."

Expected:
- Genie joins `daily_sales_forecast` and `hourly_transactions` with the daypart bucket logic from `INSTRUCTIONS`.
- Returns a small table of dayparts with miss magnitudes.

If Genie fails the daypart bucketing, this is the signal that the inline `EXAMPLE_SQLS[0]` (forecast vs actuals) needs to be more explicit. Update and PATCH.

---

## Task 13: Final commit and capture `space_id`

**Files:**
- Modify: `docs/superpowers/specs/2026-06-11-labor-genie-standalone-design.md` (record actual `space_id`)

- [ ] **Step 1: Append the captured `space_id` to the spec**

In §1 (Goal) or a new §9, add a line:
```markdown
**Created Genie space**: `<space_id>` — https://adb-2548836972759138.18.azuredatabricks.net/genie/rooms/<space_id>
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-06-11-labor-genie-standalone-design.md
git commit -m "docs(labor-genie): record created space_id"
```

---

## Self-review checklist (run after all tasks complete)

- [ ] All 4 tables present in `home_jonathan_whiteley.demos` with expected row counts.
- [ ] Genie space exists at the URL printed by Task 11.
- [ ] Title `lhm-labor-genie`, instructions visible, 10 sample questions, 5 example SQLs, 4 tables in scope.
- [ ] "Top 5 stores by revenue last week" returns sensible results.
- [ ] "Forecast vs actuals" question returns daypart-bucketed results.
- [ ] `space_id` recorded in the spec doc for future PATCH re-runs.
