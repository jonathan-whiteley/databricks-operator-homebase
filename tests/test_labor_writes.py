# tests/test_labor_writes.py
import pytest
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import labor as labor_mod


class FakeConn:
    def __init__(self):
        self.last = None

    async def execute(self, sql, *args):
        self.last = (sql, args)
        return "INSERT 0 1"

    async def fetchrow(self, *a, **k):
        return {"id": 99}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        pass


class FakePool:
    def __init__(self):
        self.conn = FakeConn()

    def acquire(self):
        return self.conn


@pytest.fixture(autouse=True)
def patch_pool(monkeypatch):
    fake = FakePool()

    async def _get():
        return fake

    monkeypatch.setattr(labor_mod, "get_lakebase_pool", _get)
    return fake


def test_post_override(patch_pool):
    r = TestClient(app).post(
        "/api/labor/override",
        json={"store_id": 1, "date": "2025-10-29", "daypart": "Lunch", "headcount": 11, "note": "extra cook"},
    )
    assert r.status_code == 200
    assert r.json()["id"] == 99
