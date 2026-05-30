# src/lakehouse_market/serving.py
"""Tiny wrapper around Databricks Model Serving REST."""
from __future__ import annotations

from databricks.sdk import WorkspaceClient

from .config import get_settings

_client: WorkspaceClient | None = None


def _ws() -> WorkspaceClient:
    global _client
    if _client is None:
        _client = WorkspaceClient()
    return _client


def invoke_serving(endpoint: str | None, payload: dict) -> dict:
    s = get_settings()
    ep = endpoint or s.labor_endpoint
    return _ws().api_client.do(
        "POST",
        f"/serving-endpoints/{ep}/invocations",
        body=payload,
    )
