# src/lakehouse_market/fm.py
"""Foundation Model invocation via Databricks serving endpoint."""
from __future__ import annotations

from databricks.sdk import WorkspaceClient

from .config import get_settings

_client: WorkspaceClient | None = None


def _ws() -> WorkspaceClient:
    global _client
    if _client is None:
        _client = WorkspaceClient()
    return _client


def call_fm(prompt: str, max_tokens: int = 220) -> str:
    s = get_settings()
    out = _ws().api_client.do(
        "POST",
        f"/serving-endpoints/{s.fm_endpoint}/invocations",
        body={
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
            "temperature": 0.2,
        },
    )
    return out["choices"][0]["message"]["content"]
