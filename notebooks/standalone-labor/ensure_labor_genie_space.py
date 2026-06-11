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
