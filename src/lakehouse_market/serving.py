# src/lakehouse_market/serving.py
"""Tiny wrapper around Databricks Model Serving REST."""
from __future__ import annotations

import os

import httpx

from .config import get_settings


def invoke_serving(endpoint: str | None, payload: dict) -> dict:
    s = get_settings()
    ep = endpoint or s.labor_endpoint
    url = f"{s.databricks_host.rstrip('/')}/serving-endpoints/{ep}/invocations"
    token = os.environ.get("DATABRICKS_TOKEN", "")
    r = httpx.post(url, json=payload, headers={"Authorization": f"Bearer {token}"}, timeout=15.0)
    r.raise_for_status()
    return r.json()
