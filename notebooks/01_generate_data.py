# notebooks/01_generate_data.py
# Databricks notebook source
# COMMAND ----------
# MAGIC %pip install dbldatagen mimesis polars

# COMMAND ----------
import dbldatagen as dg
from pyspark.sql import functions as F
from pyspark.sql.types import *
from mimesis import Address, Person
from _gen_lib import STORE_COUNT, SEED
import random

CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "jdub_demo"  # type: ignore
SCHEMA  = "lakehouse_market"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
spark.sql(f"USE SCHEMA {SCHEMA}")

# COMMAND ----------
# Stores dim — Mimesis for realistic addresses
addr = Address("en"); per = Person("en")
random.seed(SEED)
stores_rows = []
for i in range(1, STORE_COUNT + 1):
    lat = 37.0 + random.uniform(-3, 3)   # CA-ish anchor for the demo
    lon = -119.0 + random.uniform(-3, 3)
    stores_rows.append({
        "store_id": i,
        "store_name": f"Lakehouse Market #{i:03d}",
        "city": addr.city(),
        "state": addr.state(abbr=True),
        "zip": addr.zip_code(),
        "lat": float(lat),
        "lon": float(lon),
        "manager_name": per.full_name(),
        "open_date": addr.calling_code(),  # placeholder; replaced below
    })
spark.createDataFrame(stores_rows).drop("open_date").write.mode("overwrite").saveAsTable("stores")

# COMMAND ----------
from datetime import date, timedelta
dates = [(date(2024, 6, 1) + timedelta(days=i),) for i in range(720)]  # 24mo
spark.createDataFrame(dates, ["date"]).write.mode("overwrite").saveAsTable("dim_date")

times = [(h,) for h in range(24)]
spark.createDataFrame(times, ["hour"]).write.mode("overwrite").saveAsTable("dim_time")

# COMMAND ----------
# Labor: daily_sales_forecast (forecast per store per day per day-part)
import dbldatagen as dg
from pyspark.sql import functions as F

base_date = "2025-08-01"
days = 90
fc = (
    dg.DataGenerator(spark, rows=STORE_COUNT * days * 4, partitions=4)
    .withIdOutput()
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("date", "date", begin=base_date, end="2025-10-29")
    .withColumn("daypart", "string", values=["Breakfast", "Lunch", "Dinner", "Late"], random=True)
    .withColumn("forecast_revenue", "double", minValue=300, maxValue=5500, random=True)
    .withColumn("forecast_transactions", "int", minValue=40, maxValue=900, random=True)
    .build()
)
fc.drop("id").write.mode("overwrite").saveAsTable("daily_sales_forecast")

# hourly_transactions for last 30d
ht = (
    dg.DataGenerator(spark, rows=STORE_COUNT * 30 * 24, partitions=4)
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("ts", "timestamp", begin="2025-10-01 00:00:00", end="2025-10-30 23:00:00")
    .withColumn("transactions", "int", minValue=5, maxValue=120, random=True)
    .withColumn("revenue", "double", minValue=20.0, maxValue=2200.0, random=True)
    .build()
)
ht.write.mode("overwrite").saveAsTable("hourly_transactions")

# staff_roster — current crew per store, by role
roles = ["Cashier", "Cook", "Runner", "Manager"]
rows = []
for s in range(1, STORE_COUNT + 1):
    for r in roles:
        for n in range(random.randint(3, 8)):
            rows.append({"store_id": s, "role": r, "employee_name": per.full_name(), "hourly_wage": round(random.uniform(15, 28), 2)})
spark.createDataFrame(rows).write.mode("overwrite").saveAsTable("staff_roster")
