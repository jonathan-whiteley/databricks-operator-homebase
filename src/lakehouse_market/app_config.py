# src/lakehouse_market/app_config.py
"""Runtime key/value config the app reads from a UC table.

The init job (notebook 06) writes runtime-resolved values here that are not
known at deploy time. Today that is the Genie space id: notebook 06 creates the
space and MERGEs its id into <catalog>.<schema>.app_config(config_key,
config_value). The app reads it lazily so no id is hardcoded in the bundle.
"""
from __future__ import annotations

from functools import lru_cache

from .config import get_settings
from .sql_utils import fetch_all


def _settings_space_id() -> str:
    return get_settings().genie_space_id


def _fetch_config(key: str) -> str:
    """Read one config value from the UC app_config table. Returns "" when the
    table is absent (fresh workspace before the init job) or the key is unset."""
    try:
        rows = fetch_all(
            "SELECT config_value FROM app_config WHERE config_key = :k",
            {"k": key},
        )
    except Exception:
        return ""
    return str(rows[0]["config_value"]) if rows else ""


@lru_cache(maxsize=1)
def resolve_genie_space_id() -> str:
    """Env GENIE_SPACE_ID wins; else the app_config table; else ""."""
    env_id = _settings_space_id()
    if env_id:
        return env_id
    return _fetch_config("genie_space_id")


def clear_cache() -> None:
    resolve_genie_space_id.cache_clear()
