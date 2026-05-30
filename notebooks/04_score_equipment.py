# Databricks notebook source
# notebooks/04_score_equipment.py
# COMMAND ----------
CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "jdub_demo"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql("USE SCHEMA lakehouse_market")

spark.sql("""
CREATE OR REPLACE TABLE rul_predictions AS
WITH agg AS (
  SELECT equipment_id,
    avg(vibration) AS avg_vib,
    max(vibration) AS max_vib,
    avg(temperature) AS avg_temp
  FROM equipment_telemetry
  GROUP BY equipment_id
)
SELECT
  e.equipment_id,
  -- predicted failure date: closer if more runtime hours + high vibration
  date_add(current_date(), greatest(1, cast(60 - (e.runtime_hours/200) - (a.max_vib*4) AS INT))) AS predicted_failure_date,
  -- health score 0-100 (higher = healthier)
  greatest(5.0, 100 - (e.runtime_hours/100.0) - (a.avg_vib*8) - (greatest(0, a.avg_temp - 100)/4.0)) AS health_score,
  greatest(1, cast(60 - (e.runtime_hours/200) - (a.max_vib*4) AS INT)) AS rul_days
FROM equipment e
LEFT JOIN agg a USING (equipment_id)
""")
