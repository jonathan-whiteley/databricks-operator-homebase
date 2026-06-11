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
