# Databricks notebook source
# notebooks/05_label_reviews.py
# COMMAND ----------
# MAGIC %pip install databricks-sdk pandas

# COMMAND ----------
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import ChatMessage, ChatMessageRole
import json, time
w = WorkspaceClient()

CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "main"
SCHEMA  = dbutils.widgets.get("schema")  if "schema"  in dbutils.widgets.getAll() else "lakehouse_market"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"USE SCHEMA {SCHEMA}")

# Generate realistic review text for each review_id, then label sentiment + topics.
# Notebook 01 seeds reviews.text as "placeholder-review-{id}"; this step replaces
# it with human-sounding text keyed to the rating and the assigned topics, so the
# app's Guest Feedback inbox and the AI digest read real prose, not placeholders.
reviews_pd = spark.table("reviews").select("review_id", "rating").toPandas()

SENTIMENT_BY_RATING = {1: "negative", 2: "negative", 3: "neutral", 4: "positive", 5: "positive"}
TOPIC_POOL = ["service speed", "food quality", "cleanliness", "value", "app experience"]

# Topic-specific phrasing by sentiment. Rule-based (FM-shaped output without
# burning tokens); swap to a real FM call in a follow-up if desired.
TOPIC_PHRASES = {
    "service speed": {
        "positive": ["in and out in no time", "the line moved fast", "order was ready almost immediately"],
        "neutral":   ["the wait was about what I expected", "service was reasonably quick"],
        "negative":  ["waited way too long for my order", "the line barely moved", "slow service even though it was quiet"],
    },
    "food quality": {
        "positive": ["the food was fresh and hot", "everything tasted great", "best meal I've had here in a while"],
        "neutral":   ["food was fine, nothing special", "tasted about average"],
        "negative":  ["my order was cold", "the food tasted stale", "quality has really gone downhill"],
    },
    "cleanliness": {
        "positive": ["the store was spotless", "tables were clean and the place looked great"],
        "neutral":   ["the store was reasonably tidy", "cleanliness was okay"],
        "negative":  ["the tables were dirty", "the dining area needed a serious cleaning", "restroom was a mess"],
    },
    "value": {
        "positive": ["great value for the price", "portion sizes were generous for what I paid"],
        "neutral":   ["prices were about average", "fair value overall"],
        "negative":  ["overpriced for what you get", "portions were small for the price"],
    },
    "app experience": {
        "positive": ["ordering on the app was smooth", "the app made pickup really easy"],
        "neutral":   ["the app worked well enough", "app was okay to use"],
        "negative":  ["the app crashed while I was ordering", "my mobile order was wrong", "the app is clunky and hard to use"],
    },
}
OPENERS = {
    "positive": ["Great experience.", "Really happy with this visit.", "Loved it."],
    "neutral":  ["Decent visit.", "It was okay.", "Nothing to complain about."],
    "negative": ["Disappointing visit.", "Not happy this time.", "Expected better."],
}

# rule-based as primary (FM-shaped output without burning tokens). Swap to real FM in a follow-up if desired.
import random
random.seed(42)
sent_rows = []
topic_rows = []
text_rows = []
for r in reviews_pd.itertuples():
    rid = int(r.review_id)
    s = SENTIMENT_BY_RATING[r.rating]
    score = {"negative": -0.7, "neutral": 0.0, "positive": 0.7}[s] + random.uniform(-0.2, 0.2)
    sent_rows.append({"review_id": rid, "sentiment": s, "sentiment_score": float(score)})
    n_topics = random.choice([1, 2, 3])
    chosen = random.sample(TOPIC_POOL, n_topics)
    for t in chosen:
        topic_rows.append({"review_id": rid, "topic": t, "weight": float(random.uniform(0.3, 1.0))})
    # Compose review text from the opener plus one phrase per assigned topic.
    parts = [random.choice(OPENERS[s])]
    for t in chosen:
        parts.append(random.choice(TOPIC_PHRASES[t][s]).capitalize() + ".")
    text_rows.append({"review_id": rid, "text": " ".join(parts)})

spark.createDataFrame(sent_rows).write.mode("overwrite").saveAsTable("review_sentiment")
spark.createDataFrame(topic_rows).write.mode("overwrite").saveAsTable("review_topics")

# Replace the placeholder review text with the generated prose via a MERGE on review_id.
text_df = spark.createDataFrame(text_rows)
text_df.createOrReplaceTempView("_review_text")
spark.sql(
    "MERGE INTO reviews t USING _review_text s ON t.review_id = s.review_id "
    "WHEN MATCHED THEN UPDATE SET t.text = s.text"
)
print("updated review text for", len(text_rows), "reviews")
