# tests/test_meta_router.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import meta as meta_mod


def test_stores_returns_list(monkeypatch):
    monkeypatch.setattr(meta_mod, "fetch_all", lambda *_a, **_k: [
        {"store_id": 1, "store_name": "Lakehouse Market #001", "city": "Oakland", "state": "CA", "lat": 37.8, "lon": -122.3},
        {"store_id": 2, "store_name": "Lakehouse Market #002", "city": "Fresno", "state": "CA", "lat": 36.7, "lon": -119.8},
    ])
    r = TestClient(app).get("/api/stores")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["store_id"] == 1
