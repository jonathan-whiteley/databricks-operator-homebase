# src/lakehouse_market/routers/meta.py
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
