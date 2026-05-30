from unittest.mock import patch
import lakehouse_market.deps as deps_mod
from lakehouse_market.config import get_settings


def test_warehouse_client_returns_singleton(monkeypatch):
    monkeypatch.setenv("DATABRICKS_HOST", "https://example.databricks.com")
    monkeypatch.setenv("DATABRICKS_WAREHOUSE_ID", "abc123")
    monkeypatch.setenv("DATABRICKS_TOKEN", "fake-token")
    # Reset both the settings cache and the warehouse client cache so env vars take effect
    get_settings.cache_clear()
    deps_mod.get_warehouse_client.cache_clear()

    with patch.object(deps_mod, "dbsql") as mock_dbsql:
        mock_dbsql.connect.return_value = object()
        c1 = deps_mod.get_warehouse_client()
        c2 = deps_mod.get_warehouse_client()
    assert c1 is c2
    # connect should have been called exactly once because of @lru_cache
    assert mock_dbsql.connect.call_count == 1
