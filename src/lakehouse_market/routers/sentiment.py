# src/lakehouse_market/routers/sentiment.py
from __future__ import annotations

import time

from fastapi import APIRouter
from pydantic import BaseModel

from ..config import get_settings
from ..fm import call_fm
from ..sql_utils import fetch_all

router = APIRouter(prefix="/api/sentiment", tags=["sentiment"])


class InboxRow(BaseModel):
    review_id: int
    ts: str
    source: str
    rating: int
    snippet: str
    sentiment: str
    topics: list[str]


@router.get("/inbox", response_model=list[InboxRow])
def inbox(store_id: int, since: str | None = None, limit: int = 30):
    # Anchor to demo data window (30 days back from the dataset's end) when no
    # since param is passed so the inbox always populates.
    anchor = get_settings().demo_anchor_date
    if not since:
        since = anchor
    rows = fetch_all(
        """SELECT r.review_id, cast(r.ts AS string) AS ts, r.source, r.rating,
                  substring(r.text, 1, 140) AS snippet,
                  coalesce(rs.sentiment, 'neutral') AS sentiment,
                  to_json(collect_list(rt.topic)) AS topics_json
           FROM reviews r
           LEFT JOIN review_sentiment rs USING (review_id)
           LEFT JOIN review_topics rt USING (review_id)
           WHERE r.store_id = :store_id
             AND r.ts >= to_date(:since) - INTERVAL 30 DAYS
             AND r.ts <= to_date(:since)
           GROUP BY r.review_id, r.ts, r.source, r.rating, r.text, rs.sentiment
           ORDER BY r.ts DESC LIMIT :limit""",
        {"store_id": store_id, "since": since, "limit": limit},
    )
    import json as _json
    for r in rows:
        raw = r.pop("topics_json", "[]") or "[]"
        try:
            r["topics"] = _json.loads(raw)
        except Exception:
            r["topics"] = []
    return rows


class Digest(BaseModel):
    text: str
    generated_at: float


_DIGEST_CACHE: dict[int, tuple[float, str]] = {}


@router.get("/digest", response_model=Digest)
def digest(store_id: int):
    now = time.time()
    cached = _DIGEST_CACHE.get(store_id)
    if cached and now - cached[0] < 3600:
        return {"text": cached[1], "generated_at": cached[0]}
    anchor = get_settings().demo_anchor_date
    samples = fetch_all(
        """SELECT r.text, rs.sentiment FROM reviews r
           JOIN review_sentiment rs USING (review_id)
           WHERE r.store_id = :store_id AND r.ts > to_date(:anchor) - INTERVAL 7 DAYS
           LIMIT 30""",
        {"store_id": store_id, "anchor": anchor},
    )
    prompt = (
        "Summarize what guests are saying about this store this week in 3 sentences:\n\n"
        + "\n".join(f"- ({s['sentiment']}) {s['text']}" for s in samples)
    )
    text = call_fm(prompt)
    _DIGEST_CACHE[store_id] = (now, text)
    return {"text": text, "generated_at": now}


class TimelinePoint(BaseModel):
    date: str
    positive: int
    neutral: int
    negative: int


@router.get("/timeline", response_model=list[TimelinePoint])
def timeline(store_id: int, days: int = 30):
    anchor = get_settings().demo_anchor_date
    return fetch_all(
        """SELECT cast(to_date(r.ts) AS string) AS date,
              count_if(rs.sentiment='positive') AS positive,
              count_if(rs.sentiment='neutral') AS neutral,
              count_if(rs.sentiment='negative') AS negative
           FROM reviews r JOIN review_sentiment rs USING (review_id)
           WHERE r.store_id = :store_id AND r.ts > to_date(:anchor) - INTERVAL :days DAYS
           GROUP BY to_date(r.ts) ORDER BY to_date(r.ts)""",
        {"store_id": store_id, "days": days, "anchor": anchor},
    )


from ..deps import get_lakebase_pool


class ReviewAction(BaseModel):
    store_id: int
    review_id: int
    action: str  # 'respond' | 'flag' | 'resolve'
    response_text: str | None = None
    manager_id: str | None = "demo-manager"


@router.post("/review-action")
async def review_action(req: ReviewAction):
    pool = await get_lakebase_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO app_review_responses (store_id, review_id, action, response_text, manager_id)
               VALUES ($1,$2,$3,$4,$5) RETURNING id""",
            req.store_id, req.review_id, req.action, req.response_text, req.manager_id,
        )
        return {"id": row["id"]}
