# src/lakehouse_market/genie.py
"""Thin REST wrapper around the Databricks Genie conversations API."""
from __future__ import annotations

import time

from databricks.sdk import WorkspaceClient

from .app_config import resolve_genie_space_id

_client: WorkspaceClient | None = None


def _ws() -> WorkspaceClient:
    global _client
    if _client is None:
        _client = WorkspaceClient()
    return _client


def create_conversation(question: str) -> dict:
    """Start a Genie conversation and return the first message envelope.

    The API returns a wrapper {conversation, conversation_id, message, message_id}
    where the actual message envelope (content/status/attachments/id) lives under
    `message`. The user's prompt text is what ends up in message.content; Genie's
    answer arrives later as either text or query attachments — poll for it."""
    space_id = resolve_genie_space_id()
    url = f"/api/2.0/genie/spaces/{space_id}/start-conversation"
    resp = _ws().api_client.do("POST", url, body={"content": question})
    msg = resp.get("message") or {}
    return {
        "conversation_id": resp.get("conversation_id") or msg.get("conversation_id", ""),
        "message_id": resp.get("message_id") or msg.get("id", ""),
        "status": msg.get("status", "EXECUTING"),
        "attachments": msg.get("attachments") or [],
        "content": msg.get("content", ""),
    }


def poll_message(conversation_id: str, message_id: str, timeout_s: int = 40) -> dict:
    """Poll until the Genie message reaches a terminal state (COMPLETED/FAILED)."""
    space_id = resolve_genie_space_id()
    url = (
        f"/api/2.0/genie/spaces/{space_id}"
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
    space_id = resolve_genie_space_id()
    url = (
        f"/api/2.0/genie/spaces/{space_id}/conversations/"
        f"{conversation_id}/messages/{message_id}/attachments/{attachment_id}/query-result"
    )
    try:
        return _ws().api_client.do("GET", url)
    except Exception:
        return {}
