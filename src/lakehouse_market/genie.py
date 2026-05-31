# src/lakehouse_market/genie.py
"""Thin REST wrapper around the Databricks Genie conversations API."""
from __future__ import annotations

import time

from databricks.sdk import WorkspaceClient

from .config import get_settings

_client: WorkspaceClient | None = None


def _ws() -> WorkspaceClient:
    global _client
    if _client is None:
        _client = WorkspaceClient()
    return _client


def create_conversation(question: str) -> dict:
    s = get_settings()
    url = f"/api/2.0/genie/spaces/{s.genie_space_id}/start-conversation"
    resp = _ws().api_client.do("POST", url, body={"content": question})
    # start-conversation returns {"conversation_id":"…", "message":{"id":"…", …}}
    msg = resp.get("message") or {}
    return {
        "conversation_id": resp.get("conversation_id") or msg.get("conversation_id", ""),
        "message_id": msg.get("id") or msg.get("message_id", ""),
        "status": msg.get("status", "EXECUTING"),
    }


def poll_message(conversation_id: str, message_id: str, timeout_s: int = 25) -> dict:
    s = get_settings()
    url = (
        f"/api/2.0/genie/spaces/{s.genie_space_id}"
        f"/conversations/{conversation_id}/messages/{message_id}"
    )
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        out = _ws().api_client.do("GET", url)
        if out.get("status") in {"COMPLETED", "FAILED"}:
            return out
        time.sleep(1.0)
    return {"status": "TIMEOUT", "attachments": []}
