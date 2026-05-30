# src/lakehouse_market/lakebase_migrate.py
"""Run Lakebase DDL idempotently. Called at app startup."""
from __future__ import annotations

from pathlib import Path

from .deps import get_lakebase_pool

SCHEMA_FILE = Path(__file__).parent / "lakebase_schema.sql"


async def run_migrations() -> None:
    pool = await get_lakebase_pool()
    ddl = SCHEMA_FILE.read_text()
    async with pool.acquire() as conn:
        await conn.execute(ddl)
