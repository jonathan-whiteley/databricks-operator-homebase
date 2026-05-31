# src/lakehouse_market/routers/supply.py
from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings
from ..sql_utils import fetch_all

router = APIRouter(prefix="/api/supply", tags=["supply"])


class ReorderRow(BaseModel):
    sku_id: int
    sku_name: str
    on_hand: int
    reorder_point: int
    days_of_cover: float
    supplier_id: int
    supplier_name: str
    supplier_on_time_pct: float


@router.get("/reorder-queue", response_model=list[ReorderRow])
def reorder_queue(store_id: int):
    return fetch_all(
        """WITH latest AS (
             SELECT store_id, sku_id, on_hand,
               row_number() OVER (PARTITION BY store_id, sku_id ORDER BY snapshot_date DESC) AS rn
             FROM inventory_snapshots
           ),
           weekly AS (
             SELECT store_id, sku_id, sum(forecast_units)/7.0 AS avg_daily_demand
             FROM demand_forecast WHERE week_start = (SELECT max(week_start) FROM demand_forecast)
             GROUP BY store_id, sku_id
           )
           SELECT l.sku_id, sk.sku_name, l.on_hand, sk.reorder_point,
             CASE WHEN w.avg_daily_demand > 0
                  THEN cast(l.on_hand AS double) / w.avg_daily_demand ELSE 99.0 END AS days_of_cover,
             sk.supplier_id, sup.name AS supplier_name, sup.on_time_pct AS supplier_on_time_pct
           FROM latest l JOIN skus sk USING (sku_id)
           JOIN suppliers sup ON sup.supplier_id = sk.supplier_id
           LEFT JOIN weekly w ON w.store_id = l.store_id AND w.sku_id = l.sku_id
           WHERE l.store_id = :store_id AND l.rn = 1 AND l.on_hand < sk.reorder_point
           ORDER BY days_of_cover ASC
           LIMIT 50""",
        {"store_id": store_id},
    )


class IncomingPO(BaseModel):
    po_id: int
    sku_id: int
    supplier_id: int
    supplier_name: str
    ordered_qty: int
    expected_date: str


@router.get("/tomorrow-deliveries", response_model=list[IncomingPO])
def tomorrow_deliveries(store_id: int, date: str | None = None):
    # Use the requested date if any deliveries match, otherwise return the
    # next 7 days of scheduled inbound from the demo anchor date so the tab
    # always has something to display.
    anchor = date or get_settings().demo_anchor_date
    rows = fetch_all(
        """SELECT po.po_id, po.sku_id, po.supplier_id, sup.name AS supplier_name,
                  po.ordered_qty, cast(po.expected_date AS string) AS expected_date
           FROM purchase_orders po JOIN suppliers sup USING (supplier_id)
           WHERE po.store_id = :store_id
             AND po.expected_date BETWEEN to_date(:anchor) AND date_add(to_date(:anchor), 7)
           ORDER BY po.expected_date, supplier_name
           LIMIT 50""",
        {"store_id": store_id, "anchor": anchor},
    )
    return rows


from ..deps import get_lakebase_pool


class ReleasePO(BaseModel):
    store_id: int
    sku_id: int
    supplier_id: int
    quantity: int
    target_date: str
    manager_id: str | None = "demo-manager"


@router.post("/release-po")
async def release_po(req: ReleasePO):
    pool = await get_lakebase_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO app_purchase_orders (store_id, sku_id, supplier_id, quantity, target_date, manager_id)
               VALUES ($1,$2,$3,$4,$5::date,$6) RETURNING id""",
            req.store_id, req.sku_id, req.supplier_id, req.quantity, req.target_date, req.manager_id,
        )
        return {"id": row["id"]}
