# tests/test_maintenance_router.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import maintenance as m_mod


def test_at_risk_equipment(monkeypatch):
    monkeypatch.setattr(m_mod, "fetch_all", lambda *_a, **_k: [
        {"equipment_id": 11, "category": "Fryer", "model": "Fryer-1234", "runtime_hours": 4200,
         "health_score": 38.2, "rul_days": 7, "predicted_failure_date": "2025-11-05"}
    ])
    r = TestClient(app).get("/api/maintenance/at-risk?store_id=1")
    assert r.status_code == 200
    assert r.json()[0]["rul_days"] == 7


def test_telemetry(monkeypatch):
    monkeypatch.setattr(m_mod, "fetch_all", lambda *_a, **_k: [
        {"ts": "2025-10-28 09:00:00", "temperature": 175.0, "vibration": 3.2, "runtime_hours_delta": 0.7}
    ])
    r = TestClient(app).get("/api/maintenance/telemetry?equipment_id=11&days=14")
    assert r.status_code == 200
    assert r.json()[0]["vibration"] == 3.2
