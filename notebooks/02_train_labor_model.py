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

CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "main"
SCHEMA  = dbutils.widgets.get("schema")  if "schema"  in dbutils.widgets.getAll() else "lakehouse_market"
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

# COMMAND ----------
# Derive per-daypart linear coefficients from the fitted pipeline by probing it
# at revenue 0 and 1000, then persist for the app's in-process /recommend.
# (The app reads this table instead of calling a Model Serving endpoint.)
import pandas as pd

DAYPARTS = ["Breakfast", "Lunch", "Dinner", "Late"]
coef_rows = []
for dp in DAYPARTS:
    probe = pd.DataFrame(
        {"forecast_revenue": [0.0, 1000.0], "daypart": [dp, dp]}
    )
    y0, y1 = pipe.predict(probe)
    base = float(y0)
    per_dollar = float((y1 - y0) / 1000.0)
    coef_rows.append((dp, base, per_dollar))

coef_df = spark.createDataFrame(coef_rows, schema="daypart string, base double, per_dollar double")
coef_df.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.labor_model_coefficients")
print("wrote", CATALOG + "." + SCHEMA + ".labor_model_coefficients:", coef_rows)
