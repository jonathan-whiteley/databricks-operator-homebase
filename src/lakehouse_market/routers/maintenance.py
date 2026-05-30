# src/lakehouse_market/routers/maintenance.py
from fastapi import APIRouter
from pydantic import BaseModel

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
    return fetch_all(
        """SELECT cast(ts AS string) AS ts, temperature, vibration, runtime_hours_delta
           FROM equipment_telemetry
           WHERE equipment_id = :equipment_id AND ts > current_timestamp() - INTERVAL :days DAYS
           ORDER BY ts""",
        {"equipment_id": equipment_id, "days": days},
    )
