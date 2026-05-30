import pytest
from lakehouse_market.sql_utils import render_sql


def test_render_sql_substitutes_named_params():
    out = render_sql(
        "SELECT * FROM t WHERE store_id = :store_id AND date = :d",
        {"store_id": 42, "d": "2025-10-29"},
    )
    assert "store_id = 42" in out
    assert "date = '2025-10-29'" in out


def test_render_sql_rejects_unknown_param():
    with pytest.raises(KeyError):
        render_sql("SELECT :a", {"b": 1})


def test_render_sql_escapes_single_quotes():
    out = render_sql("SELECT * FROM t WHERE name = :n", {"n": "O'Brien"})
    assert "O''Brien" in out
