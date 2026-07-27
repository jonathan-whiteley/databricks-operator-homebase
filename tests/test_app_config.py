# tests/test_app_config.py
from lakehouse_market import app_config


def teardown_function():
    app_config.clear_cache()


def test_env_wins(monkeypatch):
    monkeypatch.setattr(app_config, "_settings_space_id", lambda: "env-space-123")
    # Even if the table would return something, env takes precedence.
    monkeypatch.setattr(app_config, "_fetch_config", lambda k: "table-space-999")
    assert app_config.resolve_genie_space_id() == "env-space-123"


def test_falls_back_to_table(monkeypatch):
    monkeypatch.setattr(app_config, "_settings_space_id", lambda: "")
    monkeypatch.setattr(app_config, "_fetch_config", lambda k: "table-space-999")
    assert app_config.resolve_genie_space_id() == "table-space-999"


def test_empty_when_neither(monkeypatch):
    monkeypatch.setattr(app_config, "_settings_space_id", lambda: "")
    monkeypatch.setattr(app_config, "_fetch_config", lambda k: "")
    assert app_config.resolve_genie_space_id() == ""
