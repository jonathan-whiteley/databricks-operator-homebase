# Databricks notebook source
# notebooks/04_score_equipment.py
# COMMAND ----------
CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "retail_consumer_goods"
SCHEMA  = dbutils.widgets.get("schema")  if "schema"  in dbutils.widgets.getAll() else "tth_ops_homebase"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"USE SCHEMA {SCHEMA}")

spark.sql("""
CREATE OR REPLACE TABLE rul_predictions AS
WITH agg AS (
  SELECT equipment_id,
    avg(vibration) AS avg_vib,
    max(vibration) AS max_vib,
    avg(temperature) AS avg_temp,
    max(temperature) AS max_temp
  FROM equipment_telemetry
  GROUP BY equipment_id
)
SELECT
  e.equipment_id,
  -- predicted failure date: closer if more runtime hours + high vibration
  date_add(current_date(), greatest(1, cast(60 - (e.runtime_hours/200) - (a.max_vib*4) AS INT))) AS predicted_failure_date,
  -- health score 0-100 (higher = healthier).
  -- Penalize drift OVER the asset's category-specific target_temp_max (so an
  -- oven at 350°F isn't flagged just for being hot, and a fridge at 50°F is).
  greatest(
    5.0,
    100
      - (e.runtime_hours / 100.0)
      - (a.avg_vib * 8)
      - (greatest(0, a.max_temp - e.target_temp_max) / 1.5)
  ) AS health_score,
  greatest(1, cast(60 - (e.runtime_hours/200) - (a.max_vib*4) AS INT)) AS rul_days
FROM equipment e
LEFT JOIN agg a USING (equipment_id)
""")
