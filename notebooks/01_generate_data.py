# Databricks notebook source
# notebooks/01_generate_data.py
# COMMAND ----------
# MAGIC %pip install dbldatagen mimesis polars

# COMMAND ----------
import dbldatagen as dg
import numpy as np
from pyspark.sql import functions as F
from pyspark.sql.types import *
from mimesis import Address, Person
from _gen_lib import DAYPART_LABELS, SEED, STORE_COUNT
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

# COMMAND ----------
SKU_COUNT = 800
SUPPLIER_COUNT = 30

# suppliers — Mimesis names + reliability score
sup_rows = []
for sid in range(1, SUPPLIER_COUNT + 1):
    sup_rows.append({
        "supplier_id": sid,
        "name": f"{addr.country()} Foods #{sid}",
        "reliability_score": round(random.uniform(0.78, 0.99), 3),
        "avg_lead_days": random.randint(2, 14),
        "on_time_pct": round(random.uniform(0.7, 0.99), 3),
    })
spark.createDataFrame(sup_rows).write.mode("overwrite").saveAsTable("suppliers")

# skus
sku_rows = []
categories = ["Produce", "Protein", "Dairy", "Bakery", "Beverage", "Packaging", "Cleaning"]
for sku in range(1, SKU_COUNT + 1):
    sku_rows.append({
        "sku_id": sku,
        "sku_name": f"SKU-{sku:04d}",
        "category": random.choice(categories),
        "unit": random.choice(["case", "lb", "ea", "gal"]),
        "supplier_id": random.randint(1, SUPPLIER_COUNT),
        "reorder_point": random.randint(8, 60),
        "case_cost": round(random.uniform(4.0, 75.0), 2),
    })
spark.createDataFrame(sku_rows).write.mode("overwrite").saveAsTable("skus")

# inventory_snapshots — last 90 days, per store per sku per day (limit volume by sampling)
inv = (
    dg.DataGenerator(spark, rows=STORE_COUNT * SKU_COUNT * 7, partitions=8)  # weekly snapshots
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("sku_id", "int", minValue=1, maxValue=SKU_COUNT, random=True)
    .withColumn("snapshot_date", "date", begin="2025-09-01", end="2025-10-30")
    .withColumn("on_hand", "int", minValue=0, maxValue=180, random=True)
    .build()
)
inv.write.mode("overwrite").saveAsTable("inventory_snapshots")

# purchase_orders (historical, pre-app)
po = (
    dg.DataGenerator(spark, rows=4000, partitions=4)
    .withColumn("po_id", "int", minValue=10000, maxValue=14000)
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("sku_id", "int", minValue=1, maxValue=SKU_COUNT, random=True)
    .withColumn("supplier_id", "int", minValue=1, maxValue=SUPPLIER_COUNT, random=True)
    .withColumn("ordered_qty", "int", minValue=5, maxValue=80, random=True)
    .withColumn("expected_date", "date", begin="2025-10-01", end="2025-11-15")
    .withColumn("status", "string", values=["received", "in_transit", "scheduled"], random=True)
    .build()
)
po.write.mode("overwrite").saveAsTable("purchase_orders")

# demand_forecast — per store / sku / week, next 4 weeks
df = (
    dg.DataGenerator(spark, rows=STORE_COUNT * SKU_COUNT * 4, partitions=8)
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("sku_id", "int", minValue=1, maxValue=SKU_COUNT, random=True)
    .withColumn("week_start", "date", begin="2025-10-27", end="2025-11-17")
    .withColumn("forecast_units", "int", minValue=2, maxValue=50, random=True)
    .build()
)
df.write.mode("overwrite").saveAsTable("demand_forecast")

# COMMAND ----------
# Reviews — 30k over 18mo, store-scoped
review_topics = ["service speed", "food quality", "cleanliness", "value", "app experience"]
rev_rows = []
for rid in range(1, 30_001):
    sid = random.randint(1, STORE_COUNT)
    rating = random.choices([1,2,3,4,5], weights=[8, 8, 18, 30, 36])[0]
    rev_rows.append({
        "review_id": rid,
        "store_id": sid,
        "ts": str(date(2024, 5, 1) + timedelta(days=random.randint(0, 540))),
        "source": random.choice(["google", "yelp", "app"]),
        "rating": rating,
        "text": f"placeholder-review-{rid}",  # real text generated by FM labeling step (notebook 05)
    })
spark.createDataFrame(rev_rows).write.mode("overwrite").saveAsTable("reviews")

# review_sentiment + review_topics placeholders — populated by notebook 05
spark.sql("CREATE OR REPLACE TABLE review_sentiment (review_id BIGINT, sentiment STRING, sentiment_score DOUBLE)")
spark.sql("CREATE OR REPLACE TABLE review_topics (review_id BIGINT, topic STRING, weight DOUBLE)")

# COMMAND ----------
# Equipment — 5 categories per store, ~5 units each = ~625 units
eq_categories = ["Oven", "Fryer", "Refrigeration", "Espresso", "POS"]
eq_rows = []
unit = 0
for sid in range(1, STORE_COUNT + 1):
    for cat in eq_categories:
        for _ in range(random.randint(4, 6)):
            unit += 1
            eq_rows.append({
                "equipment_id": unit,
                "store_id": sid,
                "category": cat,
                "model": f"{cat}-{random.randint(1000,9999)}",
                "install_date": str(date(2022, 1, 1) + timedelta(days=random.randint(0, 1000))),
                "runtime_hours": random.randint(100, 9000),
            })
spark.createDataFrame(eq_rows).write.mode("overwrite").saveAsTable("equipment")

# equipment_telemetry — 14 days of hourly readings per unit (sampled to keep size sane)
telem = (
    dg.DataGenerator(spark, rows=len(eq_rows) * 14 * 6, partitions=8)
    .withColumn("equipment_id", "int", minValue=1, maxValue=unit, random=True)
    .withColumn("ts", "timestamp", begin="2025-10-15 00:00:00", end="2025-10-29 23:00:00")
    .withColumn("temperature", "double", minValue=20, maxValue=200, random=True)
    .withColumn("vibration", "double", minValue=0.1, maxValue=8.0, random=True)
    .withColumn("runtime_hours_delta", "double", minValue=0.0, maxValue=1.0, random=True)
    .build()
)
telem.write.mode("overwrite").saveAsTable("equipment_telemetry")

# work_orders (historical, pre-app)
wo = (
    dg.DataGenerator(spark, rows=500, partitions=2)
    .withColumn("work_order_id", "int", minValue=1, maxValue=500)
    .withColumn("equipment_id", "int", minValue=1, maxValue=unit, random=True)
    .withColumn("opened_date", "date", begin="2025-08-01", end="2025-10-29")
    .withColumn("status", "string", values=["open", "in_progress", "done"], random=True)
    .withColumn("issue", "string", values=["loud noise", "temp drift", "no power", "leak", "calibration"], random=True)
    .build()
)
wo.write.mode("overwrite").saveAsTable("work_orders")

# rul_predictions placeholder — populated by notebook 04
spark.sql("CREATE OR REPLACE TABLE rul_predictions (equipment_id BIGINT, predicted_failure_date DATE, health_score DOUBLE, rul_days INT)")
