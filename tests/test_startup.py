# tests/test_startup.py
import asyncio

from lakehouse_market import lakebase_migrate


def test_run_migrations_callable_async():
    assert asyncio.iscoroutinefunction(lakebase_migrate.run_migrations)
