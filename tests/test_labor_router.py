# tests/test_labor_router.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import labor as labor_mod


def test_today_returns_dayparts(monkeypatch):
    monkeypatch.setattr(labor_mod, "fetch_all", lambda *_a, **_k: [
        {"daypart": "Breakfast", "forecast_revenue": 1200.0, "forecast_transactions": 230},
        {"daypart": "Lunch", "forecast_revenue": 3400.0, "forecast_transactions": 510},
        {"daypart": "Dinner", "forecast_revenue": 2800.0, "forecast_transactions": 420},
        {"daypart": "Late", "forecast_revenue": 700.0, "forecast_transactions": 90},
    ])
    r = TestClient(app).get("/api/labor/today?store_id=1&date=2025-10-29")
    assert r.status_code == 200
    body = r.json()
    assert len(body["dayparts"]) == 4
    assert body["dayparts"][1]["daypart"] == "Lunch"


def test_recommend_returns_headcount(monkeypatch):
    def fake_invoke(_endpoint, payload):
        return {"predictions": [int(payload["dataframe_records"][0]["forecast_revenue"] / 350) + 2]}
    monkeypatch.setattr(labor_mod, "invoke_serving", fake_invoke)
    r = TestClient(app).post(
        "/api/labor/recommend",
        json={"forecast_revenue": 3500, "daypart": "Lunch"},
    )
    assert r.status_code == 200
    assert r.json()["headcount"] == 12  # 3500/350 + 2
