# src/lakehouse_market/routers/loyalty.py
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings
from ..sql_utils import fetch_all

router = APIRouter(prefix="/api/loyalty", tags=["loyalty"])


class LoyaltyKPIs(BaseModel):
    active_members: int
    spend_30d: float
    at_risk_count: int
    redemption_pct: float


@router.get("/kpis", response_model=LoyaltyKPIs)
def kpis(store_id: int):
    anchor = get_settings().demo_anchor_date
    rows = fetch_all(
        """SELECT
            count(DISTINCT m.member_id) FILTER (WHERE t.ts > to_timestamp(:anchor) - INTERVAL 30 DAYS) AS active_members,
            coalesce(sum(t.amount) FILTER (WHERE t.ts > to_timestamp(:anchor) - INTERVAL 30 DAYS), 0.0) AS spend_30d,
            count(DISTINCT cp.member_id) FILTER (WHERE cp.churn_probability > 0.7) AS at_risk_count,
            0.18 AS redemption_pct
        FROM loyalty_members m
        LEFT JOIN transactions t ON t.member_id = m.member_id AND t.store_id = :store_id
        LEFT JOIN churn_predictions cp ON cp.member_id = m.member_id
        WHERE m.preferred_store_id = :store_id""",
        {"store_id": store_id, "anchor": anchor},
    )
    return rows[0]


class AtRiskMember(BaseModel):
    member_id: int
    preferred_store_id: int
    lifetime_spend: float
    churn_probability: float
    predicted_clv: float
    segment: str
    lat: float
    lon: float


@router.get("/at-risk", response_model=list[AtRiskMember])
def at_risk(store_id: int, limit: int = 20):
    return fetch_all(
        """SELECT m.member_id, m.preferred_store_id, m.lifetime_spend,
                  cp.churn_probability, cp.predicted_clv, s.segment,
                  m.lat, m.lon
           FROM loyalty_members m
           JOIN churn_predictions cp USING (member_id)
           LEFT JOIN member_segments s USING (member_id)
           WHERE m.preferred_store_id = :store_id AND cp.churn_probability > 0.6
           ORDER BY cp.predicted_clv DESC
           LIMIT :limit""",
        {"store_id": store_id, "limit": limit},
    )


class MapPoint(BaseModel):
    member_id: int
    lat: float
    lon: float
    tier: str  # "active" | "lapsed" | "at_risk"


@router.get("/map", response_model=list[MapPoint])
def map_points(store_id: int):
    anchor = get_settings().demo_anchor_date
    return fetch_all(
        """SELECT m.member_id, m.lat, m.lon,
            CASE
              WHEN cp.churn_probability > 0.7 AND cp.predicted_clv > 400 THEN 'at_risk'
              WHEN exists(SELECT 1 FROM transactions t WHERE t.member_id = m.member_id
                          AND t.ts > to_timestamp(:anchor) - INTERVAL 30 DAYS) THEN 'active'
              ELSE 'lapsed'
            END AS tier
           FROM loyalty_members m
           JOIN churn_predictions cp USING (member_id)
           WHERE m.preferred_store_id = :store_id
           LIMIT 2000""",
        {"store_id": store_id, "anchor": anchor},
    )


from ..deps import get_lakebase_pool


class OfferPush(BaseModel):
    store_id: int
    member_id: int | None = None
    offer_id: int
    scope: str  # 'member' | 'counter_prompt'
    daypart: str | None = None
    # Accepted but not persisted: app_offer_pushes has no notes column and we
    # don't want a schema migration just to round-trip a UI-only field.
    note: str | None = None


@router.post("/offer-push")
async def offer_push(req: OfferPush):
    pool = await get_lakebase_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO app_offer_pushes (store_id, member_id, offer_id, scope, daypart)
               VALUES ($1,$2,$3,$4,$5) RETURNING id""",
            req.store_id, req.member_id, req.offer_id, req.scope, req.daypart,
        )
        return {"id": row["id"]}
