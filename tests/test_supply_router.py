# tests/test_supply_router.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import supply as sup_mod


def test_supply_reorder_queue(monkeypatch):
    monkeypatch.setattr(sup_mod, "fetch_all", lambda *_a, **_k: [
        {"sku_id": 12, "sku_name": "SKU-0012", "on_hand": 4, "reorder_point": 20, "days_of_cover": 1.3,
         "supplier_id": 3, "supplier_name": "X Foods #3", "supplier_on_time_pct": 0.92}
    ])
    r = TestClient(app).get("/api/supply/reorder-queue?store_id=1")
    assert r.status_code == 200
    assert r.json()[0]["sku_id"] == 12


def test_supply_tomorrow_deliveries(monkeypatch):
    monkeypatch.setattr(sup_mod, "fetch_all", lambda *_a, **_k: [
        {"po_id": 10500, "sku_id": 12, "supplier_id": 3, "supplier_name": "X Foods #3",
         "ordered_qty": 30, "expected_date": "2025-10-30"}
    ])
    r = TestClient(app).get("/api/supply/tomorrow-deliveries?store_id=1&date=2025-10-29")
    assert r.status_code == 200
    assert r.json()[0]["po_id"] == 10500
