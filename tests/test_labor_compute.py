# tests/test_labor_compute.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import labor as labor_mod


def test_compute_headcount_uses_coefficients(monkeypatch):
    # base + per_dollar * revenue, rounded. Lunch: base 3, per_dollar 1/350.
    monkeypatch.setattr(
        labor_mod, "_load_coefficients",
        lambda: {"Lunch": (3.0, 1.0 / 350.0)},
    )
    # 3 + 3500/350 = 3 + 10 = 13
    assert labor_mod.compute_headcount(3500.0, "Lunch") == 13


def test_compute_headcount_falls_back_when_no_table(monkeypatch):
    # No coefficients table -> heuristic: round(revenue/350 + daypart_offset)
    monkeypatch.setattr(labor_mod, "_load_coefficients", lambda: {})
    # Dinner offset = 2; 2800/350 = 8; total 10
    assert labor_mod.compute_headcount(2800.0, "Dinner") == 10


def test_recommend_route_returns_headcount(monkeypatch):
    monkeypatch.setattr(labor_mod, "_load_coefficients", lambda: {})
    r = TestClient(app).post(
        "/api/labor/recommend",
        json={"forecast_revenue": 3500, "daypart": "Lunch"},
    )
    assert r.status_code == 200
    # heuristic Lunch offset = 3; 3500/350 = 10; total 13
    assert r.json()["headcount"] == 13
