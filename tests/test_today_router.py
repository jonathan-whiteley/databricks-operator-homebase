# tests/test_today_router.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import today as today_mod


def test_today_brief_returns_payload(monkeypatch):
    # _sales_history pulls 7 day rows; the outstanding helpers each issue a
    # single count(*) query. fetch_all is invoked once per logical call; the
    # router doesn't introspect SQL strings so a single-fixture dispatch
    # keyed on the rendered SQL keeps the test legible.
    def fake_fetch_all(sql, _params=None):
        if "FROM daily_sales_forecast" in sql and "GROUP BY date" in sql:
            return [
                {"day": "2025-10-24", "rev": 14000.0},
                {"day": "2025-10-25", "rev": 14200.0},
                {"day": "2025-10-26", "rev": 13900.0},
                {"day": "2025-10-27", "rev": 14500.0},
                {"day": "2025-10-28", "rev": 13950.0},
                {"day": "2025-10-29", "rev": 14820.0},
                {"day": "2025-10-30", "rev": 16400.0},
            ]
        if "FROM inventory_snapshots" in sql:
            return [{"n": 3}]
        if "FROM equipment" in sql:
            return [{"n": 1}]
        if "FROM loyalty_members" in sql:
            return [{"n": 184}]
        if "FROM reviews" in sql:
            return [{"n": 7}]
        # labor proxy: day-part count
        if "FROM daily_sales_forecast" in sql:
            return [{"n": 4}]
        return []

    monkeypatch.setattr(today_mod, "fetch_all", fake_fetch_all)

    r = TestClient(app).get("/api/today/brief")
    assert r.status_code == 200, r.text
    body = r.json()
    for key in (
        "yesterday_revenue",
        "yesterday_delta_pct",
        "today_forecast",
        "kpis",
        "outstanding",
        "first_action",
    ):
        assert key in body, f"missing top-level key: {key}"
    assert body["today_forecast"] == 16400.0
    assert body["yesterday_revenue"] == 14820.0
    assert body["outstanding"]["inventory"] == 3
    assert body["outstanding"]["equipment"] == 1
    assert body["outstanding"]["members"] == 184
    assert body["outstanding"]["feedback"] == 7
    assert body["outstanding"]["labor"] == 4
    assert len(body["kpis"]) == 5
    assert body["first_action"]["module"] == "equipment"
