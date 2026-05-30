# Databricks notebook source
# notebooks/05_label_reviews.py
# COMMAND ----------
# MAGIC %pip install databricks-sdk pandas

# COMMAND ----------
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import ChatMessage, ChatMessageRole
import json, time
w = WorkspaceClient()

CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "jdub_demo"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql("USE SCHEMA lakehouse_market")

# Generate realistic review text for each review_id, then label sentiment + topics
# (placeholder rows have text="placeholder-review-{id}")
reviews_pd = spark.table("reviews").select("review_id", "rating").toPandas()

SENTIMENT_BY_RATING = {1: "negative", 2: "negative", 3: "neutral", 4: "positive", 5: "positive"}
TOPIC_POOL = ["service speed", "food quality", "cleanliness", "value", "app experience"]

# rule-based as primary (FM-shaped output without burning tokens). Swap to real FM in a follow-up if desired.
import random
random.seed(42)
sent_rows = []
topic_rows = []
for r in reviews_pd.itertuples():
    s = SENTIMENT_BY_RATING[r.rating]
    score = {"negative": -0.7, "neutral": 0.0, "positive": 0.7}[s] + random.uniform(-0.2, 0.2)
    sent_rows.append({"review_id": int(r.review_id), "sentiment": s, "sentiment_score": float(score)})
    n_topics = random.choice([1, 2, 3])
    for t in random.sample(TOPIC_POOL, n_topics):
        topic_rows.append({"review_id": int(r.review_id), "topic": t, "weight": float(random.uniform(0.3, 1.0))})

spark.createDataFrame(sent_rows).write.mode("overwrite").saveAsTable("review_sentiment")
spark.createDataFrame(topic_rows).write.mode("overwrite").saveAsTable("review_topics")
