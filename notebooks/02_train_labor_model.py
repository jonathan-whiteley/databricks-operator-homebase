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

X = df[["forecast_revenue", "daypart"]]
y = df["headcount"]
pipe.fit(X, y)
print("model fitted on", len(df), "rows")

# COMMAND ----------
# Derive per-daypart linear coefficients from the fitted pipeline by probing it
# at revenue 0 and 1000, then persist for the app's in-process /recommend.
# The app reads THIS table (not a Model Serving endpoint), so this write is the
# critical path: it runs BEFORE model registration so an MLflow/serialization
# quirk can never block the app's labor recommendation.
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

# COMMAND ----------
# Register the model to Unity Catalog for MLflow lineage. This is best-effort:
# the app does not call this model (it reads labor_model_coefficients above), so
# a registration failure must not fail the job. Use cloudpickle serialization to
# avoid the skops "untrusted types" rejection of ColumnTransformer(passthrough).
mlflow.set_registry_uri("databricks-uc")
mlflow.set_experiment("/Shared/lhm-labor-recommender")
try:
    with mlflow.start_run() as run:
        signature = infer_signature(X.head(5), pipe.predict(X.head(5)))
        mlflow.sklearn.log_model(
            pipe,
            artifact_path="model",
            serialization_format="cloudpickle",
            registered_model_name=f"{CATALOG}.{SCHEMA}.lhm_labor_recommender",
            signature=signature,
            input_example=X.head(2),
        )
        print("registered model, run", run.info.run_id)
except Exception as e:
    print(f"model registration skipped (non-fatal, app uses coefficients table): {e}")
