# tests/test_tab_writes.py
import pytest
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import loyalty, maintenance, sentiment, supply


class FakeConn:
    async def fetchrow(self, *a, **k):
        return {"id": 7}

    async def execute(self, *a, **k):
        return "OK"

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        pass


class FakePool:
    def acquire(self):
        return FakeConn()


@pytest.fixture(autouse=True)
def patch_pools(monkeypatch):
    async def _get():
        return FakePool()

    for m in (loyalty, supply, sentiment, maintenance):
        monkeypatch.setattr(m, "get_lakebase_pool", _get, raising=False)


def test_offer_push():
    r = TestClient(app).post(
        "/api/loyalty/offer-push",
        json={"store_id": 1, "member_id": 42, "offer_id": 3, "scope": "member"},
    )
    assert r.status_code == 200 and r.json()["id"] == 7


def test_release_po():
    r = TestClient(app).post(
        "/api/supply/release-po",
        json={"store_id": 1, "sku_id": 12, "supplier_id": 3, "quantity": 30, "target_date": "2025-11-04"},
    )
    assert r.status_code == 200 and r.json()["id"] == 7


def test_review_action():
    r = TestClient(app).post(
        "/api/sentiment/review-action",
        json={"store_id": 1, "review_id": 9001, "action": "respond", "response_text": "Thanks for the feedback."},
    )
    assert r.status_code == 200 and r.json()["id"] == 7


def test_work_order_create():
    r = TestClient(app).post(
        "/api/maintenance/work-order",
        json={"store_id": 1, "equipment_id": 11, "target_date": "2025-11-02", "notes": "Vibration high"},
    )
    assert r.status_code == 200 and r.json()["id"] == 7
