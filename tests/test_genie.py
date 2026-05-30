# tests/test_genie.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
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
