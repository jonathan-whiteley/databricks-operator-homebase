# tests/test_lakebase_migrate.py
from lakehouse_market.lakebase_migrate import SCHEMA_FILE


def test_schema_file_contains_all_five_tables():
    text = SCHEMA_FILE.read_text()
    for t in [
        "app_labor_overrides",
        "app_offer_pushes",
        "app_purchase_orders",
        "app_review_responses",
        "app_work_orders",
    ]:
        assert t in text
