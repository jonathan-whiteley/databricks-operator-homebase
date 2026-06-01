# src/lakehouse_market/deps.py
"""Shared dependencies: warehouse SQL client, lakebase pool.

Lakebase uses short-lived OAuth tokens, not static passwords. We mint a fresh
token per pool acquire via WorkspaceClient.database.generate_database_credential.
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

import asyncpg
from databricks import sql as dbsql
from databricks.sdk import WorkspaceClient

from .config import get_settings


@lru_cache(maxsize=1)
def _workspace_client() -> WorkspaceClient:
    return WorkspaceClient()


@lru_cache(maxsize=1)
def get_warehouse_client():
    s = get_settings()
    w = _workspace_client()
    return dbsql.connect(
        server_hostname=s.databricks_host.replace("https://", "").rstrip("/"),
        http_path=f"/sql/1.0/warehouses/{s.warehouse_id}",
        credentials_provider=lambda: w.config.authenticate,
        catalog=s.catalog,
        schema=s.schema_name,
    )


_LAKEBASE_INSTANCE = os.getenv("LAKEBASE_INSTANCE", "lakehouse-market-app-db")
_pool: Optional[asyncpg.Pool] = None


async def _mint_lakebase_token() -> str:
    """Generate a fresh OAuth token scoped to the Lakebase instance.

    Use the SDK's high-level call — it generates a request_id, sets the
    X-Databricks-Org-Id header, and resolves the path. Raw httpx attempts
    failed with 400 because they were missing those bits.
    """
    w = _workspace_client()
    resp = w.database.generate_database_credential(
        instance_names=[_LAKEBASE_INSTANCE],
    )
    token = getattr(resp, "token", None)
    if not token and isinstance(resp, dict):
        token = resp.get("token")
    if not token:
        raise RuntimeError(f"generate_database_credential returned no token: {resp!r}")
    return token


async def get_lakebase_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        s = get_settings()
        host = s.lakebase_host
        user = s.lakebase_user
        # If env auth didn't fill the static password slot (Lakebase doesn't
        # support static passwords), mint a fresh OAuth token instead.
        password = s.lakebase_password or await _mint_lakebase_token()
        _pool = await asyncpg.create_pool(
            host=host,
            database=s.lakebase_db,
            user=user,
            password=password,
            ssl="require",
            min_size=1,
            max_size=4,
        )
    return _pool


async def reset_lakebase_pool() -> None:
    """Drop the pool — call when token expires (1h) so the next acquire reconnects."""
    global _pool
    if _pool is not None:
        try:
            await _pool.close()
        except Exception:
            pass
        _pool = None
