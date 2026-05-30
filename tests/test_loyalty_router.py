# tests/test_loyalty_router.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import loyalty as loy_mod

KPI_ROWS = [{"active_members": 1820, "spend_30d": 48210.25, "at_risk_count": 142, "redemption_pct": 0.18}]
MEMBER_ROWS = [{"member_id": 7, "preferred_store_id": 1, "lifetime_spend": 920.5, "churn_probability": 0.78,
                "predicted_clv": 1840.0, "segment": "Loyal", "lat": 37.81, "lon": -122.27}]
MAP_ROWS = [{"member_id": 7, "lat": 37.81, "lon": -122.27, "tier": "at_risk"}]


def test_loyalty_kpis(monkeypatch):
    monkeypatch.setattr(loy_mod, "fetch_all", lambda sql, params=None: KPI_ROWS)
    r = TestClient(app).get("/api/loyalty/kpis?store_id=1")
    assert r.status_code == 200
    assert r.json()["active_members"] == 1820


def test_loyalty_at_risk(monkeypatch):
    monkeypatch.setattr(loy_mod, "fetch_all", lambda sql, params=None: MEMBER_ROWS)
    r = TestClient(app).get("/api/loyalty/at-risk?store_id=1&limit=10")
    assert r.status_code == 200
    assert r.json()[0]["churn_probability"] == 0.78


def test_loyalty_map(monkeypatch):
    monkeypatch.setattr(loy_mod, "fetch_all", lambda sql, params=None: MAP_ROWS)
    r = TestClient(app).get("/api/loyalty/map?store_id=1")
    assert r.status_code == 200
    assert r.json()[0]["tier"] == "at_risk"
