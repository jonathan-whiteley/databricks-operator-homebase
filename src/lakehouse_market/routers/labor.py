# src/lakehouse_market/routers/labor.py
from functools import lru_cache

from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..config import get_settings
from ..sql_utils import fetch_all, get_anchor_date

router = APIRouter(prefix="/api/labor", tags=["labor"])


class DayPart(BaseModel):
    daypart: str
    forecast_revenue: float
    forecast_transactions: int


class TodayResponse(BaseModel):
    store_id: int
    date: str
    dayparts: list[DayPart]


@router.get("/today", response_model=TodayResponse)
def today(store_id: int, date: str | None = None):
    # If no row exists for the requested date, fall back to the most recent
    # date that has data for this store. Demo data ends 2025-10-30 so any
    # "today" past that returns empty without this fallback.
    rows = []
    target_date = date or get_anchor_date()
    if date:
        rows = fetch_all(
            """SELECT daypart, forecast_revenue, forecast_transactions
               FROM daily_sales_forecast
               WHERE store_id = :store_id AND date = :date
               ORDER BY CASE daypart WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2
                                     WHEN 'Dinner' THEN 3 WHEN 'Late' THEN 4 END""",
            {"store_id": store_id, "date": date},
        )
    if not rows:
        rows = fetch_all(
            """WITH latest AS (
                  SELECT MAX(date) AS d FROM daily_sales_forecast WHERE store_id = :store_id
               )
               SELECT daypart, forecast_revenue, forecast_transactions
               FROM daily_sales_forecast
               WHERE store_id = :store_id AND date = (SELECT d FROM latest)
               ORDER BY CASE daypart WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2
                                     WHEN 'Dinner' THEN 3 WHEN 'Late' THEN 4 END""",
            {"store_id": store_id},
        )
        if rows:
            target_date = get_anchor_date()
    return {"store_id": store_id, "date": target_date, "dayparts": rows}


class RecommendRequest(BaseModel):
    forecast_revenue: float = Field(ge=0)
    daypart: str


class RecommendResponse(BaseModel):
    headcount: int


# Synthetic-label offsets baked into notebook 02's training target. Used as the
# fallback when the trained-coefficients table is absent so /recommend never 500s.
_HEURISTIC_OFFSETS = {"Breakfast": 1.0, "Lunch": 3.0, "Dinner": 2.0, "Late": 0.0}
_PER_DOLLAR = 1.0 / 350.0


@lru_cache(maxsize=1)
def _load_coefficients() -> dict[str, tuple[float, float]]:
    """Read per-daypart (base, per_dollar) from the trained-model coefficients
    table written by notebook 02. Cached for the process. Returns {} when the
    table is missing (fresh workspace before the init job) so callers fall back
    to the heuristic."""
    try:
        rows = fetch_all("SELECT daypart, base, per_dollar FROM labor_model_coefficients")
    except Exception:
        return {}
    return {r["daypart"]: (float(r["base"]), float(r["per_dollar"])) for r in rows}


def compute_headcount(forecast_revenue: float, daypart: str) -> int:
    """Headcount from the trained model's coefficients; heuristic fallback."""
    coeffs = _load_coefficients()
    if daypart in coeffs:
        base, per_dollar = coeffs[daypart]
    else:
        base, per_dollar = _HEURISTIC_OFFSETS.get(daypart, 0.0), _PER_DOLLAR
    return max(0, round(base + per_dollar * forecast_revenue))


@router.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    return {"headcount": compute_headcount(req.forecast_revenue, req.daypart)}


from ..deps import get_lakebase_pool


class OverrideRequest(BaseModel):
    store_id: int
    date: str
    daypart: str
    headcount: int
    note: str | None = None
    manager_id: str | None = "demo-manager"


class OverrideResponse(BaseModel):
    id: int


@router.post("/override", response_model=OverrideResponse)
async def override(req: OverrideRequest):
    from datetime import date as _date
    pool = await get_lakebase_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO lhm_app.app_labor_overrides (store_id, date, daypart, headcount, note, manager_id)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id""",
            req.store_id,
            _date.fromisoformat(req.date),
            req.daypart,
            req.headcount,
            req.note,
            req.manager_id,
        )
        return {"id": row["id"]}
