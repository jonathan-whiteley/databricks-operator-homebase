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


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if get_settings().lakebase_host:
        try:
            await run_migrations()
        except Exception as e:  # never block app start on a missing DB during local dev
            print(f"[startup] lakebase migration skipped: {e}")
    # Pre-execute every module's primary read path for the default store so
    # they all land in the sql_utils TTL cache (24h) before any user clicks.
    # With this hook, navigating between Today / Labor / Inventory / Equipment
    # / Loyalty / Feedback is served from in-process memory instead of paying
    # a cold warehouse roundtrip on every first visit. Failures are non-fatal.
    if get_settings().warehouse_id:
        store_id = today.DEMO_STORE_ID
        from datetime import date as _date
        today_str = _date.today().isoformat()
        warm_targets = [
            ("today brief", lambda: today.brief(store_id=store_id)),
            ("stores", lambda: meta.list_stores()),
            ("labor today", lambda: labor.today(store_id=store_id, date=today_str)),
            ("equipment at-risk", lambda: maintenance.at_risk(store_id=store_id)),
            ("loyalty kpis", lambda: loyalty.kpis(store_id=store_id)),
            ("loyalty at-risk", lambda: loyalty.at_risk(store_id=store_id)),
            ("loyalty map", lambda: loyalty.map_points(store_id=store_id)),
            ("supply reorder queue", lambda: supply.reorder_queue(store_id=store_id)),
            ("supply tomorrow deliveries", lambda: supply.tomorrow_deliveries(store_id=store_id)),
            ("sentiment inbox", lambda: sentiment.inbox(store_id=store_id)),
            ("sentiment digest", lambda: sentiment.digest(store_id=store_id)),
            ("sentiment timeline", lambda: sentiment.timeline(store_id=store_id)),
        ]
        for name, fn in warm_targets:
            try:
                fn()
                print(f"[startup] pre-warmed {name}")
            except Exception as e:
                print(f"[startup] pre-warm {name} skipped: {e}")
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
