"""FastAPI entry point for Lakehouse Market · Homebase.

Routers are mounted under /api/*; the built React UI is served from /. The
implementation plan in docs/superpowers/plans/ adds routers and write-back
endpoints incrementally.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .routers import labor, meta

app = FastAPI(title="Lakehouse Market · Homebase", version="0.1.0")
app.include_router(meta.router)
app.include_router(labor.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "lakehouse-market"}


STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists() and any(STATIC_DIR.iterdir()):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="ui")
