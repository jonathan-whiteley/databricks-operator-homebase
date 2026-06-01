# tests/test_loyalty_writes.py
import pytest
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import loyalty as loy_mod


class FakeConn:
    def __init__(self):
        self.executemany_args: tuple | None = None

    async def fetchrow(self, *a, **k):
        return {"id": 1}

    async def execute(self, *a, **k):
        return "OK"

    async def executemany(self, sql, rows):
        # Capture for assertions in tests.
        self.executemany_args = (sql, list(rows))
        return None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        pass


class FakePool:
    def __init__(self):
        self.conn = FakeConn()

    def acquire(self):
        return self.conn


@pytest.fixture
def patch_pool(monkeypatch):
    fake = FakePool()

    async def _get():
        return fake

    monkeypatch.setattr(loy_mod, "get_lakebase_pool", _get)
    return fake


def test_post_win_back(patch_pool, monkeypatch):
    # Three eligible members come back from the warehouse query.
    eligible = [{"member_id": 11}, {"member_id": 22}, {"member_id": 33}]
    monkeypatch.setattr(loy_mod, "fetch_all", lambda sql, params=None: eligible)

    r = TestClient(app).post(
        "/api/loyalty/win-back",
        json={"store_id": 1, "segment": "lapsed", "offer_id": 7},
    )
    assert r.status_code == 200
    assert r.json() == {"count": 3}

    # executemany should have been called once with one row per member.
    captured = patch_pool.conn.executemany_args
    assert captured is not None
    sql, rows = captured
    assert "INSERT INTO lhm_app.app_offer_pushes" in sql
    assert len(rows) == 3
    assert rows[0] == (1, 11, 7, "member", None)
