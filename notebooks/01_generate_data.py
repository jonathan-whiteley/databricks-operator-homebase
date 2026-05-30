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

# COMMAND ----------
# Loyalty members — 50k members, each anchored to a preferred store with gaussian jitter
import math
MEMBER_COUNT = 50_000
stores_pd = spark.table("stores").select("store_id", "lat", "lon").toPandas()

import pandas as pd
rng = np.random.default_rng(SEED)
member_rows = []
for mid in range(1, MEMBER_COUNT + 1):
    s = stores_pd.sample(1, random_state=int(rng.integers(0, 2**31))).iloc[0]
    # 2D gaussian around the store, ~5 mile sigma
    m_lat = float(s.lat + rng.normal(0, 0.07))
    m_lon = float(s.lon + rng.normal(0, 0.07))
    spend_band = rng.choice(["low", "mid", "high", "whale"], p=[0.55, 0.30, 0.12, 0.03])
    member_rows.append({
        "member_id": mid,
        "preferred_store_id": int(s.store_id),
        "lat": m_lat,
        "lon": m_lon,
        "join_date": str(date(2023, 1, 1) + timedelta(days=int(rng.integers(0, 900)))),
        "spend_band": spend_band,
        "lifetime_spend": float(rng.gamma(2.0, {"low":40,"mid":120,"high":350,"whale":900}[spend_band])),
    })
spark.createDataFrame(member_rows).write.mode("overwrite").saveAsTable("loyalty_members")

# transactions — 500k over 6 months
tx = (
    dg.DataGenerator(spark, rows=500_000, partitions=8)
    .withColumn("member_id", "int", minValue=1, maxValue=MEMBER_COUNT, random=True)
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("ts", "timestamp", begin="2025-05-01 00:00:00", end="2025-10-30 23:59:00")
    .withColumn("amount", "double", minValue=3.5, maxValue=85.0, random=True)
    .withColumn("daypart", "string", values=DAYPART_LABELS, random=True)
    .build()
)
tx.write.mode("overwrite").saveAsTable("transactions")

# offers catalog — 12 templates
offers = [
    {"offer_id": i, "name": n, "discount_pct": d, "audience": a}
    for i, (n, d, a) in enumerate([
        ("Breakfast Bundle 20% Off", 20, "lapsed"),
        ("Free Drink with Combo", 15, "active"),
        ("$5 Off $25 Family Meal", 20, "family"),
        ("Late-Night Snack 2-for-1", 50, "young_adult"),
        ("VIP Whale Bonus Points 3x", 0, "whale"),
        ("Birthday Treat", 100, "all"),
        ("Weekday Lunch Pass", 10, "office"),
        ("Refer a Friend $5", 0, "all"),
        ("Weekend Brunch BOGO", 50, "lapsed"),
        ("Loyalty Tier Upgrade", 0, "high"),
        ("App Order First-Time 25%", 25, "new"),
        ("Sunday Family Dinner", 15, "family"),
    ], start=1)
]
spark.createDataFrame(offers).write.mode("overwrite").saveAsTable("offers")

# member_segments — simple bucket per member
spark.sql("""
CREATE OR REPLACE TABLE member_segments AS
SELECT member_id,
  CASE
    WHEN spend_band='whale' THEN 'Whale'
    WHEN lifetime_spend > 800 THEN 'Loyal'
    WHEN datediff(current_date(), to_date(join_date)) < 60 THEN 'New'
    WHEN lifetime_spend < 50 THEN 'Lapsed'
    ELSE 'Active'
  END AS segment
FROM loyalty_members
""")
