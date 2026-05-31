# src/lakehouse_market/routers/maintenance.py
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings
from ..sql_utils import fetch_all

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


class AtRiskUnit(BaseModel):
    equipment_id: int
    category: str
    model: str
    runtime_hours: int
    health_score: float
    rul_days: int
    predicted_failure_date: str


@router.get("/at-risk", response_model=list[AtRiskUnit])
def at_risk(store_id: int, limit: int = 20):
    return fetch_all(
        """SELECT e.equipment_id, e.category, e.model, e.runtime_hours,
                  rp.health_score, rp.rul_days, cast(rp.predicted_failure_date AS string) AS predicted_failure_date
           FROM equipment e JOIN rul_predictions rp USING (equipment_id)
           WHERE e.store_id = :store_id
           ORDER BY rp.rul_days ASC LIMIT :limit""",
        {"store_id": store_id, "limit": limit},
    )


class TelemetryRow(BaseModel):
    ts: str
    temperature: float
    vibration: float
    runtime_hours_delta: float


@router.get("/telemetry", response_model=list[TelemetryRow])
def telemetry(equipment_id: int, days: int = 14):
    anchor = get_settings().demo_anchor_date
    return fetch_all(
        """SELECT cast(ts AS string) AS ts, temperature, vibration, runtime_hours_delta
           FROM equipment_telemetry
           WHERE equipment_id = :equipment_id AND ts > to_timestamp(:anchor) - INTERVAL :days DAYS
           ORDER BY ts""",
        {"equipment_id": equipment_id, "days": days, "anchor": anchor},
    )


from ..deps import get_lakebase_pool


class WorkOrder(BaseModel):
    store_id: int
    equipment_id: int
    target_date: str | None = None
    notes: str | None = None
    manager_id: str | None = "demo-manager"


@router.post("/work-order")
async def work_order(req: WorkOrder):
    pool = await get_lakebase_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO app_work_orders (store_id, equipment_id, target_date, notes, manager_id)
               VALUES ($1,$2,$3::date,$4,$5) RETURNING id""",
            req.store_id, req.equipment_id, req.target_date, req.notes, req.manager_id,
        )
        return {"id": row["id"]}


class WorkOrderStatusUpdate(BaseModel):
    work_order_id: int
    status: str  # 'open' | 'in_progress' | 'done'


@router.post("/work-order/status")
async def work_order_status(req: WorkOrderStatusUpdate):
    pool = await get_lakebase_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE app_work_orders SET status = $1, updated_at = now() WHERE id = $2",
            req.status, req.work_order_id,
        )
        return {"ok": True}
