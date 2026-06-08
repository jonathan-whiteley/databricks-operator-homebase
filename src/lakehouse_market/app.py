"""FastAPI entry point for Lakehouse Market · Homebase.

Routers are mounted under /api/*; the built React UI is served from /. The
implementation plan in docs/superpowers/plans/ adds routers and write-back
endpoints incrementally.
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .lakebase_migrate import run_migrations
from .routers import genie, labor, loyalty, maintenance, meta, sentiment, supply, today
from .sql_utils import fetch_all


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if get_settings().lakebase_host:
        try:
            await run_migrations()
        except Exception as e:  # never block app start on a missing DB during local dev
            print(f"[startup] lakebase migration skipped: {e}")
    # Pre-warm the SQL warehouse + connector pool so the first user request
    # doesn't pay for the cluster cold start. ~2-3s; failures are non-fatal.
    if get_settings().warehouse_id:
        try:
            fetch_all("SELECT 1 AS warm FROM stores LIMIT 1")
            print("[startup] warehouse pre-warmed")
        except Exception as e:
            print(f"[startup] warehouse pre-warm skipped: {e}")
    yield


app = FastAPI(title="Lakehouse Market · Homebase", version="0.1.0", lifespan=lifespan)
app.include_router(meta.router)
app.include_router(labor.router)
app.include_router(loyalty.router)
app.include_router(supply.router)
app.include_router(sentiment.router)
app.include_router(maintenance.router)
app.include_router(genie.router)
app.include_router(today.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "lakehouse-market"}


STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists() and any(STATIC_DIR.iterdir()):
    # Mount built assets directly for files like /assets/*.js
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # SPA fallback: any non-API path returns index.html so React Router can take over.
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        # Try a literal file first (favicon, robots, etc.), then fall back to index.html
        candidate = STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
