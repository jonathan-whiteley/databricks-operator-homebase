"""Tiny SQL helpers: parameter substitution + dict-row fetch + TTL cache.
We don't use parameterized binding because databricks-sql-connector's
async story is limited; we render server-side validated inputs only.
All callers must validate inputs as ints/dates before passing here."""
from __future__ import annotations
import os
import re
import time
from typing import Any, Mapping
from .deps import get_warehouse_client

_PARAM = re.compile(r":(\w+)")

# In-memory TTL cache. Demo workload: read queries are deterministic for a given
# (rendered SQL) so caching is safe. Default 10-min TTL keeps the warehouse cold
# most of the day. Disable with LHM_QUERY_CACHE_TTL=0.
_TTL_SECONDS = int(os.getenv("LHM_QUERY_CACHE_TTL", "600"))
_CACHE: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def render_sql(sql: str, params: Mapping[str, Any]) -> str:
    def sub(m: re.Match[str]) -> str:
        key = m.group(1)
        if key not in params:
            raise KeyError(f"missing param: {key}")
        v = params[key]
        if isinstance(v, (int, float)):
            return str(v)
        escaped = str(v).replace("'", "''")
        return f"'{escaped}'"
    return _PARAM.sub(sub, sql)


def _execute(rendered: str) -> list[dict[str, Any]]:
    with get_warehouse_client().cursor() as cur:
        cur.execute(rendered)
        cols = [d[0] for d in cur.description or []]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def _execute_with_retry(rendered: str) -> list[dict[str, Any]]:
    try:
        return _execute(rendered)
    except Exception as e:
        # Stale session (warehouse auto-stopped) or transient connector errors —
        # bust the cached connection and retry once.
        msg = str(e)
        if "SessionHandle" in msg or ("Session" in msg and "closed" in msg) or "BAD_REQUEST" in msg:
            get_warehouse_client.cache_clear()
            return _execute(rendered)
        raise


def fetch_all(sql: str, params: Mapping[str, Any] | None = None) -> list[dict[str, Any]]:
    rendered = render_sql(sql, params or {})
    if _TTL_SECONDS > 0:
        now = time.time()
        cached = _CACHE.get(rendered)
        if cached and now - cached[0] < _TTL_SECONDS:
            return cached[1]
        result = _execute_with_retry(rendered)
        _CACHE[rendered] = (now, result)
        return result
    return _execute_with_retry(rendered)


def clear_query_cache() -> int:
    """Drop all cached query results. Returns the number of entries cleared."""
    n = len(_CACHE)
    _CACHE.clear()
    return n


# Dynamic demo anchor date — the most recent date present in the dataset.
# Queried lazily on first use; cached for the lifetime of the process.
# An explicit DEMO_ANCHOR_DATE env var overrides this (useful for tests).
_ANCHOR_DATE: str | None = None


def get_anchor_date() -> str:
    """Return the most recent date in daily_sales_forecast as a YYYY-MM-DD string.

    Callers should prefer this over a hardcoded date so the demo keeps working
    no matter how stale the synthetic data is.
    """
    global _ANCHOR_DATE
    if _ANCHOR_DATE is not None:
        return _ANCHOR_DATE
    import os
    forced = os.getenv("DEMO_ANCHOR_DATE", "").strip()
    if forced:
        _ANCHOR_DATE = forced
        return forced
    try:
        rows = _execute_with_retry(
            "SELECT cast(MAX(date) AS string) AS d FROM daily_sales_forecast"
        )
        d = (rows[0].get("d") if rows else None) or ""
        if d:
            _ANCHOR_DATE = d
            return d
    except Exception:
        pass
    # Last-resort fallback so the app boots even if the table is missing.
    _ANCHOR_DATE = "2025-10-30"
    return _ANCHOR_DATE
