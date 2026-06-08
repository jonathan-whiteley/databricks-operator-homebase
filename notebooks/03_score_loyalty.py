# Databricks notebook source
# notebooks/03_score_loyalty.py
# COMMAND ----------
CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "retail_consumer_goods"
SCHEMA  = dbutils.widgets.get("schema")  if "schema"  in dbutils.widgets.getAll() else "tth_ops_homebase"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"USE SCHEMA {SCHEMA}")

spark.sql("""
CREATE OR REPLACE TABLE churn_predictions AS
WITH last_visit AS (
  SELECT member_id, max(ts) AS last_ts, count(*) AS visit_count, sum(amount) AS total_spend
  FROM transactions
  GROUP BY member_id
)
SELECT
  m.member_id,
  lv.last_ts,
  lv.visit_count,
  lv.total_spend,
  -- rule-based churn probability: recency-weighted, mixed with low spend
  least(0.99,
    coalesce(datediff(current_date(), to_date(lv.last_ts)) / 90.0, 1.0) * 0.6 +
    (CASE WHEN lv.total_spend < 50 THEN 0.3 ELSE 0.0 END) +
    (rand(42) * 0.1)
  ) AS churn_probability,
  -- predicted CLV ~ trailing 6mo extrapolated 12mo, capped
  least(5000.0, coalesce(lv.total_spend, 0) * 2.0) AS predicted_clv
FROM loyalty_members m
LEFT JOIN last_visit lv USING (member_id)
""")
