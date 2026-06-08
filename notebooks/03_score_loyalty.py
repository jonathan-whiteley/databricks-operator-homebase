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
),
anchor AS (
  -- Synthetic transactions end 2025-10-30. Use that as "today" so the
  -- churn distribution stays stable regardless of when the notebook runs.
  SELECT max(ts) AS d FROM transactions
)
SELECT
  m.member_id,
  lv.last_ts,
  lv.visit_count,
  lv.total_spend,
  -- Recency-weighted churn probability, calibrated against the synthetic
  -- visit distribution (p50 = 12d since last visit, p75 = 25d, p95 = 54d)
  -- so the at-risk segment (>0.7) lands at roughly 15-25% — realistic, not
  -- a sea of red on the members map.
  least(
    0.99,
    greatest(
      0.0,
      least(1.0, coalesce(datediff(to_date((SELECT d FROM anchor)), to_date(lv.last_ts)) / 35.0, 0.95))
        + (CASE WHEN lv.total_spend < 50 THEN 0.08 ELSE 0.0 END)
        + ((rand(42) - 0.5) * 0.14)
        - 0.15
    )
  ) AS churn_probability,
  -- predicted CLV ~ trailing 6mo extrapolated 12mo, capped
  least(5000.0, coalesce(lv.total_spend, 0) * 2.0) AS predicted_clv
FROM loyalty_members m
LEFT JOIN last_visit lv USING (member_id)
""")
