# tests/test_sentiment_router.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import sentiment as sent_mod


def test_sentiment_inbox(monkeypatch):
    monkeypatch.setattr(sent_mod, "fetch_all", lambda *_a, **_k: [
        {"review_id": 9001, "ts": "2025-10-28", "source": "google", "rating": 2,
         "snippet": "Service was slow at breakfast", "sentiment": "negative", "topics": ["service speed"]}
    ])
    r = TestClient(app).get("/api/sentiment/inbox?store_id=1&since=2025-10-25")
    assert r.status_code == 200
    assert r.json()[0]["sentiment"] == "negative"


def test_sentiment_digest_cached(monkeypatch):
    monkeypatch.setattr(sent_mod, "call_fm", lambda prompt: "Two themes this week: slow service at breakfast and praise for the new bowls.")
    # also stub fetch_all so the digest's sample query returns something benign
    monkeypatch.setattr(sent_mod, "fetch_all", lambda *_a, **_k: [
        {"text": "slow service", "sentiment": "negative"}
    ])
    r = TestClient(app).get("/api/sentiment/digest?store_id=1")
    assert r.status_code == 200
    assert "themes" in r.json()["text"].lower()
