from unittest.mock import patch
import lakehouse_market.deps as deps_mod
from lakehouse_market.config import get_settings


async def test_lakebase_pool_uses_fresh_minting_callable_password(monkeypatch):
    """Lakebase OAuth tokens expire after ~1h. The pool must obtain a FRESH
    token for every new physical connection (asyncpg supports a callable
    password for exactly this), not capture one static token at pool creation.

    Regression test for: all write-back endpoints 500 with
    asyncpg.exceptions.InvalidPasswordError once the startup token expires.
    """
    # Config sees a (now-stale) static token, as the `database` resource
    # binding injects via PGPASSWORD. The pool must NOT use it verbatim.
    monkeypatch.setenv("LAKEBASE_HOST", "db.example")
    monkeypatch.setenv("LAKEBASE_USER", "sp-uuid")
    monkeypatch.setenv("LAKEBASE_DB", "databricks_postgres")
    monkeypatch.setenv("PGPASSWORD", "stale-startup-token")
    monkeypatch.delenv("LAKEBASE_PASSWORD", raising=False)
    get_settings.cache_clear()

    mint_calls = {"n": 0}

    async def fake_mint():
        mint_calls["n"] += 1
        return f"fresh-token-{mint_calls['n']}"

    monkeypatch.setattr(deps_mod, "_mint_lakebase_token", fake_mint)

    captured = {}

    async def fake_create_pool(*args, **kwargs):
        captured.update(kwargs)
        return object()

    monkeypatch.setattr(deps_mod.asyncpg, "create_pool", fake_create_pool)
    deps_mod._pool = None

    await deps_mod.get_lakebase_pool()

    pw = captured.get("password")
    assert callable(pw), "password must be a callable so asyncpg mints a fresh token per connection"
    # Each new connection establishment yields a distinct, freshly minted token.
    t1 = await pw()
    t2 = await pw()
    assert t1 != t2, "callable must mint a NEW token each time, not return a cached one"
    assert mint_calls["n"] == 2

    deps_mod._pool = None
    get_settings.cache_clear()


def test_warehouse_client_returns_singleton(monkeypatch):
    monkeypatch.setenv("DATABRICKS_HOST", "https://example.databricks.com")
    monkeypatch.setenv("DATABRICKS_WAREHOUSE_ID", "abc123")
    monkeypatch.setenv("DATABRICKS_TOKEN", "fake-token")
    # Reset both the settings cache and the warehouse client cache so env vars take effect
    get_settings.cache_clear()
    deps_mod.get_warehouse_client.cache_clear()

    monkeypatch.setattr(deps_mod, "WorkspaceClient", lambda: object())
    with patch.object(deps_mod, "dbsql") as mock_dbsql:
        mock_dbsql.connect.return_value = object()
        c1 = deps_mod.get_warehouse_client()
        c2 = deps_mod.get_warehouse_client()
    assert c1 is c2
    # connect should have been called exactly once because of @lru_cache
    assert mock_dbsql.connect.call_count == 1
