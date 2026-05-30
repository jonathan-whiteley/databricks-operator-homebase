"""Tiny SQL helpers: parameter substitution + dict-row fetch.
We don't use parameterized binding because databricks-sql-connector's
async story is limited; we render server-side validated inputs only.
All callers must validate inputs as ints/dates before passing here."""
from __future__ import annotations
import re
from typing import Any, Mapping
from .deps import get_warehouse_client

_PARAM = re.compile(r":(\w+)")


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


def fetch_all(sql: str, params: Mapping[str, Any] | None = None) -> list[dict[str, Any]]:
    rendered = render_sql(sql, params or {})
    with get_warehouse_client().cursor() as cur:
        cur.execute(rendered)
        cols = [d[0] for d in cur.description or []]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
