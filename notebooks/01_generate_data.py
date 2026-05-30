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
