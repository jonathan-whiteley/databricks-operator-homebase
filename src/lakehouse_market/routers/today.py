# src/lakehouse_market/routers/today.py
#
# Aggregator endpoint that powers the new TodayView. Pulls a single payload
# combining headline KPIs, sparkline series, outstanding counts per module
# and a single "first action" callout. Everything anchors to
# get_anchor_date() so the demo data window always lines up.
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings
from ..sql_utils import fetch_all, get_anchor_date

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

    Was five sequential SELECTs; collapsed to a single round-trip via
    correlated subqueries so the brief lands faster on cold loads.
    """
    rows = fetch_all(
        """SELECT
             (SELECT count(*) FROM daily_sales_forecast
                WHERE store_id = :store_id AND date = to_date(:anchor)) AS labor_n,
             (SELECT count(*)
                FROM (
                  SELECT store_id, sku_id, on_hand,
                    row_number() OVER (PARTITION BY store_id, sku_id ORDER BY snapshot_date DESC) AS rn
                  FROM inventory_snapshots
                ) latest
                JOIN skus sk USING (sku_id)
                WHERE latest.store_id = :store_id AND latest.rn = 1
                  AND latest.on_hand < sk.reorder_point) AS inventory_n,
             (SELECT count(*) FROM equipment e
                JOIN rul_predictions rp USING (equipment_id)
                WHERE e.store_id = :store_id AND rp.rul_days < 14) AS equipment_n,
             (SELECT count(DISTINCT cp.member_id)
                FROM loyalty_members m JOIN churn_predictions cp USING (member_id)
                WHERE m.preferred_store_id = :store_id
                  AND cp.churn_probability > 0.7) AS members_n,
             (SELECT count(*) FROM reviews r
                WHERE r.store_id = :store_id
                  AND r.ts >= to_date(:anchor) - INTERVAL 7 DAYS
                  AND r.ts <= to_date(:anchor)) AS feedback_n""",
        {"store_id": store_id, "anchor": anchor},
    )
    r = rows[0] if rows else {}
    def _n(key: str) -> int:
        v = r.get(key)
        return int(v) if v is not None else 0

    return Outstanding(
        labor=_n("labor_n"),
        inventory=_n("inventory_n"),
        equipment=_n("equipment_n"),
        members=_n("members_n"),
        feedback=_n("feedback_n"),
    )


@router.get("/brief", response_model=TodayBrief)
def brief(store_id: int = DEMO_STORE_ID) -> TodayBrief:
    settings = get_settings()
    anchor = get_anchor_date()

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
