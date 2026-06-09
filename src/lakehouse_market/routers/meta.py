# src/lakehouse_market/routers/meta.py
import os

from fastapi import APIRouter
from pydantic import BaseModel
from ..sql_utils import fetch_all

router = APIRouter(prefix="/api", tags=["meta"])


class Store(BaseModel):
    store_id: int
    store_name: str
    city: str
    state: str
    lat: float
    lon: float


@router.get("/stores", response_model=list[Store])
def list_stores():
    rows = fetch_all(
        "SELECT store_id, store_name, city, state, lat, lon FROM stores ORDER BY store_id"
    )
    return rows


class AppsConfig(BaseModel):
    # Per-deploy URLs for the other industry consoles surfaced on the /apps
    # launcher. None = no URL configured for that app on this workspace
    # (frontend falls back to a "Launching …" toast).
    contract_recon: str | None = None
    computer_vision: str | None = None
    irregular_ops: str | None = None


@router.get("/meta/apps", response_model=AppsConfig)
def apps_config() -> AppsConfig:
    """Workspace-specific URLs for the other operational apps in the radial
    launcher. Each Databricks workspace deploy can point at its own internal
    deploy of Contract Recon / Computer Vision / Irregular Ops by setting
    the matching env var (see app.yaml)."""
    return AppsConfig(
        contract_recon=os.getenv("CONTRACT_RECON_URL") or None,
        computer_vision=os.getenv("COMPUTER_VISION_URL") or None,
        irregular_ops=os.getenv("IRREGULAR_OPS_URL") or None,
    )
