# src/lakehouse_market/routers/sentiment.py
from __future__ import annotations

import time

from fastapi import APIRouter
from pydantic import BaseModel

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
def inbox(store_id: int, since: str, limit: int = 30):
    rows = fetch_all(
        """SELECT r.review_id, cast(r.ts AS string) AS ts, r.source, r.rating,
                  substring(r.text, 1, 140) AS snippet,
                  rs.sentiment,
                  collect_list(rt.topic) AS topics
           FROM reviews r
           LEFT JOIN review_sentiment rs USING (review_id)
           LEFT JOIN review_topics rt USING (review_id)
           WHERE r.store_id = :store_id AND r.ts >= to_date(:since)
           GROUP BY r.review_id, r.ts, r.source, r.rating, r.text, rs.sentiment
           ORDER BY r.ts DESC LIMIT :limit""",
        {"store_id": store_id, "since": since, "limit": limit},
    )
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
    samples = fetch_all(
        """SELECT r.text, rs.sentiment FROM reviews r
           JOIN review_sentiment rs USING (review_id)
           WHERE r.store_id = :store_id AND r.ts > current_date() - INTERVAL 7 DAYS
           LIMIT 30""",
        {"store_id": store_id},
    )
    prompt = (
        "Summarize what guests are saying about this store this week in 3 sentences:\n\n"
        + "\n".join(f"- ({s['sentiment']}) {s['text']}" for s in samples)
    )
    text = call_fm(prompt)
    _DIGEST_CACHE[store_id] = (now, text)
    return {"text": text, "generated_at": now}
