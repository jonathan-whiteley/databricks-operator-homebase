# Databricks notebook source
# notebooks/02_train_labor_model.py
# COMMAND ----------
# MAGIC %pip install scikit-learn mlflow

# COMMAND ----------
import mlflow
from mlflow.models import infer_signature
from sklearn.linear_model import ElasticNet
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
import pandas as pd

CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "retail_consumer_goods"
SCHEMA  = dbutils.widgets.get("schema")  if "schema"  in dbutils.widgets.getAll() else "tth_ops_homebase"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"USE SCHEMA {SCHEMA}")

# Build training set: forecast_revenue + daypart → headcount (synthetic ground truth)
df = spark.sql("""
SELECT forecast_revenue, daypart,
  -- synthetic label: 1 person per $350 of revenue + daypart adjustment
  cast(round(forecast_revenue/350.0 + CASE daypart
    WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 3 WHEN 'Dinner' THEN 2 ELSE 0 END
  ) AS INT) AS headcount
FROM daily_sales_forecast
""").toPandas()

pre = ColumnTransformer([("dp", OneHotEncoder(), ["daypart"])], remainder="passthrough")
pipe = Pipeline([("pre", pre), ("reg", ElasticNet(alpha=0.05))])

mlflow.set_experiment("/Shared/lhm-labor-recommender")
with mlflow.start_run() as run:
    X = df[["forecast_revenue", "daypart"]]
    y = df["headcount"]
    pipe.fit(X, y)
    preds = pipe.predict(X.head(5))
    signature = infer_signature(X.head(5), preds)
    mlflow.sklearn.log_model(
        pipe,
        artifact_path="model",
        registered_model_name=f"{CATALOG}.{SCHEMA}.lhm_labor_recommender",
        signature=signature,
        input_example=X.head(2),
    )
    print("trained run", run.info.run_id)
