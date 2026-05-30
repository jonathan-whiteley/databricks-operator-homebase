# tests/test_static_mount.py
from pathlib import Path

from fastapi.testclient import TestClient

from lakehouse_market.app import app


def test_root_serves_index_html():
    """The built UI must be served at /. Static index.html exists because the
    UI was built into src/lakehouse_market/static/ during scaffold."""
    static = Path(__file__).resolve().parents[1] / "src/lakehouse_market/static"
    assert (static / "index.html").exists(), "UI build artifact missing; run `cd ui && npm run build`"

    client = TestClient(app)
    r = client.get("/")
    assert r.status_code == 200
    assert "Lakehouse Market" in r.text  # placeholder content from App.tsx


def test_health_endpoint_still_works():
    """Sanity: API routes register before the catch-all static mount."""
    client = TestClient(app)
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "lakehouse-market"}
