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
    "Synthetic data ends 2025-10-30, so anchor 'today' / 'this week' to the latest "
    "date in the relevant table. "
    "For forecast-vs-actuals, bucket HOUR(ts) from hourly_transactions into dayparts: "
    "Breakfast 5-10, Lunch 11-14, Dinner 17-21, Late 22-04."
)

print(f"Target: {CATALOG}.{SCHEMA}")
print(f"Warehouse: {WAREHOUSE_ID}")
print(f"Mode: {'PATCH ' + SPACE_ID if SPACE_ID else 'CREATE'}")

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
