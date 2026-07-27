# Databricks notebook source
"""
Ensures the Lakehouse Market · Homebase Genie space exists and is current.

Idempotent:
  - If `space_id` widget is set (or env GENIE_SPACE_ID is non-empty),
    PATCHes that space with the spec defined below.
  - Otherwise CREATEs a new space and prints the new id. Capture it and
    set `GENIE_SPACE_ID` env on the App so future deploys are idempotent.

DAB has no first-class GenieSpace resource yet, so this notebook is the
artifact that keeps the space declarative. Lifted from the labor-iq
06_ensure_genie_space.py pattern (proto schema: version 2, sorted ids).
"""

# COMMAND ----------
# MAGIC %pip install --quiet --upgrade "databricks-sdk>=0.40"

# COMMAND ----------
# MAGIC %restart_python

# COMMAND ----------

import json
import os
from uuid import uuid4

from databricks.sdk import WorkspaceClient

# Widgets (CLI / job parameters) — fall back to env or the demo defaults.
try:
    dbutils.widgets.text("catalog", "", "Unity Catalog catalog")
    dbutils.widgets.text("schema", "", "Schema within catalog")
    dbutils.widgets.text("warehouse_id", "", "SQL warehouse id for the Genie space")
    dbutils.widgets.text("genie_space_title", "", "Title for the Genie space")
except NameError:
    pass

def _widget(name: str, default: str) -> str:
    try:
        v = dbutils.widgets.get(name).strip()
        if v:
            return v
    except Exception:
        pass
    return os.getenv(name.upper(), default)

CATALOG = _widget("catalog", "main")
SCHEMA = _widget("schema", "lakehouse_market")
WAREHOUSE_ID = _widget("warehouse_id", "")
if not WAREHOUSE_ID:
    raise RuntimeError("warehouse_id widget / WAREHOUSE_ID env must be set for Genie space creation")
TITLE = _widget("genie_space_title", "lhm-ops-assistant")
DESCRIPTION = (
    "Operations assistant for Lakehouse Market store managers. Answers questions about "
    "labor forecasts, loyalty members, supply chain, sentiment, and equipment maintenance "
    "for a single store. Powers the Ask Genie panel on every tab of the Homebase app."
)

INSTRUCTIONS = (
    "You are answering questions from a Lakehouse Market store manager who is using "
    "the Homebase operations console. The user always cares about THEIR STORE. "
    "When the user asks a question, scope the answer to the store_id provided in "
    "the context blurb (e.g. 'tab=Labor, store_id=42'). If no store_id appears, "
    "default to comparison-friendly answers. Day-parts are exactly: Breakfast, Lunch, "
    "Dinner, Late. The five operational domains correspond to tabs: Labor (forecasts, "
    "headcount, schedules), Loyalty (members, offers, churn, CLV), Supply Chain "
    "(inventory, reorders, suppliers), Sentiment (reviews, ratings, topics), and "
    "Maintenance (equipment, RUL, work orders). When asked about 'this week' or "
    "'today', anchor to data's most recent date in the relevant table since the "
    "synthetic dataset has a fixed end-of-window (2025-10-30)."
)

SAMPLE_QUESTIONS = [
    "Why is lunch headcount higher than last Tuesday at my store?",
    "Which members at my store haven't visited in 30 days but spent $500+ last quarter?",
    "What SKUs am I likely to run out of this week at my store?",
    "What's the top complaint this week in reviews of my store?",
    "Which equipment at my store is most likely to fail this week?",
    "How does my store's labor % compare to nearby stores last Friday?",
    "Which offer drove the most redemptions at my store last month?",
    "Show me the worst-rated reviews of my store from the last 14 days",
]

EXAMPLE_SQLS = [
    {
        "title": "Top 5 most at-risk members at my store",
        "sql": (
            "SELECT m.member_id, m.lifetime_spend, cp.churn_probability, cp.predicted_clv "
            f"FROM {CATALOG}.{SCHEMA}.loyalty_members m "
            f"JOIN {CATALOG}.{SCHEMA}.churn_predictions cp USING (member_id) "
            "WHERE m.preferred_store_id = 1 AND cp.churn_probability > 0.7 "
            "ORDER BY cp.predicted_clv DESC LIMIT 5"
        ),
    },
    {
        "title": "Forecast revenue by day-part for the most recent date at a store",
        "sql": (
            "WITH latest AS (SELECT MAX(date) AS d FROM "
            f"{CATALOG}.{SCHEMA}.daily_sales_forecast WHERE store_id = 1) "
            "SELECT daypart, forecast_revenue "
            f"FROM {CATALOG}.{SCHEMA}.daily_sales_forecast "
            "WHERE store_id = 1 AND date = (SELECT d FROM latest) "
            "ORDER BY CASE daypart WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2 "
            "WHEN 'Dinner' THEN 3 ELSE 4 END"
        ),
    },
    {
        "title": "Equipment most likely to fail in the next 7 days at a store",
        "sql": (
            "SELECT e.equipment_id, e.category, e.model, rp.health_score, rp.rul_days "
            f"FROM {CATALOG}.{SCHEMA}.equipment e "
            f"JOIN {CATALOG}.{SCHEMA}.rul_predictions rp USING (equipment_id) "
            "WHERE e.store_id = 1 AND rp.rul_days <= 7 "
            "ORDER BY rp.rul_days ASC"
        ),
    },
    {
        "title": "Top-3 negative review topics at a store last 14 days",
        "sql": (
            "WITH anchor AS (SELECT MAX(ts) AS m FROM "
            f"{CATALOG}.{SCHEMA}.reviews WHERE store_id = 1) "
            "SELECT rt.topic, COUNT(*) AS mentions "
            f"FROM {CATALOG}.{SCHEMA}.reviews r "
            f"JOIN {CATALOG}.{SCHEMA}.review_topics rt USING (review_id) "
            f"JOIN {CATALOG}.{SCHEMA}.review_sentiment rs USING (review_id) "
            "WHERE r.store_id = 1 "
            "AND r.ts > (SELECT m FROM anchor) - INTERVAL 14 DAYS "
            "AND rs.sentiment = 'negative' "
            "GROUP BY rt.topic ORDER BY mentions DESC LIMIT 3"
        ),
    },
    {
        "title": "SKUs below reorder point at a store",
        "sql": (
            "WITH latest AS (SELECT store_id, sku_id, on_hand, "
            "row_number() OVER (PARTITION BY store_id, sku_id "
            "ORDER BY snapshot_date DESC) AS rn "
            f"FROM {CATALOG}.{SCHEMA}.inventory_snapshots) "
            "SELECT l.sku_id, sk.sku_name, l.on_hand, sk.reorder_point "
            "FROM latest l "
            f"JOIN {CATALOG}.{SCHEMA}.skus sk USING (sku_id) "
            "WHERE l.store_id = 1 AND l.rn = 1 AND l.on_hand < sk.reorder_point "
            "ORDER BY l.on_hand ASC LIMIT 20"
        ),
    },
]

TABLES = [
    f"{CATALOG}.{SCHEMA}.stores",
    f"{CATALOG}.{SCHEMA}.daily_sales_forecast",
    f"{CATALOG}.{SCHEMA}.hourly_transactions",
    f"{CATALOG}.{SCHEMA}.staff_roster",
    f"{CATALOG}.{SCHEMA}.loyalty_members",
    f"{CATALOG}.{SCHEMA}.transactions",
    f"{CATALOG}.{SCHEMA}.offers",
    f"{CATALOG}.{SCHEMA}.member_segments",
    f"{CATALOG}.{SCHEMA}.churn_predictions",
    f"{CATALOG}.{SCHEMA}.skus",
    f"{CATALOG}.{SCHEMA}.inventory_snapshots",
    f"{CATALOG}.{SCHEMA}.suppliers",
    f"{CATALOG}.{SCHEMA}.purchase_orders",
    f"{CATALOG}.{SCHEMA}.demand_forecast",
    f"{CATALOG}.{SCHEMA}.reviews",
    f"{CATALOG}.{SCHEMA}.review_sentiment",
    f"{CATALOG}.{SCHEMA}.review_topics",
    f"{CATALOG}.{SCHEMA}.equipment",
    f"{CATALOG}.{SCHEMA}.equipment_telemetry",
    f"{CATALOG}.{SCHEMA}.rul_predictions",
    f"{CATALOG}.{SCHEMA}.work_orders",
]


def build_serialized_space() -> dict:
    """Build the version-2 Genie serialized_space proto."""
    example_sqls = sorted(
        [
            {"id": uuid4().hex, "question": [e["title"]], "sql": [e["sql"]]}
            for e in EXAMPLE_SQLS
        ],
        key=lambda x: x["id"],
    )
    sample_qs = sorted(
        [{"id": uuid4().hex, "question": [q]} for q in SAMPLE_QUESTIONS],
        key=lambda x: x["id"],
    )
    return {
        "version": 2,
        "data_sources": {
            "tables": sorted(
                [{"identifier": t} for t in TABLES],
                key=lambda x: x["identifier"],
            )
        },
        "instructions": {
            "text_instructions": [
                {"id": uuid4().hex, "content": [INSTRUCTIONS]}
            ],
            "example_question_sqls": example_sqls,
        },
        "config": {"sample_questions": sample_qs},
    }


# COMMAND ----------

try:
    dbutils.widgets.text("space_id", "", "Existing space ID (leave blank to create)")
except NameError:
    pass

space_id = ""
try:
    space_id = dbutils.widgets.get("space_id").strip()
except Exception:
    pass
if not space_id:
    space_id = os.getenv("GENIE_SPACE_ID", "").strip()

try:
    dbutils.widgets.text("app_sp_id", "", "App service principal client id (for CAN_RUN grant)")
except NameError:
    pass
app_sp_id = ""
try:
    app_sp_id = dbutils.widgets.get("app_sp_id").strip()
except Exception:
    pass

w = WorkspaceClient()
payload = {
    "title": TITLE,
    "description": DESCRIPTION,
    "warehouse_id": WAREHOUSE_ID,
    "serialized_space": json.dumps(build_serialized_space()),
}

if space_id:
    print(f"Patching existing Genie space {space_id} ...")
    resp = w.api_client.do(
        "PATCH",
        f"/api/2.0/genie/spaces/{space_id}",
        body=payload,
    )
    print(f"Patched: {resp.get('title')} ({resp.get('space_id')})")
else:
    print("Creating new Genie space ...")
    resp = w.api_client.do("POST", "/api/2.0/genie/spaces", body=payload)
    new_id = resp.get("space_id")
    print(f"Created: {resp.get('title')} ({new_id})")
    print()
    print(f"  Set this on the App as GENIE_SPACE_ID: {new_id}")
    print(f"  URL: {w.config.host}/genie/rooms/{new_id}")

# COMMAND ----------
# Self-wire: persist the space id so the app resolves it from UC (no hardcoded
# id, no post-run app.yaml rewrite), and grant the App SP CAN_RUN on the space.
resolved_id = resp.get("space_id") or resp.get("id") or space_id
if not resolved_id:
    raise RuntimeError(f"Could not resolve space id from response: {resp!r}")

spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"USE SCHEMA {SCHEMA}")
spark.sql(
    "CREATE TABLE IF NOT EXISTS app_config "
    "(config_key STRING, config_value STRING) USING DELTA"
)
spark.sql(
    "MERGE INTO app_config t "
    f"USING (SELECT 'genie_space_id' AS k, '{resolved_id}' AS v) s "
    "ON t.config_key = s.k "
    "WHEN MATCHED THEN UPDATE SET t.config_value = s.v "
    "WHEN NOT MATCHED THEN INSERT (config_key, config_value) VALUES (s.k, s.v)"
)
print(f"app_config.genie_space_id = {resolved_id}")

if app_sp_id:
    w.api_client.do(
        "PUT",
        f"/api/2.0/permissions/genie/{resolved_id}",
        body={
            "access_control_list": [
                {"service_principal_name": app_sp_id, "permission_level": "CAN_RUN"}
            ]
        },
    )
    print(f"Granted CAN_RUN on space {resolved_id} to SP {app_sp_id}")
else:
    print("No app_sp_id provided; skipping CAN_RUN grant (bootstrap will handle it).")
