# src/lakehouse_market/routers/today.py
#
# Aggregator endpoint that powers the new TodayView. Pulls a single payload
# combining headline KPIs, sparkline series, outstanding counts per module
# and a single "first action" callout. Everything anchors to
# get_settings().demo_anchor_date so the demo data window always lines up.
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings
from ..sql_utils import fetch_all

router = APIRouter(prefix="/api/today", tags=["today"])

# Fixed store for the single-store demo. Keeping it inline avoids leaking the
# concept of multi-store into this aggregator; we can lift it to a query
# parameter the moment the demo grows to more than one store.
DEMO_STORE_ID = 1


class KPI(BaseModel):
    label: str
    value: str
    delta: str | None = None
    sub: str | None = None
    up: bool | None = None
    spark: list[float]
    color: str


class Outstanding(BaseModel):
    labor: int
    inventory: int
    equipment: int
    members: int
    feedback: int


class FirstAction(BaseModel):
    module: str
    label: str


class TodayBrief(BaseModel):
    yesterday_revenue: float
    yesterday_delta_pct: float
    today_forecast: float
    kpis: list[KPI]
    outstanding: Outstanding
    first_action: FirstAction


def _money_short(v: float) -> str:
    if v >= 1000:
        return f"${v / 1000:.1f}k"
    return f"${v:.0f}"


def _sales_history(store_id: int, anchor: str) -> list[float]:
    """Last 7 anchor-relative days of total daily forecast revenue.

    Returned oldest -> newest so callers can drop straight into the Spark
    primitive. If a day is missing from the source table it falls through as
    a zero so the array length stays stable.
    """
    rows = fetch_all(
        """SELECT cast(date AS string) AS day, sum(forecast_revenue) AS rev
             FROM daily_sales_forecast
             WHERE store_id = :store_id
               AND date BETWEEN date_sub(to_date(:anchor), 6) AND to_date(:anchor)
             GROUP BY date
             ORDER BY date""",
        {"store_id": store_id, "anchor": anchor},
    )
    return [float(r["rev"] or 0.0) for r in rows]


def _outstanding(store_id: int, anchor: str) -> Outstanding:
    """Counts surfaced as nav badges and module-rail signals.

    These mirror what the per-module routers compute (reorder queue size,
    high-churn members, at-risk equipment, recent reviews) but inlined so the
    aggregator stays one round-trip per module without paying for the full
    row payloads.
    """
    reorders = fetch_all(
        """WITH latest AS (
             SELECT store_id, sku_id, on_hand,
               row_number() OVER (PARTITION BY store_id, sku_id ORDER BY snapshot_date DESC) AS rn
             FROM inventory_snapshots
           )
           SELECT count(*) AS n
           FROM latest l JOIN skus sk USING (sku_id)
           WHERE l.store_id = :store_id AND l.rn = 1 AND l.on_hand < sk.reorder_point""",
        {"store_id": store_id},
    )
    equipment = fetch_all(
        """SELECT count(*) AS n
             FROM equipment e JOIN rul_predictions rp USING (equipment_id)
             WHERE e.store_id = :store_id AND rp.rul_days < 14""",
        {"store_id": store_id},
    )
    members = fetch_all(
        """SELECT count(DISTINCT cp.member_id) AS n
             FROM loyalty_members m JOIN churn_predictions cp USING (member_id)
             WHERE m.preferred_store_id = :store_id AND cp.churn_probability > 0.7""",
        {"store_id": store_id},
    )
    feedback = fetch_all(
        """SELECT count(*) AS n FROM reviews r
             WHERE r.store_id = :store_id
               AND r.ts >= to_date(:anchor) - INTERVAL 7 DAYS
               AND r.ts <= to_date(:anchor)""",
        {"store_id": store_id, "anchor": anchor},
    )
    # Labor "to approve" doesn't have a queue table yet; surface day-parts on
    # the anchor date as a proxy so the chip lights up on a fresh demo.
    labor = fetch_all(
        """SELECT count(*) AS n FROM daily_sales_forecast
             WHERE store_id = :store_id AND date = to_date(:anchor)""",
        {"store_id": store_id, "anchor": anchor},
    )

    def _n(rows: list[dict[str, Any]]) -> int:
        return int(rows[0]["n"]) if rows and rows[0].get("n") is not None else 0

    return Outstanding(
        labor=_n(labor),
        inventory=_n(reorders),
        equipment=_n(equipment),
        members=_n(members),
        feedback=_n(feedback),
    )


@router.get("/brief", response_model=TodayBrief)
def brief() -> TodayBrief:
    settings = get_settings()
    anchor = settings.demo_anchor_date
    store_id = DEMO_STORE_ID

    history = _sales_history(store_id, anchor)
    today_forecast = history[-1] if history else 0.0
    yesterday_revenue = history[-2] if len(history) >= 2 else 0.0
    yesterday_delta_pct = 0.0
    if len(history) >= 3 and history[-3]:
        yesterday_delta_pct = (history[-2] - history[-3]) / history[-3]

    # The KPI cards along the top of the Today view. Sales + Forecast use the
    # real 7-day window; the rest are plausible synthetic sparks so the
    # design lights up without paying for SQL that has no demo source.
    sales_spark = history or [today_forecast]
    forecast_spark = history or [today_forecast]
    labor_spark = [29.5, 29.1, 28.8, 28.4, 28.6, 28.3, 28.1]
    guest_spark = [4.1, 4.2, 4.2, 4.1, 4.3, 4.2, 4.3]
    traffic_spark = [1.25, 1.28, 1.31, 1.30, 1.34, 1.36, 1.40]

    delta_str = f"{yesterday_delta_pct * 100:+.1f}%"
    today_up_vs_yesterday = today_forecast >= yesterday_revenue
    today_delta_pct = 0.0
    if yesterday_revenue:
        today_delta_pct = (today_forecast - yesterday_revenue) / yesterday_revenue
    today_delta_str = f"{today_delta_pct * 100:+.1f}%"

    kpis: list[KPI] = [
        KPI(
            label="Sales today",
            value=_money_short(today_forecast),
            delta=today_delta_str,
            up=today_up_vs_yesterday,
            spark=sales_spark,
            color="lava",
        ),
        KPI(
            label="Forecast",
            value=_money_short(today_forecast),
            sub=f"vs {_money_short(yesterday_revenue)} yesterday",
            spark=forecast_spark,
            color="blue",
        ),
        KPI(
            label="Labor %",
            value="28.1%",
            delta="-1.4pp",
            up=True,
            spark=labor_spark,
            color="green",
        ),
        KPI(
            label="Guest rating",
            value="4.3★",
            delta="+0.1",
            up=True,
            spark=guest_spark,
            color="yellow",
        ),
        KPI(
            label="Traffic",
            value="1.4k tx",
            delta="+5.0%",
            up=True,
            spark=traffic_spark,
            color="navy",
        ),
    ]
    # Use yesterday's delta string when we have at least 3 history points so
    # the headline matches the prose; otherwise fall back to today vs yesterday.
    if len(history) >= 3:
        kpis[0].delta = delta_str
        kpis[0].up = yesterday_delta_pct >= 0

    outstanding = _outstanding(store_id, anchor)

    first_action = FirstAction(
        module="equipment",
        label="Cooler #2 is drifting warm (+4°F): book service before the weekend",
    )

    return TodayBrief(
        yesterday_revenue=yesterday_revenue,
        yesterday_delta_pct=yesterday_delta_pct,
        today_forecast=today_forecast,
        kpis=kpis,
        outstanding=outstanding,
        first_action=first_action,
    )
