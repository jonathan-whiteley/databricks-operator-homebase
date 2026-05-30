# src/lakehouse_market/routers/labor.py
from fastapi import APIRouter
from pydantic import BaseModel, Field

from ..serving import invoke_serving
from ..sql_utils import fetch_all

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
def today(store_id: int, date: str):
    rows = fetch_all(
        """SELECT daypart, forecast_revenue, forecast_transactions
           FROM daily_sales_forecast
           WHERE store_id = :store_id AND date = :date
           ORDER BY CASE daypart WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2
                                 WHEN 'Dinner' THEN 3 WHEN 'Late' THEN 4 END""",
        {"store_id": store_id, "date": date},
    )
    return {"store_id": store_id, "date": date, "dayparts": rows}


class RecommendRequest(BaseModel):
    forecast_revenue: float = Field(ge=0)
    daypart: str


class RecommendResponse(BaseModel):
    headcount: int


@router.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    result = invoke_serving(
        None,  # endpoint routed to config.labor_endpoint inside the helper
        {"dataframe_records": [{"forecast_revenue": req.forecast_revenue, "daypart": req.daypart}]},
    )
    pred = int(result["predictions"][0])
    return {"headcount": pred}


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
    pool = await get_lakebase_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO app_labor_overrides (store_id, date, daypart, headcount, note, manager_id)
               VALUES ($1, $2::date, $3, $4, $5, $6) RETURNING id""",
            req.store_id,
            req.date,
            req.daypart,
            req.headcount,
            req.note,
            req.manager_id,
        )
        return {"id": row["id"]}
