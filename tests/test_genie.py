# tests/test_genie.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.app_config import clear_cache as clear_app_config_cache
from lakehouse_market.config import get_settings
from lakehouse_market.routers import genie as g_mod


def test_ask_calls_genie_with_context(monkeypatch):
    captured = {}

    def fake_create(question: str):
        captured["q"] = question
        return {"conversation_id": "c1", "message_id": "m1", "status": "EXECUTING"}

    def fake_poll(_cid, _mid):
        return {
            "status": "COMPLETED",
            "attachments": [{"text": {"content": "Lunch headcount was 12 last Tuesday."}}],
        }

    monkeypatch.setenv("GENIE_SPACE_ID", "test-space")
    get_settings.cache_clear()
    clear_app_config_cache()
    monkeypatch.setattr(g_mod, "create_conversation", fake_create)
    monkeypatch.setattr(g_mod, "poll_message", fake_poll)

    r = TestClient(app).post(
        "/api/genie/ask",
        json={"tab_id": "labor", "store_id": 42, "question": "Why is lunch headcount higher than last Tuesday?"},
    )
    assert r.status_code == 200
    assert "Lunch headcount was 12" in r.json()["text"]
    assert "store_id=42" in captured["q"]
    assert "Labor" in captured["q"]


def test_ask_returns_friendly_message_when_unconfigured(monkeypatch):
    monkeypatch.setenv("GENIE_SPACE_ID", "")
    get_settings.cache_clear()
    clear_app_config_cache()
    r = TestClient(app).post(
        "/api/genie/ask",
        json={"tab_id": "labor", "store_id": 1, "question": "anything"},
    )
    assert r.status_code == 200
    assert "not configured" in r.json()["text"].lower()


def test_ask_degrades_when_no_space(monkeypatch):
    from fastapi.testclient import TestClient
    from lakehouse_market.app import app
    from lakehouse_market.routers import genie as genie_router
    monkeypatch.setattr(genie_router, "resolve_genie_space_id", lambda: "")
    r = TestClient(app).post(
        "/api/genie/ask",
        json={"tab_id": "labor", "store_id": 1, "question": "how are sales?"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "not configured" in body["text"].lower()
    assert body["table"] is None
