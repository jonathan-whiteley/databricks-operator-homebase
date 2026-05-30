"""Thin REST wrapper around the Databricks Genie conversations API."""
from __future__ import annotations

import os
import time

import httpx

from .config import get_settings


def _auth() -> dict[str, str]:
    return {"Authorization": f"Bearer {os.environ.get('DATABRICKS_TOKEN', '')}"}


def create_conversation(question: str) -> dict:
    s = get_settings()
    url = f"{s.databricks_host.rstrip('/')}/api/2.0/genie/spaces/{s.genie_space_id}/conversations"
    r = httpx.post(url, json={"content": question}, headers=_auth(), timeout=30.0)
    r.raise_for_status()
    return r.json()


def poll_message(conversation_id: str, message_id: str, timeout_s: int = 25) -> dict:
    s = get_settings()
    url = (
        f"{s.databricks_host.rstrip('/')}/api/2.0/genie/spaces/{s.genie_space_id}"
        f"/conversations/{conversation_id}/messages/{message_id}"
    )
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        r = httpx.get(url, headers=_auth(), timeout=10.0)
        r.raise_for_status()
        out = r.json()
        if out.get("status") in {"COMPLETED", "FAILED"}:
            return out
        time.sleep(1.0)
    return {"status": "TIMEOUT", "attachments": []}
