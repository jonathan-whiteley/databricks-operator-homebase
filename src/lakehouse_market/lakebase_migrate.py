# src/lakehouse_market/lakebase_migrate.py
"""Run Lakebase DDL idempotently. Called at app startup and lazily on
first write attempt (in case the app-startup pass was swallowed)."""
from __future__ import annotations

import logging
from pathlib import Path

from .deps import get_lakebase_pool

log = logging.getLogger("lakebase_migrate")

SCHEMA_FILE = Path(__file__).parent / "lakebase_schema.sql"

# One-shot guard so we don't re-run on every write attempt.
_DONE = False


async def run_migrations() -> None:
    global _DONE
    if _DONE:
        return
    pool = await get_lakebase_pool()
    ddl = SCHEMA_FILE.read_text()
    async with pool.acquire() as conn:
        # Run each statement separately so a failure on one doesn't roll back
        # everything else, and we can log per-statement.
        statements = [s.strip() for s in ddl.split(";") if s.strip()]
        for s in statements:
            try:
                await conn.execute(s)
            except Exception as e:
                log.warning("DDL stmt failed (continuing): %s — %s", s[:80], e)
        # Verify the five tables exist
        rows = await conn.fetch(
            """SELECT table_name FROM information_schema.tables
               WHERE table_schema = 'lhm_app' AND table_name LIKE 'app\\_%' ESCAPE '\\'"""
        )
        found = sorted(r["table_name"] for r in rows)
        log.info("lakebase migration tables present in lhm_app: %s", found)
        print(f"[lakebase_migrate] tables in lhm_app: {found}")
    _DONE = True


async def ensure_ready() -> None:
    """Called from write endpoints; cheap no-op after first success."""
    if _DONE:
        return
    try:
        await run_migrations()
    except Exception as e:
        log.error("lazy migration failed: %s", e)
        print(f"[lakebase_migrate] lazy migration failed: {e}")
