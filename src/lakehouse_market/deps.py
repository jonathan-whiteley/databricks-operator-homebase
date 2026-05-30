# src/lakehouse_market/deps.py
"""Shared dependencies: warehouse SQL client, lakebase pool."""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

import asyncpg
from databricks import sql as dbsql
from databricks.sdk import WorkspaceClient

from .config import get_settings


@lru_cache(maxsize=1)
def get_warehouse_client():
    s = get_settings()
    w = WorkspaceClient()
    return dbsql.connect(
        server_hostname=s.databricks_host.replace("https://", "").rstrip("/"),
        http_path=f"/sql/1.0/warehouses/{s.warehouse_id}",
        credentials_provider=lambda: w.config.authenticate,
    )


_pool: Optional[asyncpg.Pool] = None


async def get_lakebase_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        s = get_settings()
        _pool = await asyncpg.create_pool(
            host=s.lakebase_host,
            database=s.lakebase_db,
            user=s.lakebase_user,
            password=s.lakebase_password,
            min_size=1,
            max_size=4,
        )
    return _pool
