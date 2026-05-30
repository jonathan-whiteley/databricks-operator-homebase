"""FastAPI entry point for Lakehouse Market · Homebase.

Routers are mounted under /api/*; the built React UI is served from /. The
implementation plan in docs/superpowers/plans/ adds routers and write-back
endpoints incrementally.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .lakebase_migrate import run_migrations
from .routers import genie, labor, loyalty, maintenance, meta, sentiment, supply


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if get_settings().lakebase_host:
        try:
            await run_migrations()
        except Exception as e:  # never block app start on a missing DB during local dev
            print(f"[startup] lakebase migration skipped: {e}")
    yield


app = FastAPI(title="Lakehouse Market · Homebase", version="0.1.0", lifespan=lifespan)
app.include_router(meta.router)
app.include_router(labor.router)
app.include_router(loyalty.router)
app.include_router(supply.router)
app.include_router(sentiment.router)
app.include_router(maintenance.router)
app.include_router(genie.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "lakehouse-market"}


STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists() and any(STATIC_DIR.iterdir()):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="ui")
