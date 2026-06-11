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
