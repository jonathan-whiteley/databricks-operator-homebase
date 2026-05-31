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
    """Start a Genie conversation and wait for the first message to terminate."""
    s = get_settings()
    url = f"/api/2.0/genie/spaces/{s.genie_space_id}/start-conversation"
    resp = _ws().api_client.do("POST", url, body={"content": question})
    # start-conversation returns the message envelope flat:
    # {conversation_id, id (message id), status, attachments, content, ...}
    return {
        "conversation_id": resp.get("conversation_id", ""),
        "message_id": resp.get("id") or resp.get("message_id", ""),
        "status": resp.get("status", "EXECUTING"),
        "attachments": resp.get("attachments", []),
    }


def poll_message(conversation_id: str, message_id: str, timeout_s: int = 40) -> dict:
    """Poll until the Genie message reaches a terminal state (COMPLETED/FAILED)."""
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
        time.sleep(1.5)
    return {"status": "TIMEOUT", "attachments": []}


def fetch_query_result(conversation_id: str, message_id: str, attachment_id: str) -> dict:
    """Fetch the rows for a query attachment so we can render them."""
    s = get_settings()
    url = (
        f"/api/2.0/genie/spaces/{s.genie_space_id}/conversations/"
        f"{conversation_id}/messages/{message_id}/attachments/{attachment_id}/query-result"
    )
    try:
        return _ws().api_client.do("GET", url)
    except Exception:
        return {}
