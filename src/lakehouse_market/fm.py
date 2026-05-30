# src/lakehouse_market/fm.py
"""Foundation Model invocation via Databricks serving endpoint."""
from __future__ import annotations

import os

import httpx

from .config import get_settings


def call_fm(prompt: str, max_tokens: int = 220) -> str:
    s = get_settings()
    url = f"{s.databricks_host.rstrip('/')}/serving-endpoints/{s.fm_endpoint}/invocations"
    payload = {
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.2,
    }
    r = httpx.post(
        url,
        json=payload,
        headers={"Authorization": f"Bearer {os.environ.get('DATABRICKS_TOKEN', '')}"},
        timeout=30.0,
    )
    r.raise_for_status()
    out = r.json()
    return out["choices"][0]["message"]["content"]
