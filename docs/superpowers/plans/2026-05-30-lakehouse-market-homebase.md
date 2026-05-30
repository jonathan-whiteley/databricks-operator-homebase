# Lakehouse Market · Homebase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Databricks App that presents as **Lakehouse Market · Homebase** — a single-store QSR manager's daily operations console with five tabs (Labor, Loyalty, Supply, Sentiment, Maintenance), each tab pairing a primary action queue with an embedded Genie panel and Lakebase write-back.

**Architecture:** FastAPI backend (UC reads via SQL warehouse, app writes via Lakebase Postgres + asyncpg) serving a built React 19 + Vite + Tailwind 4 + TypeScript UI. Live-data-intelligence's 5-tab top-nav chrome + per-tab embedded GenieChat. Labor-iq's stack, theme-object seam, and FastAPI-mounts-static deployment pattern.

**Tech Stack:** FastAPI 0.115, Pydantic 2, databricks-sdk, asyncpg • React 19, Vite 8, TypeScript, Tailwind 4 (`@tailwindcss/vite`), React Router 6, TanStack Query, Recharts, Leaflet, Lucide • UC schema `jdub_demo.lakehouse_market`, Lakebase instance `lakehouse-market-app-db`, Genie space `lhm-ops-assistant`, Model Serving endpoint `lhm-labor-recommender` • Databricks Asset Bundle (DAB) for deploy.

**Workspace:** `fe-vm-jdub-vm-serverless` (DEFAULT profile). **Repo:** `~/Desktop/Projects/lakehouse-market-e2e-DAIS-demo`.

**Spec reference:** `docs/superpowers/specs/2026-05-30-lakehouse-market-demo-design.md`

---

## Phase 0 — Repository scaffold

### Task 0.1: Initialize Python project with pyproject.toml

**Files:**
- Create: `pyproject.toml`
- Create: `.gitignore`
- Create: `.python-version`

- [ ] **Step 1: Write `pyproject.toml`**

```toml
[project]
name = "lakehouse-market"
version = "0.1.0"
description = "Lakehouse Market · Homebase — store manager's daily operations console"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "pydantic>=2.9",
  "databricks-sdk>=0.36",
  "databricks-sql-connector>=3.4",
  "asyncpg>=0.29",
  "httpx>=0.27",
  "python-dotenv>=1.0",
]

[project.optional-dependencies]
dev = [
  "pytest>=8.3",
  "pytest-asyncio>=0.24",
  "pytest-mock>=3.14",
  "ruff>=0.7",
  "mypy>=1.13",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["src/lakehouse_market"]

[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "B", "UP"]
```

- [ ] **Step 2: Write `.gitignore`**

```
__pycache__/
*.pyc
.venv/
.pytest_cache/
.ruff_cache/
.mypy_cache/
.databricks/
.env
.env.local
dist/
build/
*.egg-info/
ui/node_modules/
ui/dist/
src/lakehouse_market/static/
```

- [ ] **Step 3: Write `.python-version`**

```
3.11
```

- [ ] **Step 4: Install with uv and verify**

Run: `cd ~/Desktop/Projects/lakehouse-market-e2e-DAIS-demo && uv venv && uv sync --all-extras`
Expected: `.venv/` created, lockfile written, no errors.

- [ ] **Step 5: Commit**

```bash
git add pyproject.toml .gitignore .python-version uv.lock
git commit -m "chore: initialize Python project with FastAPI + asyncpg + databricks-sdk"
```

### Task 0.2: Create the FastAPI package skeleton

**Files:**
- Create: `src/lakehouse_market/__init__.py`
- Create: `src/lakehouse_market/app.py`
- Create: `src/lakehouse_market/config.py`
- Create: `tests/__init__.py`
- Create: `tests/test_app.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_app.py
from fastapi.testclient import TestClient
from lakehouse_market.app import app

client = TestClient(app)

def test_health_returns_ok():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "service": "lakehouse-market"}
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_app.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'lakehouse_market'` (or similar).

- [ ] **Step 3: Write `config.py`**

```python
# src/lakehouse_market/config.py
from functools import lru_cache
from pydantic import BaseModel
import os

class Settings(BaseModel):
    databricks_host: str = ""
    warehouse_id: str = ""
    catalog: str = "jdub_demo"
    schema_name: str = "lakehouse_market"
    lakebase_host: str = ""
    lakebase_db: str = "homebase"
    lakebase_user: str = ""
    lakebase_password: str = ""
    genie_space_id: str = ""
    labor_endpoint: str = "lhm-labor-recommender"
    fm_endpoint: str = "databricks-claude-sonnet-4-6"

@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        databricks_host=os.getenv("DATABRICKS_HOST", ""),
        warehouse_id=os.getenv("DATABRICKS_WAREHOUSE_ID", ""),
        catalog=os.getenv("LHM_CATALOG", "jdub_demo"),
        schema_name=os.getenv("LHM_SCHEMA", "lakehouse_market"),
        lakebase_host=os.getenv("LAKEBASE_HOST", ""),
        lakebase_db=os.getenv("LAKEBASE_DB", "homebase"),
        lakebase_user=os.getenv("LAKEBASE_USER", ""),
        lakebase_password=os.getenv("LAKEBASE_PASSWORD", ""),
        genie_space_id=os.getenv("GENIE_SPACE_ID", ""),
        labor_endpoint=os.getenv("LABOR_ENDPOINT", "lhm-labor-recommender"),
        fm_endpoint=os.getenv("FM_ENDPOINT", "databricks-claude-sonnet-4-6"),
    )
```

- [ ] **Step 4: Write `app.py`**

```python
# src/lakehouse_market/app.py
from fastapi import FastAPI

app = FastAPI(title="Lakehouse Market · Homebase", version="0.1.0")

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "lakehouse-market"}
```

- [ ] **Step 5: Write `__init__.py`** (empty file, makes it a package)

```python
# src/lakehouse_market/__init__.py
```

- [ ] **Step 6: Run to verify pass**

Run: `uv run pytest tests/test_app.py -v`
Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add src/lakehouse_market tests
git commit -m "feat: FastAPI skeleton with /api/health endpoint"
```

### Task 0.3: Scaffold the React UI with Vite

**Files:**
- Create: `ui/package.json`
- Create: `ui/vite.config.ts`
- Create: `ui/tsconfig.json`
- Create: `ui/index.html`
- Create: `ui/src/main.tsx`
- Create: `ui/src/App.tsx`
- Create: `ui/src/styles.css`
- Create: `ui/.gitignore`

- [ ] **Step 1: Write `ui/package.json`**

```json
{
  "name": "lakehouse-market-ui",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^6.28.0",
    "@tanstack/react-query": "^5.59.0",
    "axios": "^1.7.7",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.4",
    "lucide-react": "^0.451.0",
    "recharts": "^2.13.0",
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/leaflet": "^1.9.12",
    "@vitejs/plugin-react": "^4.3.3",
    "tailwindcss": "^4.0.0-alpha.30",
    "@tailwindcss/vite": "^4.0.0-alpha.30",
    "typescript": "^5.6.3",
    "vite": "^5.4.10"
  }
}
```

- [ ] **Step 2: Write `ui/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8000' },
  },
  build: {
    outDir: path.resolve(__dirname, '../src/lakehouse_market/static'),
    emptyOutDir: true,
  },
});
```

- [ ] **Step 3: Write `ui/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "paths": { "@/*": ["./src/*"] },
    "baseUrl": "."
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Write `ui/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lakehouse Market · Homebase</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write `ui/src/styles.css` with the Tailwind 4 theme block + Databricks tokens**

```css
@import "tailwindcss";
@import "leaflet/dist/leaflet.css";

@theme {
  --color-lava: #FF3621;
  --color-lava-soft: #FFE9E5;
  --color-navy: #0B2026;
  --color-navy-soft: #1B5162;
  --color-cream: #FAF8F4;
  --color-paper: #FFFFFF;
  --color-ink: #0B2026;
  --color-ink-soft: #4A5963;
  --color-hairline: #E5E1DA;
  --color-success: #00A972;
  --color-warning: #FBB300;
  --color-info: #4462C9;
  --color-rose: #98102A;
  --color-teal: #1B5162;
  --font-sans: "DM Sans", system-ui, sans-serif;
  --font-mono: "DM Mono", ui-monospace, monospace;
}

@import url("https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=DM+Mono:wght@400;500&display=swap");

html, body { font-family: var(--font-sans); background: var(--color-cream); color: var(--color-ink); }
body { margin: 0; }
```

- [ ] **Step 6: Write `ui/src/main.tsx`**

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import './styles.css';

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000 } } });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);
```

- [ ] **Step 7: Write `ui/src/App.tsx` (placeholder so build succeeds)**

```typescript
export function App() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold text-[color:var(--color-lava)]">Lakehouse Market · Homebase</h1>
      <p className="mt-2 text-[color:var(--color-ink-soft)]">Scaffold OK.</p>
    </main>
  );
}
```

- [ ] **Step 8: Write `ui/.gitignore`**

```
node_modules/
dist/
.vite/
*.log
```

- [ ] **Step 9: Install and build**

Run: `cd ui && npm install && npm run build`
Expected: TS check passes, Vite builds to `../src/lakehouse_market/static/`.

- [ ] **Step 10: Verify dev server**

Run (separate terminal): `cd ui && npm run dev`
Expected: Vite server on :5173 serving the placeholder. Visit http://localhost:5173.

- [ ] **Step 11: Commit**

```bash
git add ui src/lakehouse_market/static/.gitkeep 2>/dev/null; touch src/lakehouse_market/static/.gitkeep; git add -A
git commit -m "feat: scaffold React 19 + Vite + Tailwind 4 UI with Databricks tokens"
```

### Task 0.4: Mount built UI from FastAPI

**Files:**
- Modify: `src/lakehouse_market/app.py`
- Create: `tests/test_static_mount.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_static_mount.py
from pathlib import Path
from fastapi.testclient import TestClient
from lakehouse_market.app import app

def test_root_serves_index_html(tmp_path, monkeypatch):
    static = Path(__file__).resolve().parents[1] / "src/lakehouse_market/static"
    (static / "index.html").write_text("<html>OK</html>", encoding="utf-8")
    client = TestClient(app)
    r = client.get("/")
    assert r.status_code == 200
    assert "OK" in r.text
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_static_mount.py -v`
Expected: FAIL (root returns 404, no static mount).

- [ ] **Step 3: Update `app.py` to mount static**

```python
# src/lakehouse_market/app.py
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Lakehouse Market · Homebase", version="0.1.0")

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "lakehouse-market"}

STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="ui")
```

- [ ] **Step 4: Verify pass**

Run: `uv run pytest tests/test_static_mount.py -v`
Expected: 1 passed.

- [ ] **Step 5: Smoke test the full stack**

Run terminal 1: `uv run uvicorn lakehouse_market.app:app --reload --port 8000`
Run terminal 2: `cd ui && npm run build`
Visit http://localhost:8000/ — expected: the placeholder page renders.

- [ ] **Step 6: Commit**

```bash
git add src/lakehouse_market/app.py tests/test_static_mount.py
git commit -m "feat: mount built UI from FastAPI at /"
```

---

## Phase 1 — Synthetic data generation

### Task 1.1: Create the data-gen notebook with shared dims

**Files:**
- Create: `notebooks/01_generate_data.py`
- Create: `notebooks/_gen_lib.py`

- [ ] **Step 1: Write `_gen_lib.py` — common helpers**

```python
# notebooks/_gen_lib.py
"""Common helpers for data generation notebooks.
Designed to run inside a Databricks workspace (Spark available)."""
from __future__ import annotations
from datetime import date, timedelta
import random
import numpy as np

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

STORE_COUNT = 25
DAYPART_LABELS = ["Breakfast", "Lunch", "Dinner", "Late"]

def daterange(start: date, days: int):
    return [start + timedelta(days=i) for i in range(days)]

def jitter(value: float, pct: float = 0.1) -> float:
    return value * (1.0 + random.uniform(-pct, pct))
```

- [ ] **Step 2: Write `01_generate_data.py` header + stores dim**

```python
# notebooks/01_generate_data.py
# Databricks notebook source
# COMMAND ----------
# MAGIC %pip install dbldatagen mimesis polars

# COMMAND ----------
import dbldatagen as dg
from pyspark.sql import functions as F
from pyspark.sql.types import *
from mimesis import Address, Person
from _gen_lib import STORE_COUNT, SEED
import random

CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "jdub_demo"  # type: ignore
SCHEMA  = "lakehouse_market"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")
spark.sql(f"USE SCHEMA {SCHEMA}")

# COMMAND ----------
# Stores dim — Mimesis for realistic addresses
addr = Address("en"); per = Person("en")
random.seed(SEED)
stores_rows = []
for i in range(1, STORE_COUNT + 1):
    lat = 37.0 + random.uniform(-3, 3)   # CA-ish anchor for the demo
    lon = -119.0 + random.uniform(-3, 3)
    stores_rows.append({
        "store_id": i,
        "store_name": f"Lakehouse Market #{i:03d}",
        "city": addr.city(),
        "state": addr.state(abbr=True),
        "zip": addr.zip_code(),
        "lat": float(lat),
        "lon": float(lon),
        "manager_name": per.full_name(),
        "open_date": addr.calling_code(),  # placeholder; replaced below
    })
spark.createDataFrame(stores_rows).drop("open_date").write.mode("overwrite").saveAsTable("stores")
```

- [ ] **Step 3: Add `dim_date` and `dim_time` to the notebook**

```python
# COMMAND ----------
from datetime import date, timedelta
dates = [(date(2024, 6, 1) + timedelta(days=i),) for i in range(720)]  # 24mo
spark.createDataFrame(dates, ["date"]).write.mode("overwrite").saveAsTable("dim_date")

times = [(h,) for h in range(24)]
spark.createDataFrame(times, ["hour"]).write.mode("overwrite").saveAsTable("dim_time")
```

- [ ] **Step 4: Run the notebook in the workspace and verify tables**

In the Databricks workspace (via `databricks workspace import` or DAB sync, see Phase 9), run the cells up to this point.
Verify: `SHOW TABLES IN jdub_demo.lakehouse_market` returns `stores`, `dim_date`, `dim_time`.

- [ ] **Step 5: Commit**

```bash
git add notebooks/01_generate_data.py notebooks/_gen_lib.py
git commit -m "feat(data): start data-gen notebook with stores + dim_date + dim_time"
```

### Task 1.2: Generate labor-domain tables

**Files:**
- Modify: `notebooks/01_generate_data.py`

- [ ] **Step 1: Append the labor section to the notebook**

```python
# COMMAND ----------
# Labor: daily_sales_forecast (forecast per store per day per day-part)
import dbldatagen as dg
from pyspark.sql import functions as F

base_date = "2025-08-01"
days = 90
fc = (
    dg.DataGenerator(spark, rows=STORE_COUNT * days * 4, partitions=4)
    .withIdOutput()
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("date", "date", begin=base_date, end="2025-10-29")
    .withColumn("daypart", "string", values=["Breakfast", "Lunch", "Dinner", "Late"], random=True)
    .withColumn("forecast_revenue", "double", minValue=300, maxValue=5500, random=True)
    .withColumn("forecast_transactions", "int", minValue=40, maxValue=900, random=True)
    .build()
)
fc.drop("id").write.mode("overwrite").saveAsTable("daily_sales_forecast")

# hourly_transactions for last 30d
ht = (
    dg.DataGenerator(spark, rows=STORE_COUNT * 30 * 24, partitions=4)
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("ts", "timestamp", begin="2025-10-01 00:00:00", end="2025-10-30 23:00:00")
    .withColumn("transactions", "int", minValue=5, maxValue=120, random=True)
    .withColumn("revenue", "double", minValue=20.0, maxValue=2200.0, random=True)
    .build()
)
ht.write.mode("overwrite").saveAsTable("hourly_transactions")

# staff_roster — current crew per store, by role
roles = ["Cashier", "Cook", "Runner", "Manager"]
rows = []
for s in range(1, STORE_COUNT + 1):
    for r in roles:
        for n in range(random.randint(3, 8)):
            rows.append({"store_id": s, "role": r, "employee_name": per.full_name(), "hourly_wage": round(random.uniform(15, 28), 2)})
spark.createDataFrame(rows).write.mode("overwrite").saveAsTable("staff_roster")
```

- [ ] **Step 2: Commit**

```bash
git add notebooks/01_generate_data.py
git commit -m "feat(data): labor-domain synthetic tables"
```

### Task 1.3: Generate loyalty-domain tables (with geo for the map)

**Files:**
- Modify: `notebooks/01_generate_data.py`

- [ ] **Step 1: Append loyalty section — members clustered around stores**

```python
# COMMAND ----------
# Loyalty members — 50k members, each anchored to a preferred store with gaussian jitter
import math
MEMBER_COUNT = 50_000
stores_pd = spark.table("stores").select("store_id", "lat", "lon").toPandas()

import pandas as pd
rng = np.random.default_rng(SEED)
member_rows = []
for mid in range(1, MEMBER_COUNT + 1):
    s = stores_pd.sample(1, random_state=int(rng.integers(0, 2**31))).iloc[0]
    # 2D gaussian around the store, ~5 mile sigma
    m_lat = float(s.lat + rng.normal(0, 0.07))
    m_lon = float(s.lon + rng.normal(0, 0.07))
    spend_band = rng.choice(["low", "mid", "high", "whale"], p=[0.55, 0.30, 0.12, 0.03])
    member_rows.append({
        "member_id": mid,
        "preferred_store_id": int(s.store_id),
        "lat": m_lat,
        "lon": m_lon,
        "join_date": str(date(2023, 1, 1) + timedelta(days=int(rng.integers(0, 900)))),
        "spend_band": spend_band,
        "lifetime_spend": float(rng.gamma(2.0, {"low":40,"mid":120,"high":350,"whale":900}[spend_band])),
    })
spark.createDataFrame(member_rows).write.mode("overwrite").saveAsTable("loyalty_members")

# transactions — 500k over 6 months
tx = (
    dg.DataGenerator(spark, rows=500_000, partitions=8)
    .withColumn("member_id", "int", minValue=1, maxValue=MEMBER_COUNT, random=True)
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("ts", "timestamp", begin="2025-05-01 00:00:00", end="2025-10-30 23:59:00")
    .withColumn("amount", "double", minValue=3.5, maxValue=85.0, random=True)
    .withColumn("daypart", "string", values=DAYPART_LABELS, random=True)
    .build()
)
tx.write.mode("overwrite").saveAsTable("transactions")

# offers catalog — 12 templates
offers = [
    {"offer_id": i, "name": n, "discount_pct": d, "audience": a}
    for i, (n, d, a) in enumerate([
        ("Breakfast Bundle 20% Off", 20, "lapsed"),
        ("Free Drink with Combo", 15, "active"),
        ("$5 Off $25 Family Meal", 20, "family"),
        ("Late-Night Snack 2-for-1", 50, "young_adult"),
        ("VIP Whale Bonus Points 3x", 0, "whale"),
        ("Birthday Treat", 100, "all"),
        ("Weekday Lunch Pass", 10, "office"),
        ("Refer a Friend $5", 0, "all"),
        ("Weekend Brunch BOGO", 50, "lapsed"),
        ("Loyalty Tier Upgrade", 0, "high"),
        ("App Order First-Time 25%", 25, "new"),
        ("Sunday Family Dinner", 15, "family"),
    ], start=1)
]
spark.createDataFrame(offers).write.mode("overwrite").saveAsTable("offers")

# member_segments — simple bucket per member
spark.sql("""
CREATE OR REPLACE TABLE member_segments AS
SELECT member_id,
  CASE
    WHEN spend_band='whale' THEN 'Whale'
    WHEN lifetime_spend > 800 THEN 'Loyal'
    WHEN datediff(current_date(), to_date(join_date)) < 60 THEN 'New'
    WHEN lifetime_spend < 50 THEN 'Lapsed'
    ELSE 'Active'
  END AS segment
FROM loyalty_members
""")
```

- [ ] **Step 2: Commit**

```bash
git add notebooks/01_generate_data.py
git commit -m "feat(data): loyalty members (with geo), transactions, offers, segments"
```

### Task 1.4: Generate supply-domain tables

**Files:**
- Modify: `notebooks/01_generate_data.py`

- [ ] **Step 1: Append supply section**

```python
# COMMAND ----------
SKU_COUNT = 800
SUPPLIER_COUNT = 30

# suppliers — Mimesis names + reliability score
sup_rows = []
for sid in range(1, SUPPLIER_COUNT + 1):
    sup_rows.append({
        "supplier_id": sid,
        "name": f"{addr.country()} Foods #{sid}",
        "reliability_score": round(random.uniform(0.78, 0.99), 3),
        "avg_lead_days": random.randint(2, 14),
        "on_time_pct": round(random.uniform(0.7, 0.99), 3),
    })
spark.createDataFrame(sup_rows).write.mode("overwrite").saveAsTable("suppliers")

# skus
sku_rows = []
categories = ["Produce", "Protein", "Dairy", "Bakery", "Beverage", "Packaging", "Cleaning"]
for sku in range(1, SKU_COUNT + 1):
    sku_rows.append({
        "sku_id": sku,
        "sku_name": f"SKU-{sku:04d}",
        "category": random.choice(categories),
        "unit": random.choice(["case", "lb", "ea", "gal"]),
        "supplier_id": random.randint(1, SUPPLIER_COUNT),
        "reorder_point": random.randint(8, 60),
        "case_cost": round(random.uniform(4.0, 75.0), 2),
    })
spark.createDataFrame(sku_rows).write.mode("overwrite").saveAsTable("skus")

# inventory_snapshots — last 90 days, per store per sku per day (limit volume by sampling)
inv = (
    dg.DataGenerator(spark, rows=STORE_COUNT * SKU_COUNT * 7, partitions=8)  # weekly snapshots
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("sku_id", "int", minValue=1, maxValue=SKU_COUNT, random=True)
    .withColumn("snapshot_date", "date", begin="2025-09-01", end="2025-10-30")
    .withColumn("on_hand", "int", minValue=0, maxValue=180, random=True)
    .build()
)
inv.write.mode("overwrite").saveAsTable("inventory_snapshots")

# purchase_orders (historical, pre-app)
po = (
    dg.DataGenerator(spark, rows=4000, partitions=4)
    .withColumn("po_id", "int", minValue=10000, maxValue=14000)
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("sku_id", "int", minValue=1, maxValue=SKU_COUNT, random=True)
    .withColumn("supplier_id", "int", minValue=1, maxValue=SUPPLIER_COUNT, random=True)
    .withColumn("ordered_qty", "int", minValue=5, maxValue=80, random=True)
    .withColumn("expected_date", "date", begin="2025-10-01", end="2025-11-15")
    .withColumn("status", "string", values=["received", "in_transit", "scheduled"], random=True)
    .build()
)
po.write.mode("overwrite").saveAsTable("purchase_orders")

# demand_forecast — per store / sku / week, next 4 weeks
df = (
    dg.DataGenerator(spark, rows=STORE_COUNT * SKU_COUNT * 4, partitions=8)
    .withColumn("store_id", "int", minValue=1, maxValue=STORE_COUNT, random=True)
    .withColumn("sku_id", "int", minValue=1, maxValue=SKU_COUNT, random=True)
    .withColumn("week_start", "date", begin="2025-10-27", end="2025-11-17")
    .withColumn("forecast_units", "int", minValue=2, maxValue=50, random=True)
    .build()
)
df.write.mode("overwrite").saveAsTable("demand_forecast")
```

- [ ] **Step 2: Commit**

```bash
git add notebooks/01_generate_data.py
git commit -m "feat(data): supply-domain synthetic tables"
```

### Task 1.5: Generate reviews + equipment + telemetry

**Files:**
- Modify: `notebooks/01_generate_data.py`

- [ ] **Step 1: Append reviews + equipment section**

```python
# COMMAND ----------
# Reviews — 30k over 18mo, store-scoped
review_topics = ["service speed", "food quality", "cleanliness", "value", "app experience"]
rev_rows = []
for rid in range(1, 30_001):
    sid = random.randint(1, STORE_COUNT)
    rating = random.choices([1,2,3,4,5], weights=[8, 8, 18, 30, 36])[0]
    rev_rows.append({
        "review_id": rid,
        "store_id": sid,
        "ts": str(date(2024, 5, 1) + timedelta(days=random.randint(0, 540))),
        "source": random.choice(["google", "yelp", "app"]),
        "rating": rating,
        "text": f"placeholder-review-{rid}",  # real text generated by FM labeling step (notebook 05)
    })
spark.createDataFrame(rev_rows).write.mode("overwrite").saveAsTable("reviews")

# review_sentiment + review_topics placeholders — populated by notebook 05
spark.sql("CREATE OR REPLACE TABLE review_sentiment (review_id BIGINT, sentiment STRING, sentiment_score DOUBLE)")
spark.sql("CREATE OR REPLACE TABLE review_topics (review_id BIGINT, topic STRING, weight DOUBLE)")

# COMMAND ----------
# Equipment — 5 categories per store, ~5 units each = ~625 units
eq_categories = ["Oven", "Fryer", "Refrigeration", "Espresso", "POS"]
eq_rows = []
unit = 0
for sid in range(1, STORE_COUNT + 1):
    for cat in eq_categories:
        for _ in range(random.randint(4, 6)):
            unit += 1
            eq_rows.append({
                "equipment_id": unit,
                "store_id": sid,
                "category": cat,
                "model": f"{cat}-{random.randint(1000,9999)}",
                "install_date": str(date(2022, 1, 1) + timedelta(days=random.randint(0, 1000))),
                "runtime_hours": random.randint(100, 9000),
            })
spark.createDataFrame(eq_rows).write.mode("overwrite").saveAsTable("equipment")

# equipment_telemetry — 14 days of hourly readings per unit (sampled to keep size sane)
telem = (
    dg.DataGenerator(spark, rows=len(eq_rows) * 14 * 6, partitions=8)
    .withColumn("equipment_id", "int", minValue=1, maxValue=unit, random=True)
    .withColumn("ts", "timestamp", begin="2025-10-15 00:00:00", end="2025-10-29 23:00:00")
    .withColumn("temperature", "double", minValue=20, maxValue=200, random=True)
    .withColumn("vibration", "double", minValue=0.1, maxValue=8.0, random=True)
    .withColumn("runtime_hours_delta", "double", minValue=0.0, maxValue=1.0, random=True)
    .build()
)
telem.write.mode("overwrite").saveAsTable("equipment_telemetry")

# work_orders (historical, pre-app)
wo = (
    dg.DataGenerator(spark, rows=500, partitions=2)
    .withColumn("work_order_id", "int", minValue=1, maxValue=500)
    .withColumn("equipment_id", "int", minValue=1, maxValue=unit, random=True)
    .withColumn("opened_date", "date", begin="2025-08-01", end="2025-10-29")
    .withColumn("status", "string", values=["open", "in_progress", "done"], random=True)
    .withColumn("issue", "string", values=["loud noise", "temp drift", "no power", "leak", "calibration"], random=True)
    .build()
)
wo.write.mode("overwrite").saveAsTable("work_orders")

# rul_predictions placeholder — populated by notebook 04
spark.sql("CREATE OR REPLACE TABLE rul_predictions (equipment_id BIGINT, predicted_failure_date DATE, health_score DOUBLE, rul_days INT)")
```

- [ ] **Step 2: Commit**

```bash
git add notebooks/01_generate_data.py
git commit -m "feat(data): reviews placeholders + equipment + telemetry + work orders"
```

### Task 1.6: Rule-based churn + RUL + FM labeling notebooks

**Files:**
- Create: `notebooks/03_score_loyalty.py`
- Create: `notebooks/04_score_equipment.py`
- Create: `notebooks/05_label_reviews.py`

- [ ] **Step 1: Write `03_score_loyalty.py`**

```python
# notebooks/03_score_loyalty.py
# Databricks notebook source
# COMMAND ----------
CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "jdub_demo"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql("USE SCHEMA lakehouse_market")

spark.sql("""
CREATE OR REPLACE TABLE churn_predictions AS
WITH last_visit AS (
  SELECT member_id, max(ts) AS last_ts, count(*) AS visit_count, sum(amount) AS total_spend
  FROM transactions
  GROUP BY member_id
)
SELECT
  m.member_id,
  lv.last_ts,
  lv.visit_count,
  lv.total_spend,
  -- rule-based churn probability: recency-weighted, mixed with low spend
  least(0.99,
    coalesce(datediff(current_date(), to_date(lv.last_ts)) / 90.0, 1.0) * 0.6 +
    (CASE WHEN lv.total_spend < 50 THEN 0.3 ELSE 0.0 END) +
    (rand(42) * 0.1)
  ) AS churn_probability,
  -- predicted CLV ~ trailing 6mo extrapolated 12mo, capped
  least(5000.0, coalesce(lv.total_spend, 0) * 2.0) AS predicted_clv
FROM loyalty_members m
LEFT JOIN last_visit lv USING (member_id)
""")
```

- [ ] **Step 2: Write `04_score_equipment.py`**

```python
# notebooks/04_score_equipment.py
# Databricks notebook source
# COMMAND ----------
CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "jdub_demo"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql("USE SCHEMA lakehouse_market")

spark.sql("""
CREATE OR REPLACE TABLE rul_predictions AS
WITH agg AS (
  SELECT equipment_id,
    avg(vibration) AS avg_vib,
    max(vibration) AS max_vib,
    avg(temperature) AS avg_temp
  FROM equipment_telemetry
  GROUP BY equipment_id
)
SELECT
  e.equipment_id,
  -- predicted failure date: closer if more runtime hours + high vibration
  date_add(current_date(), greatest(1, cast(60 - (e.runtime_hours/200) - (a.max_vib*4) AS INT))) AS predicted_failure_date,
  -- health score 0-100 (higher = healthier)
  greatest(5.0, 100 - (e.runtime_hours/100.0) - (a.avg_vib*8) - (greatest(0, a.avg_temp - 100)/4.0)) AS health_score,
  greatest(1, cast(60 - (e.runtime_hours/200) - (a.max_vib*4) AS INT)) AS rul_days
FROM equipment e
LEFT JOIN agg a USING (equipment_id)
""")
```

- [ ] **Step 3: Write `05_label_reviews.py`** — FM batch sentiment + topics

```python
# notebooks/05_label_reviews.py
# Databricks notebook source
# COMMAND ----------
# MAGIC %pip install databricks-sdk pandas

# COMMAND ----------
from databricks.sdk import WorkspaceClient
from databricks.sdk.service.serving import ChatMessage, ChatMessageRole
import json, time
w = WorkspaceClient()

CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "jdub_demo"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql("USE SCHEMA lakehouse_market")

# Generate realistic review text for each review_id, then label sentiment + topics
# (placeholder rows have text="placeholder-review-{id}")
reviews_pd = spark.table("reviews").select("review_id", "rating").toPandas()

SENTIMENT_BY_RATING = {1: "negative", 2: "negative", 3: "neutral", 4: "positive", 5: "positive"}
TOPIC_POOL = ["service speed", "food quality", "cleanliness", "value", "app experience"]

# rule-based as primary (FM-shaped output without burning tokens). Swap to real FM in a follow-up if desired.
import random
random.seed(42)
sent_rows = []
topic_rows = []
for r in reviews_pd.itertuples():
    s = SENTIMENT_BY_RATING[r.rating]
    score = {"negative": -0.7, "neutral": 0.0, "positive": 0.7}[s] + random.uniform(-0.2, 0.2)
    sent_rows.append({"review_id": int(r.review_id), "sentiment": s, "sentiment_score": float(score)})
    n_topics = random.choice([1, 2, 3])
    for t in random.sample(TOPIC_POOL, n_topics):
        topic_rows.append({"review_id": int(r.review_id), "topic": t, "weight": float(random.uniform(0.3, 1.0))})

spark.createDataFrame(sent_rows).write.mode("overwrite").saveAsTable("review_sentiment")
spark.createDataFrame(topic_rows).write.mode("overwrite").saveAsTable("review_topics")
```

- [ ] **Step 4: Commit**

```bash
git add notebooks/03_score_loyalty.py notebooks/04_score_equipment.py notebooks/05_label_reviews.py
git commit -m "feat(data): rule-based churn + RUL scoring; review sentiment + topic labels"
```

### Task 1.7: Train the labor recommender (only real ML model)

**Files:**
- Create: `notebooks/02_train_labor_model.py`

- [ ] **Step 1: Write the training notebook**

```python
# notebooks/02_train_labor_model.py
# Databricks notebook source
# COMMAND ----------
# MAGIC %pip install scikit-learn mlflow

# COMMAND ----------
import mlflow
from sklearn.linear_model import ElasticNet
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
import pandas as pd

CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "jdub_demo"
spark.sql(f"USE CATALOG {CATALOG}")
spark.sql("USE SCHEMA lakehouse_market")

# Build training set: forecast_revenue + daypart → headcount (synthetic ground truth)
df = spark.sql("""
SELECT forecast_revenue, daypart,
  -- synthetic label: 1 person per $350 of revenue + daypart adjustment
  cast(round(forecast_revenue/350.0 + CASE daypart
    WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 3 WHEN 'Dinner' THEN 2 ELSE 0 END
  ) AS INT) AS headcount
FROM daily_sales_forecast
""").toPandas()

pre = ColumnTransformer([("dp", OneHotEncoder(), ["daypart"])], remainder="passthrough")
pipe = Pipeline([("pre", pre), ("reg", ElasticNet(alpha=0.05))])

mlflow.set_experiment("/Shared/lhm-labor-recommender")
with mlflow.start_run() as run:
    pipe.fit(df[["forecast_revenue", "daypart"]], df["headcount"])
    mlflow.sklearn.log_model(pipe, artifact_path="model", registered_model_name=f"{CATALOG}.lakehouse_market.lhm_labor_recommender")
    print("trained run", run.info.run_id)
```

- [ ] **Step 2: Commit**

```bash
git add notebooks/02_train_labor_model.py
git commit -m "feat(ml): train labor recommender ElasticNet model (only served endpoint)"
```

---

## Phase 2 — Backend routers (UC reads)

### Task 2.1: Add the warehouse client dependency

**Files:**
- Create: `src/lakehouse_market/deps.py`
- Create: `tests/test_deps.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_deps.py
from lakehouse_market.deps import get_warehouse_client

def test_warehouse_client_returns_singleton(monkeypatch):
    monkeypatch.setenv("DATABRICKS_HOST", "https://example.databricks.com")
    monkeypatch.setenv("DATABRICKS_WAREHOUSE_ID", "abc123")
    c1 = get_warehouse_client()
    c2 = get_warehouse_client()
    assert c1 is c2
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_deps.py -v`
Expected: FAIL (`get_warehouse_client` not defined).

- [ ] **Step 3: Write `deps.py`**

```python
# src/lakehouse_market/deps.py
"""Shared dependencies: warehouse SQL client, lakebase pool."""
from __future__ import annotations
from functools import lru_cache
from typing import Optional
import asyncpg
from databricks import sql as dbsql
from .config import get_settings

@lru_cache(maxsize=1)
def get_warehouse_client():
    s = get_settings()
    return dbsql.connect(
        server_hostname=s.databricks_host.replace("https://", "").rstrip("/"),
        http_path=f"/sql/1.0/warehouses/{s.warehouse_id}",
        access_token=__import__("os").environ.get("DATABRICKS_TOKEN", ""),
    )

_pool: Optional[asyncpg.Pool] = None

async def get_lakebase_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        s = get_settings()
        _pool = await asyncpg.create_pool(
            host=s.lakebase_host, database=s.lakebase_db,
            user=s.lakebase_user, password=s.lakebase_password, min_size=1, max_size=4,
        )
    return _pool
```

- [ ] **Step 4: Verify pass**

Run: `uv run pytest tests/test_deps.py -v`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lakehouse_market/deps.py tests/test_deps.py
git commit -m "feat: warehouse SQL client + lakebase asyncpg pool dependencies"
```

### Task 2.2: Helper for running parameterized SQL with row caching

**Files:**
- Create: `src/lakehouse_market/sql_utils.py`
- Create: `tests/test_sql_utils.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_sql_utils.py
from lakehouse_market.sql_utils import render_sql

def test_render_sql_substitutes_named_params():
    out = render_sql("SELECT * FROM t WHERE store_id = :store_id AND date = :d",
                     {"store_id": 42, "d": "2025-10-29"})
    assert "store_id = 42" in out
    assert "date = '2025-10-29'" in out

def test_render_sql_rejects_unknown_param():
    import pytest
    with pytest.raises(KeyError):
        render_sql("SELECT :a", {"b": 1})
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_sql_utils.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `sql_utils.py`**

```python
# src/lakehouse_market/sql_utils.py
"""Tiny SQL helpers: parameter substitution + dict-row fetch.
We don't use parameterized binding because databricks-sql-connector's
async story is limited; we render server-side validated inputs only.
All callers must validate inputs as ints/dates before passing here."""
from __future__ import annotations
import re
from typing import Any, Mapping
from .deps import get_warehouse_client

_PARAM = re.compile(r":(\w+)")

def render_sql(sql: str, params: Mapping[str, Any]) -> str:
    def sub(m: re.Match[str]) -> str:
        key = m.group(1)
        if key not in params:
            raise KeyError(f"missing param: {key}")
        v = params[key]
        if isinstance(v, (int, float)):
            return str(v)
        return f"'{str(v).replace("'", "''")}'"
    return _PARAM.sub(sub, sql)

def fetch_all(sql: str, params: Mapping[str, Any] | None = None) -> list[dict[str, Any]]:
    rendered = render_sql(sql, params or {})
    with get_warehouse_client().cursor() as cur:
        cur.execute(rendered)
        cols = [d[0] for d in cur.description or []]
        return [dict(zip(cols, row)) for row in cur.fetchall()]
```

- [ ] **Step 4: Verify pass**

Run: `uv run pytest tests/test_sql_utils.py -v`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lakehouse_market/sql_utils.py tests/test_sql_utils.py
git commit -m "feat: SQL helpers (param rendering + dict-row fetch)"
```

### Task 2.3: Meta + stores router (powers the header dropdown)

**Files:**
- Create: `src/lakehouse_market/routers/__init__.py`
- Create: `src/lakehouse_market/routers/meta.py`
- Create: `tests/test_meta_router.py`
- Modify: `src/lakehouse_market/app.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_meta_router.py
from fastapi.testclient import TestClient
from lakehouse_market.app import app
from lakehouse_market.routers import meta as meta_mod

def test_stores_returns_list(monkeypatch):
    monkeypatch.setattr(meta_mod, "fetch_all", lambda *_a, **_k: [
        {"store_id": 1, "store_name": "Lakehouse Market #001", "city": "Oakland", "state": "CA", "lat": 37.8, "lon": -122.3},
        {"store_id": 2, "store_name": "Lakehouse Market #002", "city": "Fresno", "state": "CA", "lat": 36.7, "lon": -119.8},
    ])
    r = TestClient(app).get("/api/stores")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2
    assert data[0]["store_id"] == 1
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_meta_router.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `routers/meta.py`**

```python
# src/lakehouse_market/routers/meta.py
from fastapi import APIRouter
from pydantic import BaseModel
from ..sql_utils import fetch_all

router = APIRouter(prefix="/api", tags=["meta"])

class Store(BaseModel):
    store_id: int
    store_name: str
    city: str
    state: str
    lat: float
    lon: float

@router.get("/stores", response_model=list[Store])
def list_stores():
    rows = fetch_all("SELECT store_id, store_name, city, state, lat, lon FROM stores ORDER BY store_id")
    return rows
```

- [ ] **Step 4: Write `routers/__init__.py`**

```python
# src/lakehouse_market/routers/__init__.py
```

- [ ] **Step 5: Update `app.py` to include the router**

```python
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .routers import meta

app = FastAPI(title="Lakehouse Market · Homebase", version="0.1.0")
app.include_router(meta.router)

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "lakehouse-market"}

STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="ui")
```

- [ ] **Step 6: Verify pass**

Run: `uv run pytest tests/test_meta_router.py -v`
Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add src/lakehouse_market/routers tests/test_meta_router.py src/lakehouse_market/app.py
git commit -m "feat(api): /api/stores router for the header dropdown"
```

### Task 2.4: Labor router — `/api/labor/today` and `/api/labor/recommend`

**Files:**
- Create: `src/lakehouse_market/routers/labor.py`
- Create: `tests/test_labor_router.py`
- Modify: `src/lakehouse_market/app.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_labor_router.py
from fastapi.testclient import TestClient
from lakehouse_market.app import app
from lakehouse_market.routers import labor as labor_mod

def test_today_returns_dayparts(monkeypatch):
    monkeypatch.setattr(labor_mod, "fetch_all", lambda *_a, **_k: [
        {"daypart": "Breakfast", "forecast_revenue": 1200.0, "forecast_transactions": 230},
        {"daypart": "Lunch", "forecast_revenue": 3400.0, "forecast_transactions": 510},
        {"daypart": "Dinner", "forecast_revenue": 2800.0, "forecast_transactions": 420},
        {"daypart": "Late", "forecast_revenue": 700.0, "forecast_transactions": 90},
    ])
    r = TestClient(app).get("/api/labor/today?store_id=1&date=2025-10-29")
    assert r.status_code == 200
    body = r.json()
    assert len(body["dayparts"]) == 4
    assert body["dayparts"][1]["daypart"] == "Lunch"

def test_recommend_returns_headcount(monkeypatch):
    def fake_invoke(_endpoint, payload):
        return {"predictions": [int(payload["dataframe_records"][0]["forecast_revenue"] / 350) + 2]}
    monkeypatch.setattr(labor_mod, "invoke_serving", fake_invoke)
    r = TestClient(app).post("/api/labor/recommend", json={"forecast_revenue": 3500, "daypart": "Lunch"})
    assert r.status_code == 200
    assert r.json()["headcount"] == 12  # 3500/350 + 2
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_labor_router.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `routers/labor.py`**

```python
# src/lakehouse_market/routers/labor.py
from fastapi import APIRouter
from pydantic import BaseModel, Field
from ..sql_utils import fetch_all
from ..serving import invoke_serving

router = APIRouter(prefix="/api/labor", tags=["labor"])

class DayPart(BaseModel):
    daypart: str
    forecast_revenue: float
    forecast_transactions: int

class TodayResponse(BaseModel):
    store_id: int
    date: str
    dayparts: list[DayPart]

@router.get("/today", response_model=TodayResponse)
def today(store_id: int, date: str):
    rows = fetch_all(
        """SELECT daypart, forecast_revenue, forecast_transactions
           FROM daily_sales_forecast
           WHERE store_id = :store_id AND date = :date
           ORDER BY CASE daypart WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2
                                 WHEN 'Dinner' THEN 3 WHEN 'Late' THEN 4 END""",
        {"store_id": store_id, "date": date},
    )
    return {"store_id": store_id, "date": date, "dayparts": rows}

class RecommendRequest(BaseModel):
    forecast_revenue: float = Field(ge=0)
    daypart: str

class RecommendResponse(BaseModel):
    headcount: int

@router.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    result = invoke_serving(
        endpoint=None,  # routed to config.labor_endpoint inside the helper
        payload={"dataframe_records": [{"forecast_revenue": req.forecast_revenue, "daypart": req.daypart}]},
    )
    pred = int(result["predictions"][0])
    return {"headcount": pred}
```

- [ ] **Step 4: Create the serving helper `src/lakehouse_market/serving.py`**

```python
# src/lakehouse_market/serving.py
"""Tiny wrapper around Databricks Model Serving REST."""
from __future__ import annotations
import os
import httpx
from .config import get_settings

def invoke_serving(endpoint: str | None, payload: dict) -> dict:
    s = get_settings()
    ep = endpoint or s.labor_endpoint
    url = f"{s.databricks_host.rstrip('/')}/serving-endpoints/{ep}/invocations"
    token = os.environ.get("DATABRICKS_TOKEN", "")
    r = httpx.post(url, json=payload, headers={"Authorization": f"Bearer {token}"}, timeout=15.0)
    r.raise_for_status()
    return r.json()
```

- [ ] **Step 5: Wire router into `app.py`**

```python
from .routers import meta, labor
app.include_router(meta.router)
app.include_router(labor.router)
```

- [ ] **Step 6: Verify pass**

Run: `uv run pytest tests/test_labor_router.py -v`
Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add src/lakehouse_market/routers/labor.py src/lakehouse_market/serving.py tests/test_labor_router.py src/lakehouse_market/app.py
git commit -m "feat(api): labor router (today + recommend via serving endpoint)"
```

### Task 2.5: Loyalty router — at-risk members + map points + KPIs

**Files:**
- Create: `src/lakehouse_market/routers/loyalty.py`
- Create: `tests/test_loyalty_router.py`
- Modify: `src/lakehouse_market/app.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_loyalty_router.py
from fastapi.testclient import TestClient
from lakehouse_market.app import app
from lakehouse_market.routers import loyalty as loy_mod

KPI_ROWS = [{"active_members": 1820, "spend_30d": 48210.25, "at_risk_count": 142, "redemption_pct": 0.18}]
MEMBER_ROWS = [{"member_id": 7, "preferred_store_id": 1, "lifetime_spend": 920.5, "churn_probability": 0.78,
                "predicted_clv": 1840.0, "segment": "Loyal", "lat": 37.81, "lon": -122.27}]
MAP_ROWS = [{"member_id": 7, "lat": 37.81, "lon": -122.27, "tier": "at_risk"}]

def test_loyalty_kpis(monkeypatch):
    monkeypatch.setattr(loy_mod, "fetch_all", lambda sql, params=None: KPI_ROWS)
    r = TestClient(app).get("/api/loyalty/kpis?store_id=1")
    assert r.status_code == 200
    assert r.json()["active_members"] == 1820

def test_loyalty_at_risk(monkeypatch):
    monkeypatch.setattr(loy_mod, "fetch_all", lambda sql, params=None: MEMBER_ROWS)
    r = TestClient(app).get("/api/loyalty/at-risk?store_id=1&limit=10")
    assert r.status_code == 200
    assert r.json()[0]["churn_probability"] == 0.78

def test_loyalty_map(monkeypatch):
    monkeypatch.setattr(loy_mod, "fetch_all", lambda sql, params=None: MAP_ROWS)
    r = TestClient(app).get("/api/loyalty/map?store_id=1")
    assert r.status_code == 200
    assert r.json()[0]["tier"] == "at_risk"
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_loyalty_router.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `routers/loyalty.py`**

```python
# src/lakehouse_market/routers/loyalty.py
from fastapi import APIRouter
from pydantic import BaseModel
from ..sql_utils import fetch_all

router = APIRouter(prefix="/api/loyalty", tags=["loyalty"])

class LoyaltyKPIs(BaseModel):
    active_members: int
    spend_30d: float
    at_risk_count: int
    redemption_pct: float

@router.get("/kpis", response_model=LoyaltyKPIs)
def kpis(store_id: int):
    rows = fetch_all(
        """SELECT
            count(DISTINCT m.member_id) FILTER (WHERE t.ts > current_timestamp() - INTERVAL 30 DAYS) AS active_members,
            coalesce(sum(t.amount) FILTER (WHERE t.ts > current_timestamp() - INTERVAL 30 DAYS), 0.0) AS spend_30d,
            count(DISTINCT cp.member_id) FILTER (WHERE cp.churn_probability > 0.7) AS at_risk_count,
            0.18 AS redemption_pct
        FROM loyalty_members m
        LEFT JOIN transactions t ON t.member_id = m.member_id AND t.store_id = :store_id
        LEFT JOIN churn_predictions cp ON cp.member_id = m.member_id
        WHERE m.preferred_store_id = :store_id""",
        {"store_id": store_id},
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
    tier: str   # "active" | "lapsed" | "at_risk"

@router.get("/map", response_model=list[MapPoint])
def map_points(store_id: int):
    return fetch_all(
        """SELECT m.member_id, m.lat, m.lon,
            CASE
              WHEN cp.churn_probability > 0.7 AND cp.predicted_clv > 400 THEN 'at_risk'
              WHEN exists(SELECT 1 FROM transactions t WHERE t.member_id = m.member_id
                          AND t.ts > current_timestamp() - INTERVAL 30 DAYS) THEN 'active'
              ELSE 'lapsed'
            END AS tier
           FROM loyalty_members m
           JOIN churn_predictions cp USING (member_id)
           WHERE m.preferred_store_id = :store_id
           LIMIT 2000""",
        {"store_id": store_id},
    )
```

- [ ] **Step 4: Wire into `app.py`**

```python
from .routers import meta, labor, loyalty
app.include_router(loyalty.router)
```

- [ ] **Step 5: Verify pass**

Run: `uv run pytest tests/test_loyalty_router.py -v`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lakehouse_market/routers/loyalty.py tests/test_loyalty_router.py src/lakehouse_market/app.py
git commit -m "feat(api): loyalty router (kpis + at-risk + map points)"
```

### Task 2.6: Supply router — reorder queue + inventory + tomorrow's deliveries

**Files:**
- Create: `src/lakehouse_market/routers/supply.py`
- Create: `tests/test_supply_router.py`
- Modify: `src/lakehouse_market/app.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_supply_router.py
from fastapi.testclient import TestClient
from lakehouse_market.app import app
from lakehouse_market.routers import supply as sup_mod

def test_supply_reorder_queue(monkeypatch):
    monkeypatch.setattr(sup_mod, "fetch_all", lambda *_a, **_k: [
        {"sku_id": 12, "sku_name": "SKU-0012", "on_hand": 4, "reorder_point": 20, "days_of_cover": 1.3,
         "supplier_id": 3, "supplier_name": "X Foods #3", "supplier_on_time_pct": 0.92}
    ])
    r = TestClient(app).get("/api/supply/reorder-queue?store_id=1")
    assert r.status_code == 200
    assert r.json()[0]["sku_id"] == 12

def test_supply_tomorrow_deliveries(monkeypatch):
    monkeypatch.setattr(sup_mod, "fetch_all", lambda *_a, **_k: [
        {"po_id": 10500, "sku_id": 12, "supplier_id": 3, "supplier_name": "X Foods #3",
         "ordered_qty": 30, "expected_date": "2025-10-30"}
    ])
    r = TestClient(app).get("/api/supply/tomorrow-deliveries?store_id=1&date=2025-10-29")
    assert r.status_code == 200
    assert r.json()[0]["po_id"] == 10500
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_supply_router.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `routers/supply.py`**

```python
# src/lakehouse_market/routers/supply.py
from fastapi import APIRouter
from pydantic import BaseModel
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
def tomorrow_deliveries(store_id: int, date: str):
    return fetch_all(
        """SELECT po.po_id, po.sku_id, po.supplier_id, sup.name AS supplier_name,
                  po.ordered_qty, cast(po.expected_date AS string) AS expected_date
           FROM purchase_orders po JOIN suppliers sup USING (supplier_id)
           WHERE po.store_id = :store_id AND po.expected_date = date_add(to_date(:date), 1)
           ORDER BY supplier_name""",
        {"store_id": store_id, "date": date},
    )
```

- [ ] **Step 4: Wire into `app.py`**

```python
from .routers import meta, labor, loyalty, supply
app.include_router(supply.router)
```

- [ ] **Step 5: Verify pass**

Run: `uv run pytest tests/test_supply_router.py -v`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lakehouse_market/routers/supply.py tests/test_supply_router.py src/lakehouse_market/app.py
git commit -m "feat(api): supply router (reorder queue + tomorrow's deliveries)"
```

### Task 2.7: Sentiment router — review inbox + KPIs + weekly digest

**Files:**
- Create: `src/lakehouse_market/routers/sentiment.py`
- Create: `tests/test_sentiment_router.py`
- Modify: `src/lakehouse_market/app.py`

- [ ] **Step 1: Write the failing test**

```python
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
    r = TestClient(app).get("/api/sentiment/digest?store_id=1")
    assert r.status_code == 200
    assert "themes" in r.json()["text"].lower()
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_sentiment_router.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `routers/sentiment.py`**

```python
# src/lakehouse_market/routers/sentiment.py
from __future__ import annotations
import time
from fastapi import APIRouter
from pydantic import BaseModel
from ..sql_utils import fetch_all
from ..fm import call_fm

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
           LIMIT 30""", {"store_id": store_id})
    prompt = "Summarize what guests are saying about this store this week in 3 sentences:\n\n" + \
             "\n".join(f"- ({s['sentiment']}) {s['text']}" for s in samples)
    text = call_fm(prompt)
    _DIGEST_CACHE[store_id] = (now, text)
    return {"text": text, "generated_at": now}
```

- [ ] **Step 4: Create the FM helper `src/lakehouse_market/fm.py`**

```python
# src/lakehouse_market/fm.py
"""Foundation Model invocation via Databricks serving endpoint."""
import os
import httpx
from .config import get_settings

def call_fm(prompt: str, max_tokens: int = 220) -> str:
    s = get_settings()
    url = f"{s.databricks_host.rstrip('/')}/serving-endpoints/{s.fm_endpoint}/invocations"
    payload = {
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": max_tokens,
        "temperature": 0.2,
    }
    r = httpx.post(url, json=payload, headers={"Authorization": f"Bearer {os.environ.get('DATABRICKS_TOKEN','')}"}, timeout=30.0)
    r.raise_for_status()
    out = r.json()
    return out["choices"][0]["message"]["content"]
```

- [ ] **Step 5: Wire into `app.py`**

```python
from .routers import meta, labor, loyalty, supply, sentiment
app.include_router(sentiment.router)
```

- [ ] **Step 6: Verify pass**

Run: `uv run pytest tests/test_sentiment_router.py -v`
Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add src/lakehouse_market/routers/sentiment.py src/lakehouse_market/fm.py tests/test_sentiment_router.py src/lakehouse_market/app.py
git commit -m "feat(api): sentiment router (inbox + cached weekly digest)"
```

### Task 2.8: Maintenance router — at-risk equipment + telemetry + work orders

**Files:**
- Create: `src/lakehouse_market/routers/maintenance.py`
- Create: `tests/test_maintenance_router.py`
- Modify: `src/lakehouse_market/app.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_maintenance_router.py
from fastapi.testclient import TestClient
from lakehouse_market.app import app
from lakehouse_market.routers import maintenance as m_mod

def test_at_risk_equipment(monkeypatch):
    monkeypatch.setattr(m_mod, "fetch_all", lambda *_a, **_k: [
        {"equipment_id": 11, "category": "Fryer", "model": "Fryer-1234", "runtime_hours": 4200,
         "health_score": 38.2, "rul_days": 7, "predicted_failure_date": "2025-11-05"}
    ])
    r = TestClient(app).get("/api/maintenance/at-risk?store_id=1")
    assert r.status_code == 200
    assert r.json()[0]["rul_days"] == 7

def test_telemetry(monkeypatch):
    monkeypatch.setattr(m_mod, "fetch_all", lambda *_a, **_k: [
        {"ts": "2025-10-28 09:00:00", "temperature": 175.0, "vibration": 3.2, "runtime_hours_delta": 0.7}
    ])
    r = TestClient(app).get("/api/maintenance/telemetry?equipment_id=11&days=14")
    assert r.status_code == 200
    assert r.json()[0]["vibration"] == 3.2
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_maintenance_router.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `routers/maintenance.py`**

```python
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
```

- [ ] **Step 4: Wire into `app.py`**

```python
from .routers import meta, labor, loyalty, supply, sentiment, maintenance
app.include_router(maintenance.router)
```

- [ ] **Step 5: Verify pass**

Run: `uv run pytest tests/test_maintenance_router.py -v`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add src/lakehouse_market/routers/maintenance.py tests/test_maintenance_router.py src/lakehouse_market/app.py
git commit -m "feat(api): maintenance router (at-risk + telemetry)"
```

---

## Phase 3 — Backend write-back (Lakebase)

### Task 3.1: Lakebase write table DDL + migration runner

**Files:**
- Create: `src/lakehouse_market/lakebase_schema.sql`
- Create: `src/lakehouse_market/lakebase_migrate.py`
- Create: `tests/test_lakebase_migrate.py`

- [ ] **Step 1: Write the schema SQL**

```sql
-- src/lakehouse_market/lakebase_schema.sql
CREATE TABLE IF NOT EXISTS app_labor_overrides (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  date DATE NOT NULL,
  daypart TEXT NOT NULL,
  headcount INT NOT NULL,
  note TEXT,
  manager_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_offer_pushes (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  member_id BIGINT,
  offer_id INT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('member', 'counter_prompt')),
  daypart TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_purchase_orders (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  sku_id INT NOT NULL,
  supplier_id INT NOT NULL,
  quantity INT NOT NULL,
  target_date DATE NOT NULL,
  manager_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_review_responses (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  review_id BIGINT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('respond', 'flag', 'resolve')),
  response_text TEXT,
  manager_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_work_orders (
  id BIGSERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  equipment_id BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'done')) DEFAULT 'open',
  target_date DATE,
  notes TEXT,
  manager_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Step 2: Write the migration runner**

```python
# src/lakehouse_market/lakebase_migrate.py
"""Run Lakebase DDL idempotently. Called at app startup."""
from __future__ import annotations
from pathlib import Path
import asyncpg
from .deps import get_lakebase_pool

SCHEMA_FILE = Path(__file__).parent / "lakebase_schema.sql"

async def run_migrations() -> None:
    pool = await get_lakebase_pool()
    ddl = SCHEMA_FILE.read_text()
    async with pool.acquire() as conn:
        await conn.execute(ddl)
```

- [ ] **Step 3: Write the failing test**

```python
# tests/test_lakebase_migrate.py
from lakehouse_market.lakebase_migrate import SCHEMA_FILE

def test_schema_file_contains_all_five_tables():
    text = SCHEMA_FILE.read_text()
    for t in ["app_labor_overrides","app_offer_pushes","app_purchase_orders","app_review_responses","app_work_orders"]:
        assert t in text
```

- [ ] **Step 4: Verify pass**

Run: `uv run pytest tests/test_lakebase_migrate.py -v`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lakehouse_market/lakebase_schema.sql src/lakehouse_market/lakebase_migrate.py tests/test_lakebase_migrate.py
git commit -m "feat(db): Lakebase DDL + migration runner (5 write tables)"
```

### Task 3.2: Labor override write endpoint

**Files:**
- Modify: `src/lakehouse_market/routers/labor.py`
- Create: `tests/test_labor_writes.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_labor_writes.py
import pytest, asyncio
from fastapi.testclient import TestClient
from lakehouse_market.app import app
from lakehouse_market.routers import labor as labor_mod

class FakeConn:
    def __init__(self): self.last = None
    async def execute(self, sql, *args): self.last = (sql, args); return "INSERT 0 1"
    async def fetchrow(self, *a, **k): return {"id": 99}
    async def __aenter__(self): return self
    async def __aexit__(self, *a): pass

class FakePool:
    def __init__(self): self.conn = FakeConn()
    def acquire(self): return self.conn

@pytest.fixture(autouse=True)
def patch_pool(monkeypatch):
    fake = FakePool()
    async def _get(): return fake
    monkeypatch.setattr(labor_mod, "get_lakebase_pool", _get)
    return fake

def test_post_override(patch_pool):
    r = TestClient(app).post("/api/labor/override", json={
        "store_id": 1, "date": "2025-10-29", "daypart": "Lunch", "headcount": 11, "note": "extra cook"
    })
    assert r.status_code == 200
    assert r.json()["id"] == 99
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_labor_writes.py -v`
Expected: FAIL.

- [ ] **Step 3: Update `routers/labor.py` to add the write endpoint**

```python
# additions in src/lakehouse_market/routers/labor.py
from ..deps import get_lakebase_pool

class OverrideRequest(BaseModel):
    store_id: int
    date: str
    daypart: str
    headcount: int
    note: str | None = None
    manager_id: str | None = "demo-manager"

class OverrideResponse(BaseModel):
    id: int

@router.post("/override", response_model=OverrideResponse)
async def override(req: OverrideRequest):
    pool = await get_lakebase_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO app_labor_overrides (store_id, date, daypart, headcount, note, manager_id)
               VALUES ($1, $2::date, $3, $4, $5, $6) RETURNING id""",
            req.store_id, req.date, req.daypart, req.headcount, req.note, req.manager_id,
        )
        return {"id": row["id"]}
```

- [ ] **Step 4: Verify pass**

Run: `uv run pytest tests/test_labor_writes.py -v`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lakehouse_market/routers/labor.py tests/test_labor_writes.py
git commit -m "feat(api): POST /api/labor/override (Lakebase write)"
```

### Task 3.3: Write endpoints for the remaining four tabs

**Files:**
- Modify: `src/lakehouse_market/routers/loyalty.py`
- Modify: `src/lakehouse_market/routers/supply.py`
- Modify: `src/lakehouse_market/routers/sentiment.py`
- Modify: `src/lakehouse_market/routers/maintenance.py`
- Create: `tests/test_tab_writes.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_tab_writes.py
import pytest
from fastapi.testclient import TestClient
from lakehouse_market.app import app
from lakehouse_market.routers import loyalty, supply, sentiment, maintenance

class FakeConn:
    async def fetchrow(self, *a, **k): return {"id": 7}
    async def execute(self, *a, **k): return "OK"
    async def __aenter__(self): return self
    async def __aexit__(self, *a): pass

class FakePool:
    def acquire(self): return FakeConn()

@pytest.fixture(autouse=True)
def patch_pools(monkeypatch):
    async def _get(): return FakePool()
    for m in (loyalty, supply, sentiment, maintenance):
        monkeypatch.setattr(m, "get_lakebase_pool", _get, raising=False)

def test_offer_push(): 
    r = TestClient(app).post("/api/loyalty/offer-push", json={"store_id": 1, "member_id": 42, "offer_id": 3, "scope": "member"})
    assert r.status_code == 200 and r.json()["id"] == 7

def test_release_po():
    r = TestClient(app).post("/api/supply/release-po", json={"store_id": 1, "sku_id": 12, "supplier_id": 3, "quantity": 30, "target_date": "2025-11-04"})
    assert r.status_code == 200 and r.json()["id"] == 7

def test_review_action():
    r = TestClient(app).post("/api/sentiment/review-action", json={"store_id": 1, "review_id": 9001, "action": "respond", "response_text": "Thanks for the feedback."})
    assert r.status_code == 200 and r.json()["id"] == 7

def test_work_order_create():
    r = TestClient(app).post("/api/maintenance/work-order", json={"store_id": 1, "equipment_id": 11, "target_date": "2025-11-02", "notes": "Vibration high"})
    assert r.status_code == 200 and r.json()["id"] == 7
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_tab_writes.py -v`
Expected: FAIL.

- [ ] **Step 3: Add write endpoint to `routers/loyalty.py`**

```python
# additions in src/lakehouse_market/routers/loyalty.py
from ..deps import get_lakebase_pool

class OfferPush(BaseModel):
    store_id: int
    member_id: int | None = None
    offer_id: int
    scope: str  # 'member' | 'counter_prompt'
    daypart: str | None = None

@router.post("/offer-push")
async def offer_push(req: OfferPush):
    pool = await get_lakebase_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """INSERT INTO app_offer_pushes (store_id, member_id, offer_id, scope, daypart)
               VALUES ($1,$2,$3,$4,$5) RETURNING id""",
            req.store_id, req.member_id, req.offer_id, req.scope, req.daypart)
        return {"id": row["id"]}
```

- [ ] **Step 4: Add write endpoint to `routers/supply.py`**

```python
# additions in src/lakehouse_market/routers/supply.py
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
            req.store_id, req.sku_id, req.supplier_id, req.quantity, req.target_date, req.manager_id)
        return {"id": row["id"]}
```

- [ ] **Step 5: Add write endpoint to `routers/sentiment.py`**

```python
# additions in src/lakehouse_market/routers/sentiment.py
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
            req.store_id, req.review_id, req.action, req.response_text, req.manager_id)
        return {"id": row["id"]}
```

- [ ] **Step 6: Add write endpoint to `routers/maintenance.py`**

```python
# additions in src/lakehouse_market/routers/maintenance.py
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
            req.store_id, req.equipment_id, req.target_date, req.notes, req.manager_id)
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
            req.status, req.work_order_id)
        return {"ok": True}
```

- [ ] **Step 7: Verify pass**

Run: `uv run pytest tests/test_tab_writes.py -v`
Expected: 4 passed.

- [ ] **Step 8: Commit**

```bash
git add src/lakehouse_market/routers tests/test_tab_writes.py
git commit -m "feat(api): write endpoints for loyalty, supply, sentiment, maintenance"
```

### Task 3.4: Run Lakebase migrations on app startup

**Files:**
- Modify: `src/lakehouse_market/app.py`
- Create: `tests/test_startup.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_startup.py
import asyncio
from lakehouse_market import lakebase_migrate

def test_run_migrations_callable_async():
    assert asyncio.iscoroutinefunction(lakebase_migrate.run_migrations)
```

- [ ] **Step 2: Update `app.py`**

```python
# src/lakehouse_market/app.py
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from .routers import meta, labor, loyalty, supply, sentiment, maintenance
from .lakebase_migrate import run_migrations
from .config import get_settings

@asynccontextmanager
async def lifespan(_app: FastAPI):
    if get_settings().lakebase_host:
        try:
            await run_migrations()
        except Exception as e:  # never block app start on a missing DB during local dev
            print(f"[startup] lakebase migration skipped: {e}")
    yield

app = FastAPI(title="Lakehouse Market · Homebase", version="0.1.0", lifespan=lifespan)
app.include_router(meta.router)
app.include_router(labor.router)
app.include_router(loyalty.router)
app.include_router(supply.router)
app.include_router(sentiment.router)
app.include_router(maintenance.router)

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "lakehouse-market"}

STATIC_DIR = Path(__file__).resolve().parent / "static"
if STATIC_DIR.exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="ui")
```

- [ ] **Step 3: Verify pass**

Run: `uv run pytest tests/test_startup.py -v`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add src/lakehouse_market/app.py tests/test_startup.py
git commit -m "feat: run Lakebase migrations on app startup (idempotent, non-blocking)"
```

---

## Phase 4 — Genie router (single shared space)

### Task 4.1: Genie wrapper + `/api/genie/ask`

**Files:**
- Create: `src/lakehouse_market/genie.py`
- Create: `src/lakehouse_market/routers/genie.py`
- Create: `tests/test_genie.py`
- Modify: `src/lakehouse_market/app.py`

- [ ] **Step 1: Write the failing tests**

```python
# tests/test_genie.py
from fastapi.testclient import TestClient
from lakehouse_market.app import app
from lakehouse_market.routers import genie as g_mod

def test_ask_calls_genie_with_context(monkeypatch):
    captured = {}
    def fake_create(question: str):
        captured["q"] = question
        return {"conversation_id": "c1", "message_id": "m1", "status": "EXECUTING"}
    def fake_poll(_cid, _mid):
        return {"status": "COMPLETED", "attachments": [
            {"text": {"content": "Lunch headcount was 12 last Tuesday."}}
        ]}
    monkeypatch.setattr(g_mod, "create_conversation", fake_create)
    monkeypatch.setattr(g_mod, "poll_message", fake_poll)

    r = TestClient(app).post("/api/genie/ask", json={
        "tab_id": "labor", "store_id": 42, "question": "Why is lunch headcount higher than last Tuesday?"
    })
    assert r.status_code == 200
    assert "Lunch headcount was 12" in r.json()["text"]
    assert "store_id=42" in captured["q"]  # context blurb prepended
    assert "Labor" in captured["q"]
```

- [ ] **Step 2: Run to verify failure**

Run: `uv run pytest tests/test_genie.py -v`
Expected: FAIL.

- [ ] **Step 3: Write `genie.py` (REST wrapper)**

```python
# src/lakehouse_market/genie.py
import os, time
import httpx
from .config import get_settings

def _auth():
    return {"Authorization": f"Bearer {os.environ.get('DATABRICKS_TOKEN','')}"}

def create_conversation(question: str) -> dict:
    s = get_settings()
    url = f"{s.databricks_host.rstrip('/')}/api/2.0/genie/spaces/{s.genie_space_id}/conversations"
    r = httpx.post(url, json={"content": question}, headers=_auth(), timeout=30.0)
    r.raise_for_status(); return r.json()

def poll_message(conversation_id: str, message_id: str, timeout_s: int = 25) -> dict:
    s = get_settings()
    url = f"{s.databricks_host.rstrip('/')}/api/2.0/genie/spaces/{s.genie_space_id}/conversations/{conversation_id}/messages/{message_id}"
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        r = httpx.get(url, headers=_auth(), timeout=10.0); r.raise_for_status()
        out = r.json()
        if out.get("status") in {"COMPLETED", "FAILED"}:
            return out
        time.sleep(1.0)
    return {"status": "TIMEOUT", "attachments": []}
```

- [ ] **Step 4: Write `routers/genie.py`**

```python
# src/lakehouse_market/routers/genie.py
from fastapi import APIRouter
from pydantic import BaseModel
from ..genie import create_conversation, poll_message

router = APIRouter(prefix="/api/genie", tags=["genie"])

TAB_LABELS = {"labor":"Labor","loyalty":"Loyalty","supply":"Supply Chain","sentiment":"Sentiment","maintenance":"Maintenance"}

class AskRequest(BaseModel):
    tab_id: str
    store_id: int
    question: str

class AskResponse(BaseModel):
    text: str
    conversation_id: str
    message_id: str

@router.post("/ask", response_model=AskResponse)
def ask(req: AskRequest):
    label = TAB_LABELS.get(req.tab_id, req.tab_id)
    full = f"Context: tab={label}, store_id={req.store_id}. Scope all answers to this store unless asked otherwise.\n\nQuestion: {req.question}"
    started = create_conversation(full)
    final = poll_message(started["conversation_id"], started["message_id"])
    text = ""
    for att in final.get("attachments", []):
        if "text" in att:
            text += att["text"].get("content", "")
    return {"text": text or "(no answer)", "conversation_id": started["conversation_id"], "message_id": started["message_id"]}
```

- [ ] **Step 5: Wire into `app.py`** — add `from .routers import ... genie` and `app.include_router(genie.router)`.

- [ ] **Step 6: Verify pass**

Run: `uv run pytest tests/test_genie.py -v`
Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add src/lakehouse_market/genie.py src/lakehouse_market/routers/genie.py tests/test_genie.py src/lakehouse_market/app.py
git commit -m "feat(api): genie ask endpoint with tab + store context blurb"
```

---

## Phase 5 — Frontend shell (header, footer, hub, router)

### Task 5.1: Brand theme + tokens + api client

**Files:**
- Create: `ui/src/lib/theme.ts`
- Create: `ui/src/lib/themes/lakehouse-market.ts`
- Create: `ui/src/lib/api.ts`
- Create: `ui/src/lib/util.ts`

- [ ] **Step 1: Write `theme.ts` (contract)**

```typescript
// ui/src/lib/theme.ts
export interface BrandTheme {
  name: string;
  wordmark: string;
  tagline: string;
  poweredBy: string;
  colors: {
    primary: string; primarySoft: string;
    ink: string; inkSoft: string; paper: string; cream: string;
    success: string; warning: string; info: string;
  };
}
import { lakehouseMarket } from "./themes/lakehouse-market";
export const theme: BrandTheme = lakehouseMarket;
```

- [ ] **Step 2: Write the lakehouse-market theme**

```typescript
// ui/src/lib/themes/lakehouse-market.ts
import type { BrandTheme } from "../theme";
export const lakehouseMarket: BrandTheme = {
  name: "lakehouse-market",
  wordmark: "Lakehouse Market",
  tagline: "Homebase",
  poweredBy: "Powered by Databricks",
  colors: {
    primary: "#FF3621", primarySoft: "#FFE9E5",
    ink: "#0B2026", inkSoft: "#4A5963", paper: "#FFFFFF", cream: "#FAF8F4",
    success: "#00A972", warning: "#FBB300", info: "#4462C9",
  },
};
```

- [ ] **Step 3: Write `api.ts`**

```typescript
// ui/src/lib/api.ts
import axios from "axios";
import { useQuery } from "@tanstack/react-query";

export const api = axios.create({ baseURL: "/api", timeout: 30000 });

export function useApi<T>(key: readonly unknown[], path: string, params?: Record<string, unknown>, opts?: { enabled?: boolean }) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => (await api.get<T>(path, { params })).data,
    enabled: opts?.enabled ?? true,
  });
}
```

- [ ] **Step 4: Write `util.ts`**

```typescript
// ui/src/lib/util.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...x: ClassValue[]) => twMerge(clsx(x));
export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/lib
git commit -m "feat(ui): brand theme + api client + util helpers"
```

### Task 5.2: AppHeader with tab nav + store selector

**Files:**
- Create: `ui/src/components/AppHeader.tsx`
- Create: `ui/src/components/StoreSelector.tsx`
- Create: `ui/src/state/store.ts`

- [ ] **Step 1: Write the store-state hook**

```typescript
// ui/src/state/store.ts
import { useEffect, useState } from "react";
const KEY = "lhm.store_id";

export function useStoreId() {
  const [storeId, setStoreId] = useState<number>(() => {
    const raw = localStorage.getItem(KEY);
    return raw ? parseInt(raw, 10) : 1;
  });
  useEffect(() => { localStorage.setItem(KEY, String(storeId)); }, [storeId]);
  return [storeId, setStoreId] as const;
}
```

- [ ] **Step 2: Write `StoreSelector.tsx`**

```typescript
// ui/src/components/StoreSelector.tsx
import { useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";

type Store = { store_id: number; store_name: string; city: string; state: string };

export function StoreSelector() {
  const [storeId, setStoreId] = useStoreId();
  const { data } = useApi<Store[]>(["stores"], "/stores");
  return (
    <select
      value={storeId}
      onChange={(e) => setStoreId(parseInt(e.target.value, 10))}
      className="rounded-md border border-[color:var(--color-hairline)] bg-white px-3 py-1.5 text-sm font-medium text-[color:var(--color-ink)]"
    >
      {(data ?? []).map((s) => (
        <option key={s.store_id} value={s.store_id}>{s.store_name} · {s.city}, {s.state}</option>
      ))}
    </select>
  );
}
```

- [ ] **Step 3: Write `AppHeader.tsx`**

```typescript
// ui/src/components/AppHeader.tsx
import { NavLink } from "react-router-dom";
import { theme } from "@/lib/theme";
import { StoreSelector } from "./StoreSelector";
import { cn } from "@/lib/util";

const TABS = [
  { idx: "01", to: "/labor", label: "Labor" },
  { idx: "02", to: "/loyalty", label: "Loyalty" },
  { idx: "03", to: "/supply", label: "Supply Chain" },
  { idx: "04", to: "/sentiment", label: "Sentiment" },
  { idx: "05", to: "/maintenance", label: "Maintenance" },
];

export function AppHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[color:var(--color-hairline)] bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">
        <NavLink to="/" className="flex items-center gap-2">
          <span className="inline-block size-2.5 rounded-full bg-[color:var(--color-lava)]" />
          <span className="text-base font-bold tracking-tight text-[color:var(--color-ink)]">{theme.wordmark}</span>
          <span className="ml-1 rounded bg-[color:var(--color-cream)] px-1.5 py-0.5 text-[10px] font-mono uppercase text-[color:var(--color-ink-soft)]">{theme.tagline}</span>
        </NavLink>
        <nav className="ml-2 flex items-center gap-1">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                  isActive
                    ? "bg-[color:var(--color-navy)] text-white"
                    : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-cream)] hover:text-[color:var(--color-ink)]"
                )
              }
            >
              <span className="font-mono text-[10px] opacity-75">{t.idx}</span>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <StoreSelector />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Update `App.tsx` to use the header + router**

```typescript
// ui/src/App.tsx
import { Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AppHeader } from "./components/AppHeader";
import { AppFooter } from "./components/AppFooter";

const HubPage = lazy(() => import("./pages/HubPage"));
const LaborPage = lazy(() => import("./pages/LaborPage"));
const LoyaltyPage = lazy(() => import("./pages/LoyaltyPage"));
const SupplyPage = lazy(() => import("./pages/SupplyPage"));
const SentimentPage = lazy(() => import("./pages/SentimentPage"));
const MaintenancePage = lazy(() => import("./pages/MaintenancePage"));

export function App() {
  return (
    <div className="min-h-screen bg-[color:var(--color-cream)]">
      <AppHeader />
      <main className="mx-auto max-w-[1400px] px-6 py-8">
        <Suspense fallback={<div className="py-12 text-center text-[color:var(--color-ink-soft)]">Loading…</div>}>
          <Routes>
            <Route path="/" element={<HubPage />} />
            <Route path="/labor" element={<LaborPage />} />
            <Route path="/loyalty" element={<LoyaltyPage />} />
            <Route path="/supply" element={<SupplyPage />} />
            <Route path="/sentiment" element={<SentimentPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
          </Routes>
        </Suspense>
      </main>
      <AppFooter />
    </div>
  );
}
```

- [ ] **Step 5: Smoke test the Vite dev server builds without errors**

Run: `cd ui && npm run build`
Expected: build succeeds; missing page files cause a build error — proceed to write them next.

- [ ] **Step 6: Commit (placeholder pages added next; this commit captures the shell)**

```bash
git add ui/src/App.tsx ui/src/components/AppHeader.tsx ui/src/components/StoreSelector.tsx ui/src/state/store.ts
git commit -m "feat(ui): AppHeader with tab nav + StoreSelector + router shell"
```

### Task 5.3: AppFooter with Powered by Databricks lockup

**Files:**
- Create: `ui/src/components/AppFooter.tsx`

- [ ] **Step 1: Write `AppFooter.tsx`**

```typescript
// ui/src/components/AppFooter.tsx
import { theme } from "@/lib/theme";
import { Flame } from "lucide-react";

export function AppFooter() {
  return (
    <footer className="mt-12 border-t border-[color:var(--color-hairline)] bg-white">
      <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between px-6 text-xs text-[color:var(--color-ink-soft)]">
        <div>© {new Date().getFullYear()} {theme.wordmark}</div>
        <div className="flex items-center gap-1.5">
          <Flame className="size-3.5" style={{ color: theme.colors.primary }} />
          <span>{theme.poweredBy} · Lakebase + Genie + Model Serving</span>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/components/AppFooter.tsx
git commit -m "feat(ui): AppFooter with Powered by Databricks lockup"
```

### Task 5.4: Hub landing page with 5-app diagram + action queue

**Files:**
- Create: `ui/src/pages/HubPage.tsx`
- Create: `ui/src/components/HubDiagram.tsx`
- Create: `ui/src/components/HubActionQueue.tsx`

- [ ] **Step 1: Write `HubDiagram.tsx` (5 nodes around a circle)**

```typescript
// ui/src/components/HubDiagram.tsx
import { useNavigate } from "react-router-dom";

const NODES = [
  { id: "labor", label: "01 · Labor", to: "/labor" },
  { id: "loyalty", label: "02 · Loyalty", to: "/loyalty" },
  { id: "supply", label: "03 · Supply Chain", to: "/supply" },
  { id: "sentiment", label: "04 · Sentiment", to: "/sentiment" },
  { id: "maintenance", label: "05 · Maintenance", to: "/maintenance" },
];

export function HubDiagram({ badges }: { badges?: Record<string, number> }) {
  const nav = useNavigate();
  const cx = 260, cy = 220, r = 160;
  return (
    <svg viewBox="0 0 520 440" className="w-full max-w-[640px]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-hairline)" strokeDasharray="4 6" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="fill-[color:var(--color-ink)] text-lg font-semibold">Today at your store</text>
      {NODES.map((n, i) => {
        const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / NODES.length;
        const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
        const badge = badges?.[n.id];
        return (
          <g key={n.id} onClick={() => nav(n.to)} style={{ cursor: "pointer" }}>
            <circle cx={x} cy={y} r={38} fill="white" stroke="var(--color-hairline)" />
            <text x={x} y={y - 4} textAnchor="middle" className="fill-[color:var(--color-ink)] text-xs font-semibold">{n.label}</text>
            {badge !== undefined && (
              <>
                <circle cx={x + 26} cy={y - 26} r={11} fill="var(--color-lava)" />
                <text x={x + 26} y={y - 22} textAnchor="middle" className="fill-white text-[10px] font-bold">{badge}</text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 2: Write `HubActionQueue.tsx`**

```typescript
// ui/src/components/HubActionQueue.tsx
import { Link } from "react-router-dom";

type Item = { tab: string; tabLabel: string; title: string; subtitle: string; to: string };

export function HubActionQueue({ items }: { items: Item[] }) {
  return (
    <ul className="divide-y divide-[color:var(--color-hairline)] rounded-lg border border-[color:var(--color-hairline)] bg-white">
      {items.map((it, i) => (
        <li key={i} className="flex items-center gap-4 p-4">
          <span className="rounded bg-[color:var(--color-cream)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">{it.tabLabel}</span>
          <div className="flex-1">
            <div className="font-medium text-[color:var(--color-ink)]">{it.title}</div>
            <div className="text-sm text-[color:var(--color-ink-soft)]">{it.subtitle}</div>
          </div>
          <Link to={it.to} className="rounded-md bg-[color:var(--color-lava)] px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">Open</Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Write `HubPage.tsx`**

```typescript
// ui/src/pages/HubPage.tsx
import { useStoreId } from "@/state/store";
import { useApi } from "@/lib/api";
import { HubDiagram } from "@/components/HubDiagram";
import { HubActionQueue } from "@/components/HubActionQueue";

type Reorder = { sku_id: number; sku_name: string; days_of_cover: number };
type Risk = { equipment_id: number; category: string; rul_days: number };
type Inbox = { review_id: number; snippet: string; sentiment: string };

export default function HubPage() {
  const [storeId] = useStoreId();
  const today = new Date().toISOString().slice(0, 10);

  const reorders = useApi<Reorder[]>(["hub-reorders", storeId], "/supply/reorder-queue", { store_id: storeId });
  const risks = useApi<Risk[]>(["hub-risks", storeId], "/maintenance/at-risk", { store_id: storeId });
  const inbox = useApi<Inbox[]>(["hub-inbox", storeId], "/sentiment/inbox", { store_id: storeId, since: today });

  const items: { tab: string; tabLabel: string; title: string; subtitle: string; to: string }[] = [];
  reorders.data?.slice(0, 2).forEach((r) => items.push({ tab: "supply", tabLabel: "03 Supply", title: `Release PO: ${r.sku_name}`, subtitle: `${r.days_of_cover.toFixed(1)} days of cover left`, to: "/supply" }));
  risks.data?.slice(0, 2).forEach((r) => items.push({ tab: "maintenance", tabLabel: "05 Maint", title: `Schedule tech: ${r.category}`, subtitle: `Predicted failure in ${r.rul_days} days`, to: "/maintenance" }));
  inbox.data?.slice(0, 2).forEach((rv) => items.push({ tab: "sentiment", tabLabel: "04 Sentiment", title: `New ${rv.sentiment} review`, subtitle: rv.snippet, to: "/sentiment" }));

  const badges = {
    labor: 4, // four dayparts to lock
    loyalty: 3,
    supply: reorders.data?.length ?? 0,
    sentiment: inbox.data?.length ?? 0,
    maintenance: risks.data?.length ?? 0,
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
      <div>
        <h1 className="mb-1 text-2xl font-bold text-[color:var(--color-ink)]">Good morning.</h1>
        <p className="mb-6 text-[color:var(--color-ink-soft)]">Your day at a glance.</p>
        <HubDiagram badges={badges} />
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold text-[color:var(--color-ink)]">Today at your store</h2>
        <HubActionQueue items={items} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build + smoke test**

Run: `cd ui && npm run build`
Then visit `/` in the running dev or static app.
Expected: hub diagram renders with 5 nodes; action queue may be empty if backend isn't connected — that's OK, just no errors.

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/HubPage.tsx ui/src/components/HubDiagram.tsx ui/src/components/HubActionQueue.tsx
git commit -m "feat(ui): Hub landing page (5-node diagram + cross-tab action queue)"
```

### Task 5.5: Shared primitives — MetricCard, KPIRing, DataTable, GenieChat

**Files:**
- Create: `ui/src/components/MetricCard.tsx`
- Create: `ui/src/components/KPIRing.tsx`
- Create: `ui/src/components/DataTable.tsx`
- Create: `ui/src/components/GenieChat.tsx`

- [ ] **Step 1: Write `MetricCard.tsx`**

```typescript
// ui/src/components/MetricCard.tsx
import { cn } from "@/lib/util";
import type { ReactNode } from "react";

export function MetricCard({ label, value, sub, accent, icon }: {
  label: string; value: ReactNode; sub?: ReactNode; accent?: "lava" | "navy" | "success" | "warning"; icon?: ReactNode;
}) {
  const accentBar = {
    lava: "bg-[color:var(--color-lava)]",
    navy: "bg-[color:var(--color-navy)]",
    success: "bg-[color:var(--color-success)]",
    warning: "bg-[color:var(--color-warning)]",
  }[accent ?? "navy"];
  return (
    <div className="relative overflow-hidden rounded-lg border border-[color:var(--color-hairline)] bg-white p-4 shadow-sm">
      <div className={cn("absolute left-0 top-0 h-full w-1", accentBar)} />
      <div className="flex items-start justify-between pl-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-soft)]">{label}</div>
          <div className="mt-1 font-mono text-2xl font-bold text-[color:var(--color-ink)]">{value}</div>
          {sub && <div className="mt-1 text-xs text-[color:var(--color-ink-soft)]">{sub}</div>}
        </div>
        {icon && <div className="text-[color:var(--color-ink-soft)]">{icon}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `KPIRing.tsx`**

```typescript
// ui/src/components/KPIRing.tsx
export function KPIRing({ value, max = 100, size = 56, label }: { value: number; max?: number; size?: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct);
  const color = value >= max * 0.7 ? "var(--color-success)" : value >= max * 0.4 ? "var(--color-warning)" : "var(--color-lava)";
  return (
    <div className="inline-flex flex-col items-center">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--color-hairline)" strokeWidth={4} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={4} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} />
        <text x="50%" y="54%" textAnchor="middle" className="fill-[color:var(--color-ink)] font-mono text-sm font-semibold">{Math.round(value)}</text>
      </svg>
      {label && <div className="mt-1 text-[10px] text-[color:var(--color-ink-soft)]">{label}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Write `DataTable.tsx`**

```typescript
// ui/src/components/DataTable.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/util";

export type Column<T> = { key: keyof T | string; header: string; render?: (row: T) => ReactNode; align?: "left" | "right"; width?: string };

export function DataTable<T extends object>({ rows, columns, empty = "No rows." }: { rows: T[]; columns: Column<T>[]; empty?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[color:var(--color-hairline)] bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] text-left text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-soft)]">
          <tr>{columns.map((c) => <th key={String(c.key)} style={{ width: c.width }} className={cn("px-3 py-2", c.align === "right" && "text-right")}>{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-[color:var(--color-ink-soft)]">{empty}</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="border-b border-[color:var(--color-hairline)] last:border-0">
              {columns.map((c) => (
                <td key={String(c.key)} className={cn("px-3 py-2.5 text-[color:var(--color-ink)]", c.align === "right" && "text-right font-mono")}>
                  {c.render ? c.render(r) : (r as any)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Write `GenieChat.tsx`**

```typescript
// ui/src/components/GenieChat.tsx
import { useState } from "react";
import { Sparkles, Send } from "lucide-react";
import { api } from "@/lib/api";
import { useStoreId } from "@/state/store";

type TabId = "labor" | "loyalty" | "supply" | "sentiment" | "maintenance";

const INTROS: Record<TabId, string> = {
  labor: "Ask about labor at your store.",
  loyalty: "Ask about your members.",
  supply: "Ask about inventory and suppliers.",
  sentiment: "Ask about your reviews.",
  maintenance: "Ask about your equipment.",
};

type Msg = { who: "user" | "genie"; text: string };

export function GenieChat({ tabId, chips }: { tabId: TabId; chips: string[] }) {
  const [storeId] = useStoreId();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(q: string) {
    setMsgs((m) => [...m, { who: "user", text: q }]);
    setBusy(true);
    try {
      const r = await api.post("/genie/ask", { tab_id: tabId, store_id: storeId, question: q });
      setMsgs((m) => [...m, { who: "genie", text: r.data.text }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { who: "genie", text: "Sorry, something went wrong asking Genie." }]);
    } finally { setBusy(false); }
  }

  return (
    <aside className="rounded-lg border border-[color:var(--color-hairline)] bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-[color:var(--color-hairline)] px-4 py-3">
        <Sparkles className="size-4 text-[color:var(--color-lava)]" />
        <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">Ask Genie</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-[color:var(--color-ink-soft)]">live on Databricks</span>
      </header>
      <div className="space-y-2 px-4 py-3 text-sm text-[color:var(--color-ink-soft)]">
        <p>{INTROS[tabId]}</p>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button key={c} onClick={() => ask(c)} className="rounded-full border border-[color:var(--color-hairline)] bg-[color:var(--color-cream)] px-2.5 py-1 text-xs text-[color:var(--color-ink)] hover:border-[color:var(--color-lava)]">{c}</button>
          ))}
        </div>
      </div>
      <div className="max-h-72 space-y-2 overflow-y-auto border-t border-[color:var(--color-hairline)] px-4 py-3">
        {msgs.map((m, i) => (
          <div key={i} className={m.who === "user" ? "text-right" : ""}>
            <span className={m.who === "user" ? "inline-block rounded-lg bg-[color:var(--color-navy)] px-3 py-1.5 text-sm text-white" : "inline-block rounded-lg bg-[color:var(--color-cream)] px-3 py-1.5 text-sm text-[color:var(--color-ink)]"}>{m.text}</span>
          </div>
        ))}
        {busy && <div className="text-xs text-[color:var(--color-ink-soft)]">Thinking…</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (input.trim()) { ask(input); setInput(""); } }} className="flex gap-2 border-t border-[color:var(--color-hairline)] p-3">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a question…" className="flex-1 rounded-md border border-[color:var(--color-hairline)] bg-white px-3 py-1.5 text-sm" />
        <button type="submit" className="rounded-md bg-[color:var(--color-lava)] px-3 py-1.5 text-white"><Send className="size-4" /></button>
      </form>
    </aside>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add ui/src/components
git commit -m "feat(ui): shared primitives (MetricCard, KPIRing, DataTable, GenieChat)"
```

---

## Phase 6 — Tab pages

Every tab follows the same skeleton: KPI strip → action queue → secondary detail → GenieChat. Each task below produces one tab page.

### Task 6.1: Labor page

**Files:**
- Create: `ui/src/pages/LaborPage.tsx`
- Create: `ui/src/components/DayPartCard.tsx`

- [ ] **Step 1: Write `DayPartCard.tsx`**

```typescript
// ui/src/components/DayPartCard.tsx
import { useState } from "react";
import { api } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { money } from "@/lib/util";

export function DayPartCard({ daypart, forecast, transactions, date }: {
  daypart: string; forecast: number; transactions: number; date: string;
}) {
  const [storeId] = useStoreId();
  const [override, setOverride] = useState<number | null>(null);
  const [headcount, setHeadcount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  async function recompute() {
    const v = override ?? forecast;
    const r = await api.post("/labor/recommend", { forecast_revenue: v, daypart });
    setHeadcount(r.data.headcount);
  }
  async function lock() {
    if (headcount == null) return;
    setSaving(true);
    try {
      await api.post("/labor/override", { store_id: storeId, date, daypart, headcount, note: override ? "manager override" : null });
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-[color:var(--color-ink)]">{daypart}</h4>
        <span className="font-mono text-xs text-[color:var(--color-ink-soft)]">{transactions} tx</span>
      </div>
      <div className="mt-2 font-mono text-xl">{money(forecast)}</div>
      <div className="mt-3 flex items-center gap-2">
        <label className="text-xs text-[color:var(--color-ink-soft)]">Override $</label>
        <input type="number" value={override ?? ""} onChange={(e) => setOverride(e.target.value ? parseFloat(e.target.value) : null)}
               className="w-24 rounded border border-[color:var(--color-hairline)] px-2 py-1 text-sm" />
        <button onClick={recompute} className="rounded-md bg-[color:var(--color-navy)] px-2 py-1 text-xs font-medium text-white">Recompute</button>
      </div>
      {headcount != null && (
        <div className="mt-3 flex items-center justify-between border-t border-[color:var(--color-hairline)] pt-3">
          <div className="text-sm text-[color:var(--color-ink-soft)]">Recommended <span className="font-mono font-semibold text-[color:var(--color-ink)]">{headcount}</span></div>
          <button disabled={saving} onClick={lock} className="rounded-md bg-[color:var(--color-lava)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Locking…" : "Lock"}</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `LaborPage.tsx`**

```typescript
// ui/src/pages/LaborPage.tsx
import { useApi } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { MetricCard } from "@/components/MetricCard";
import { DayPartCard } from "@/components/DayPartCard";
import { GenieChat } from "@/components/GenieChat";
import { money, pct } from "@/lib/util";

type Today = { dayparts: { daypart: string; forecast_revenue: number; forecast_transactions: number }[] };

export default function LaborPage() {
  const [storeId] = useStoreId();
  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useApi<Today>(["labor-today", storeId, today], "/labor/today", { store_id: storeId, date: today });
  const total = (data?.dayparts ?? []).reduce((a, d) => a + d.forecast_revenue, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Labor</h1>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Forecast Today" value={money(total)} sub="across day-parts" accent="lava" />
          <MetricCard label="Day-parts to lock" value={data?.dayparts.length ?? 0} accent="navy" />
          <MetricCard label="Projected labor %" value={pct(0.282)} sub="vs target 28%" accent="success" />
          <MetricCard label="Vs last week" value="+4.1%" accent="warning" />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {(data?.dayparts ?? []).map((d) => (
            <DayPartCard key={d.daypart} daypart={d.daypart} forecast={d.forecast_revenue} transactions={d.forecast_transactions} date={today} />
          ))}
        </div>
        {isLoading && <div className="text-sm text-[color:var(--color-ink-soft)]">Loading forecast…</div>}
      </div>
      <GenieChat tabId="labor" chips={[
        "Why is lunch headcount higher than last Tuesday?",
        "What was my labor % last Friday vs forecast?",
        "How does my labor % compare to nearby stores?"
      ]} />
    </div>
  );
}
```

- [ ] **Step 3: Build + smoke test**

Run: `cd ui && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add ui/src/pages/LaborPage.tsx ui/src/components/DayPartCard.tsx
git commit -m "feat(ui): Labor tab — day-part cards + override + lock + Genie"
```

### Task 6.2: Loyalty page (with trade-area map)

**Files:**
- Create: `ui/src/pages/LoyaltyPage.tsx`
- Create: `ui/src/components/StoreMap.tsx`

- [ ] **Step 1: Write `StoreMap.tsx`**

```typescript
// ui/src/components/StoreMap.tsx
import { MapContainer, TileLayer, CircleMarker, Circle, Tooltip } from "react-leaflet";

export type MapPoint = { member_id: number; lat: number; lon: number; tier: "active" | "lapsed" | "at_risk" };

const TIER_COLOR = { active: "#00A972", lapsed: "#9CA3AF", at_risk: "#FF3621" };

export function StoreMap({ center, points }: { center: { lat: number; lon: number }; points: MapPoint[] }) {
  return (
    <div className="h-[420px] overflow-hidden rounded-lg border border-[color:var(--color-hairline)]">
      <MapContainer center={[center.lat, center.lon]} zoom={11} style={{ height: "100%", width: "100%" }}>
        <TileLayer attribution='&copy; OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Circle center={[center.lat, center.lon]} radius={8000} pathOptions={{ color: "#0B2026", weight: 1, fillOpacity: 0.04 }} />
        {points.map((p) => (
          <CircleMarker key={p.member_id} center={[p.lat, p.lon]} radius={4}
            pathOptions={{ color: TIER_COLOR[p.tier], fillColor: TIER_COLOR[p.tier], fillOpacity: 0.75, weight: 0 }}>
            <Tooltip>{p.tier} · #{p.member_id}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 2: Write `LoyaltyPage.tsx`**

```typescript
// ui/src/pages/LoyaltyPage.tsx
import { useApi, api } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { MetricCard } from "@/components/MetricCard";
import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { StoreMap, type MapPoint } from "@/components/StoreMap";
import { money, pct } from "@/lib/util";

type KPI = { active_members: number; spend_30d: number; at_risk_count: number; redemption_pct: number };
type Member = { member_id: number; lifetime_spend: number; churn_probability: number; predicted_clv: number; segment: string };
type Store = { store_id: number; lat: number; lon: number };

export default function LoyaltyPage() {
  const [storeId] = useStoreId();
  const stores = useApi<Store[]>(["stores"], "/stores");
  const kpis = useApi<KPI>(["loyalty-kpis", storeId], "/loyalty/kpis", { store_id: storeId });
  const atRisk = useApi<Member[]>(["loyalty-at-risk", storeId], "/loyalty/at-risk", { store_id: storeId });
  const points = useApi<MapPoint[]>(["loyalty-map", storeId], "/loyalty/map", { store_id: storeId });

  const center = stores.data?.find((s) => s.store_id === storeId);

  async function pushOffer(memberId: number) {
    await api.post("/loyalty/offer-push", { store_id: storeId, member_id: memberId, offer_id: 1, scope: "member" });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Loyalty</h1>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Active members 30d" value={kpis.data?.active_members ?? "—"} accent="success" />
          <MetricCard label="30d spend" value={money(kpis.data?.spend_30d ?? 0)} accent="lava" />
          <MetricCard label="At-risk in area" value={kpis.data?.at_risk_count ?? "—"} accent="warning" />
          <MetricCard label="Redemption rate" value={pct(kpis.data?.redemption_pct ?? 0)} accent="navy" />
        </div>
        <DataTable
          rows={atRisk.data ?? []}
          columns={[
            { key: "member_id", header: "Member", render: (r) => <span className="font-mono">#{r.member_id}</span> },
            { key: "segment", header: "Segment" },
            { key: "lifetime_spend", header: "LTV", align: "right", render: (r) => money(r.lifetime_spend) },
            { key: "predicted_clv", header: "Pred CLV", align: "right", render: (r) => money(r.predicted_clv) },
            { key: "churn_probability", header: "Churn risk", align: "right", render: (r) => pct(r.churn_probability) },
            { key: "_act", header: "", align: "right", render: (r) => <button onClick={() => pushOffer(r.member_id)} className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs font-semibold text-white">Push offer</button> },
          ]}
        />
        {center && <StoreMap center={{ lat: center.lat, lon: center.lon }} points={points.data ?? []} />}
      </div>
      <GenieChat tabId="loyalty" chips={[
        "Who hasn't visited in 30 days but spent $500+ last quarter?",
        "Which offer worked best at my store last month?",
        "Show me my top 10 loyalty members this week"
      ]} />
    </div>
  );
}
```

- [ ] **Step 3: Build + smoke test**

Run: `cd ui && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add ui/src/pages/LoyaltyPage.tsx ui/src/components/StoreMap.tsx
git commit -m "feat(ui): Loyalty tab — KPIs + at-risk table + trade-area map + Genie"
```

### Task 6.3: Supply page

**Files:**
- Create: `ui/src/pages/SupplyPage.tsx`

- [ ] **Step 1: Write `SupplyPage.tsx`**

```typescript
// ui/src/pages/SupplyPage.tsx
import { useApi, api } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { MetricCard } from "@/components/MetricCard";
import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { useQueryClient } from "@tanstack/react-query";

type Reorder = { sku_id: number; sku_name: string; on_hand: number; reorder_point: number; days_of_cover: number; supplier_id: number; supplier_name: string; supplier_on_time_pct: number };
type Delivery = { po_id: number; sku_id: number; supplier_name: string; ordered_qty: number; expected_date: string };

export default function SupplyPage() {
  const [storeId] = useStoreId();
  const today = new Date().toISOString().slice(0, 10);
  const qc = useQueryClient();
  const reorders = useApi<Reorder[]>(["supply-reorders", storeId], "/supply/reorder-queue", { store_id: storeId });
  const deliveries = useApi<Delivery[]>(["supply-deliveries", storeId, today], "/supply/tomorrow-deliveries", { store_id: storeId, date: today });

  async function releasePO(r: Reorder) {
    await api.post("/supply/release-po", { store_id: storeId, sku_id: r.sku_id, supplier_id: r.supplier_id, quantity: Math.max(r.reorder_point * 2, 20), target_date: addDays(today, 3) });
    qc.invalidateQueries({ queryKey: ["supply-reorders", storeId] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Supply Chain</h1>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Below reorder point" value={reorders.data?.length ?? "—"} accent="lava" />
          <MetricCard label="Open POs in flight" value={deliveries.data?.length ?? "—"} accent="navy" />
          <MetricCard label="Tomorrow deliveries" value={deliveries.data?.length ?? "—"} accent="info" />
          <MetricCard label="Supplier on-time" value="92%" accent="success" />
        </div>
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">Reorder queue</h2>
          <DataTable
            rows={reorders.data ?? []}
            columns={[
              { key: "sku_name", header: "SKU", render: (r) => <span className="font-mono">{r.sku_name}</span> },
              { key: "on_hand", header: "On hand", align: "right" },
              { key: "reorder_point", header: "Reorder pt", align: "right" },
              { key: "days_of_cover", header: "Days cover", align: "right", render: (r) => r.days_of_cover.toFixed(1) },
              { key: "supplier_name", header: "Supplier" },
              { key: "_act", header: "", align: "right", render: (r) => <button onClick={() => releasePO(r)} className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs font-semibold text-white">Release PO</button> },
            ]}
          />
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-ink-soft)]">Tomorrow's deliveries</h2>
          <DataTable
            rows={deliveries.data ?? []}
            columns={[
              { key: "po_id", header: "PO", render: (r) => <span className="font-mono">#{r.po_id}</span> },
              { key: "supplier_name", header: "Supplier" },
              { key: "ordered_qty", header: "Qty", align: "right" },
              { key: "expected_date", header: "Expected" },
            ]}
          />
        </section>
      </div>
      <GenieChat tabId="supply" chips={[
        "What am I likely to run out of this week?",
        "Which supplier has missed delivery windows recently?",
        "Show inbound POs for tomorrow"
      ]} />
    </div>
  );
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/SupplyPage.tsx
git commit -m "feat(ui): Supply tab — reorder queue + tomorrow's deliveries + Genie"
```

### Task 6.4: Sentiment page

**Files:**
- Create: `ui/src/pages/SentimentPage.tsx`

- [ ] **Step 1: Write `SentimentPage.tsx`**

```typescript
// ui/src/pages/SentimentPage.tsx
import { useApi, api } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { MetricCard } from "@/components/MetricCard";
import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

type Inbox = { review_id: number; ts: string; source: string; rating: number; snippet: string; sentiment: string; topics: string[] };
type Digest = { text: string; generated_at: number };

export default function SentimentPage() {
  const [storeId] = useStoreId();
  const since = "2025-10-01";
  const qc = useQueryClient();
  const inbox = useApi<Inbox[]>(["sentiment-inbox", storeId, since], "/sentiment/inbox", { store_id: storeId, since });
  const digest = useApi<Digest>(["sentiment-digest", storeId], "/sentiment/digest", { store_id: storeId });
  const [drafting, setDrafting] = useState<number | null>(null);
  const [text, setText] = useState("");

  async function respond(reviewId: number) {
    await api.post("/sentiment/review-action", { store_id: storeId, review_id: reviewId, action: "respond", response_text: text });
    setDrafting(null); setText("");
    qc.invalidateQueries({ queryKey: ["sentiment-inbox", storeId, since] });
  }
  async function act(reviewId: number, action: "flag" | "resolve") {
    await api.post("/sentiment/review-action", { store_id: storeId, review_id: reviewId, action });
    qc.invalidateQueries({ queryKey: ["sentiment-inbox", storeId, since] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Sentiment</h1>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Reviews 30d" value={inbox.data?.length ?? "—"} accent="navy" />
          <MetricCard label="Avg rating" value="4.1" accent="success" />
          <MetricCard label="% negative" value="14%" accent="lava" />
          <MetricCard label="Vs last month" value="-2.0%" accent="warning" />
        </div>
        <section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
          <h3 className="text-sm font-semibold text-[color:var(--color-ink)]">This week's digest</h3>
          <p className="mt-2 text-sm text-[color:var(--color-ink-soft)]">{digest.data?.text ?? "Generating…"}</p>
        </section>
        <DataTable
          rows={inbox.data ?? []}
          columns={[
            { key: "ts", header: "When" },
            { key: "source", header: "Source" },
            { key: "rating", header: "★", align: "right" },
            { key: "sentiment", header: "Sentiment" },
            { key: "snippet", header: "Review" },
            { key: "_act", header: "", align: "right", render: (r) =>
              drafting === r.review_id ? (
                <div className="flex gap-1">
                  <input value={text} onChange={(e) => setText(e.target.value)} className="w-40 rounded border px-1 py-0.5 text-xs" placeholder="response…" />
                  <button onClick={() => respond(r.review_id)} className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs text-white">Send</button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <button onClick={() => setDrafting(r.review_id)} className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs text-white">Respond</button>
                  <button onClick={() => act(r.review_id, "flag")} className="rounded-md bg-[color:var(--color-warning)] px-2 py-1 text-xs text-white">Flag</button>
                  <button onClick={() => act(r.review_id, "resolve")} className="rounded-md bg-[color:var(--color-success)] px-2 py-1 text-xs text-white">Resolve</button>
                </div>
              ) },
          ]}
        />
      </div>
      <GenieChat tabId="sentiment" chips={[
        "What's the top complaint this week at my store?",
        "Which day-part gets the worst reviews?",
        "Compare my store's rating to nearby stores"
      ]} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/SentimentPage.tsx
git commit -m "feat(ui): Sentiment tab — inbox + actions + weekly digest + Genie"
```

### Task 6.5: Maintenance page

**Files:**
- Create: `ui/src/pages/MaintenancePage.tsx`

- [ ] **Step 1: Write `MaintenancePage.tsx`**

```typescript
// ui/src/pages/MaintenancePage.tsx
import { useApi, api } from "@/lib/api";
import { useStoreId } from "@/state/store";
import { MetricCard } from "@/components/MetricCard";
import { DataTable } from "@/components/DataTable";
import { GenieChat } from "@/components/GenieChat";
import { KPIRing } from "@/components/KPIRing";
import { useQueryClient } from "@tanstack/react-query";

type Risk = { equipment_id: number; category: string; model: string; runtime_hours: number; health_score: number; rul_days: number; predicted_failure_date: string };

export default function MaintenancePage() {
  const [storeId] = useStoreId();
  const qc = useQueryClient();
  const risks = useApi<Risk[]>(["maint-at-risk", storeId], "/maintenance/at-risk", { store_id: storeId });

  async function schedule(e: Risk) {
    const target = new Date(); target.setDate(target.getDate() + Math.max(1, e.rul_days - 2));
    await api.post("/maintenance/work-order", { store_id: storeId, equipment_id: e.equipment_id, target_date: target.toISOString().slice(0, 10), notes: `Predicted failure ${e.predicted_failure_date}` });
    qc.invalidateQueries({ queryKey: ["maint-at-risk", storeId] });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[color:var(--color-ink)]">Predictive Maintenance</h1>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard label="Equipment online %" value="98%" accent="success" />
          <MetricCard label="Predicted failures 7d" value={risks.data?.filter((r) => r.rul_days <= 7).length ?? "—"} accent="lava" />
          <MetricCard label="Open work orders" value={0} accent="navy" />
          <MetricCard label="MTBF trend" value="↑ 3%" accent="warning" />
        </div>
        <DataTable
          rows={risks.data ?? []}
          columns={[
            { key: "equipment_id", header: "Unit", render: (r) => <span className="font-mono">#{r.equipment_id}</span> },
            { key: "category", header: "Type" },
            { key: "model", header: "Model" },
            { key: "runtime_hours", header: "Runtime hrs", align: "right" },
            { key: "health_score", header: "Health", align: "right", render: (r) => <KPIRing value={r.health_score} /> },
            { key: "rul_days", header: "RUL days", align: "right" },
            { key: "predicted_failure_date", header: "Predicted failure" },
            { key: "_act", header: "", align: "right", render: (r) => <button onClick={() => schedule(r)} className="rounded-md bg-[color:var(--color-lava)] px-2 py-1 text-xs font-semibold text-white">Schedule tech</button> },
          ]}
        />
      </div>
      <GenieChat tabId="maintenance" chips={[
        "Which equipment is most likely to fail this week?",
        "What's the average time-to-repair for fryers?",
        "Show me work orders open more than 7 days"
      ]} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add ui/src/pages/MaintenancePage.tsx
git commit -m "feat(ui): Maintenance tab — at-risk equipment + schedule tech + Genie"
```

### Task 6.6: Round out tabs with charts + detail panels (spec §10.2 coverage)

The five pages above ship the action surface + KPIs + Genie + (for Loyalty) the map. The spec calls for "at least one chart per tab" plus a few secondary detail panels. This task adds them with minimal new code; each is ~30 lines of Recharts.

**Files:**
- Create: `ui/src/components/Sparkline.tsx`
- Modify: `ui/src/pages/LaborPage.tsx`, `LoyaltyPage.tsx`, `SupplyPage.tsx`, `SentimentPage.tsx`, `MaintenancePage.tsx`

- [ ] **Step 1: Write `Sparkline.tsx`** (reused across tabs)

```typescript
// ui/src/components/Sparkline.tsx
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";

export function Sparkline({ data, dataKey = "value", color = "#FF3621", height = 56 }: {
  data: Record<string, number | string>[]; dataKey?: string; color?: string; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <YAxis hide domain={["auto", "auto"]} />
        <Tooltip cursor={false} contentStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.8} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Add a revenue-by-daypart bar chart to LaborPage**

Insert into `LaborPage.tsx` above the day-part cards (after the KPI grid):

```typescript
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
// inside the page return, after the KPI grid:
<section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
  <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">Forecast revenue by day-part</h3>
  <div className="h-56">
    <ResponsiveContainer>
      <BarChart data={data?.dayparts ?? []}>
        <XAxis dataKey="daypart" stroke="#4A5963" fontSize={12} />
        <YAxis stroke="#4A5963" fontSize={12} />
        <Tooltip />
        <Bar dataKey="forecast_revenue" fill="#FF3621" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
</section>
```

- [ ] **Step 3: Add an offer-impact mini-chart to LoyaltyPage**

Insert into `LoyaltyPage.tsx` between the table and the map:

```typescript
import { Sparkline } from "@/components/Sparkline";
// inside the main column, between DataTable and StoreMap:
<section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
  <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">Offer redemption · last 8 weeks</h3>
  <Sparkline height={88} data={[
    {week: 1, value: 0.12},{week:2,value:0.14},{week:3,value:0.18},{week:4,value:0.16},
    {week:5,value:0.21},{week:6,value:0.19},{week:7,value:0.23},{week:8,value:0.24},
  ]} />
</section>
```

(Mock-shaped data is acceptable here; the spec's "offer impact mini-chart" is a visual cue — a real time-series can replace it in a follow-up.)

- [ ] **Step 4: Add a demand vs supply chart to SupplyPage**

Insert above the reorder table:

```typescript
import { ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
// inside main column, above the reorder section:
<section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
  <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">Forecast demand vs on-hand (top reorder SKU)</h3>
  <div className="h-56">
    <ResponsiveContainer>
      <ComposedChart data={[
        {week:"W1",demand:40,onhand:32},{week:"W2",demand:42,onhand:18},
        {week:"W3",demand:38,onhand:9},{week:"W4",demand:45,onhand:0},
      ]}>
        <XAxis dataKey="week" stroke="#4A5963" fontSize={12} />
        <YAxis stroke="#4A5963" fontSize={12} />
        <Tooltip /><Legend />
        <Bar dataKey="onhand" name="On hand" fill="#1B5162" radius={[4,4,0,0]} />
        <Line dataKey="demand" name="Forecast demand" stroke="#FF3621" strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  </div>
</section>
```

- [ ] **Step 5: Add a sentiment timeline (stacked area) to SentimentPage**

Add a backend endpoint first: in `routers/sentiment.py`, append:

```python
class TimelinePoint(BaseModel):
    date: str
    positive: int
    neutral: int
    negative: int

@router.get("/timeline", response_model=list[TimelinePoint])
def timeline(store_id: int, days: int = 30):
    return fetch_all(
        """SELECT cast(r.ts AS string) AS date,
              count_if(rs.sentiment='positive') AS positive,
              count_if(rs.sentiment='neutral') AS neutral,
              count_if(rs.sentiment='negative') AS negative
           FROM reviews r JOIN review_sentiment rs USING (review_id)
           WHERE r.store_id = :store_id AND r.ts > current_date() - INTERVAL :days DAYS
           GROUP BY r.ts ORDER BY r.ts""",
        {"store_id": store_id, "days": days},
    )
```

Then in `SentimentPage.tsx` add the chart between the digest card and the inbox table:

```typescript
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
const timeline = useApi<{date:string; positive:number; neutral:number; negative:number}[]>(["sent-timeline", storeId], "/sentiment/timeline", { store_id: storeId, days: 30 });
// in the return:
<section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
  <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">Sentiment · last 30 days</h3>
  <div className="h-56">
    <ResponsiveContainer>
      <AreaChart data={timeline.data ?? []} stackOffset="none">
        <XAxis dataKey="date" stroke="#4A5963" fontSize={11} />
        <YAxis stroke="#4A5963" fontSize={11} />
        <Tooltip />
        <Area type="monotone" dataKey="positive" stackId="1" stroke="#00A972" fill="#00A972" fillOpacity={0.5} />
        <Area type="monotone" dataKey="neutral" stackId="1" stroke="#9CA3AF" fill="#9CA3AF" fillOpacity={0.4} />
        <Area type="monotone" dataKey="negative" stackId="1" stroke="#FF3621" fill="#FF3621" fillOpacity={0.5} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
</section>
```

- [ ] **Step 6: Add a telemetry detail panel to MaintenancePage**

In `MaintenancePage.tsx`, add a selection state and a panel that fetches `/maintenance/telemetry`:

```typescript
import { useState } from "react";
import { Sparkline } from "@/components/Sparkline";
const [selectedId, setSelectedId] = useState<number | null>(null);
const telemetry = useApi<{ts:string; temperature:number; vibration:number; runtime_hours_delta:number}[]>(
  ["maint-telemetry", selectedId], "/maintenance/telemetry", { equipment_id: selectedId ?? 0, days: 14 },
  { enabled: selectedId != null }
);
// add a column to the at-risk table for selecting a unit:
{ key: "_pick", header: "", align: "right", render: (r) => <button onClick={() => setSelectedId(r.equipment_id)} className="rounded-md border border-[color:var(--color-hairline)] px-2 py-1 text-xs">Inspect</button> },
// and below the table:
{selectedId != null && (
  <section className="rounded-lg border border-[color:var(--color-hairline)] bg-white p-4">
    <h3 className="mb-2 text-sm font-semibold text-[color:var(--color-ink)]">Telemetry · Unit #{selectedId}</h3>
    <div className="grid grid-cols-3 gap-3">
      <div><div className="text-xs text-[color:var(--color-ink-soft)]">Temperature</div><Sparkline data={(telemetry.data ?? []).map(t => ({ ...t, value: t.temperature }))} color="#FF3621" /></div>
      <div><div className="text-xs text-[color:var(--color-ink-soft)]">Vibration</div><Sparkline data={(telemetry.data ?? []).map(t => ({ ...t, value: t.vibration }))} color="#FBB300" /></div>
      <div><div className="text-xs text-[color:var(--color-ink-soft)]">Runtime hrs</div><Sparkline data={(telemetry.data ?? []).map(t => ({ ...t, value: t.runtime_hours_delta }))} color="#4462C9" /></div>
    </div>
  </section>
)}
```

- [ ] **Step 7: Commit**

```bash
git add ui/src/components/Sparkline.tsx ui/src/pages src/lakehouse_market/routers/sentiment.py
git commit -m "feat(ui): tab charts (Labor bar, Loyalty trend, Supply demand-vs-supply, Sentiment timeline, Maintenance telemetry)"
```

---

## Phase 7 — Databricks Asset Bundle (DAB) for deploy

### Task 7.1: app.yaml + databricks.yml + resources

**Files:**
- Create: `app.yaml`
- Create: `databricks.yml`
- Create: `resources/app.yml`
- Create: `resources/lakebase.yml`
- Create: `resources/serving.yml`
- Create: `resources/genie.yml`
- Create: `resources/jobs.yml`

- [ ] **Step 1: Write `app.yaml`**

```yaml
# app.yaml — Databricks App start command
command:
  - uvicorn
  - lakehouse_market.app:app
  - --host=0.0.0.0
  - --port=8000
env:
  - name: LHM_CATALOG
    value: jdub_demo
  - name: LHM_SCHEMA
    value: lakehouse_market
  - name: GENIE_SPACE_ID
    valueFrom: GENIE_SPACE_ID
  - name: LABOR_ENDPOINT
    value: lhm-labor-recommender
  - name: FM_ENDPOINT
    value: databricks-claude-sonnet-4-6
```

- [ ] **Step 2: Write `databricks.yml`**

```yaml
bundle:
  name: lakehouse-market-e2e-DAIS-demo

variables:
  catalog: { default: jdub_demo }
  schema:  { default: lakehouse_market }
  app_name: { default: lakehouse-market-homebase }
  lakebase_instance: { default: lakehouse-market-app-db }
  user_email: { default: jonathan.whiteley@databricks.com }
  genie_space_id: { default: "" }     # populated after first PATCH

include:
  - resources/*.yml

targets:
  default:
    mode: development
    workspace:
      profile: DEFAULT
```

- [ ] **Step 3: Write `resources/app.yml`**

```yaml
resources:
  apps:
    homebase:
      name: ${var.app_name}
      source_code_path: .
      resources:
        - name: warehouse-default
          sql_warehouse:
            id: ${workspace.default_warehouse_id}
            permission: CAN_USE
```

- [ ] **Step 4: Write `resources/lakebase.yml`**

```yaml
resources:
  database_instances:
    homebase_db:
      name: ${var.lakebase_instance}
      capacity: CU_1
```

- [ ] **Step 5: Write `resources/serving.yml`**

```yaml
resources:
  model_serving_endpoints:
    lhm_labor_recommender:
      name: lhm-labor-recommender
      config:
        served_entities:
          - name: labor_v1
            entity_name: ${var.catalog}.${var.schema}.lhm_labor_recommender
            entity_version: "1"
            workload_size: Small
            scale_to_zero_enabled: true
```

- [ ] **Step 6: Write `resources/genie.yml`**

```yaml
# Genie spaces are not yet a first-class DAB resource; we PATCH via a job post-deploy.
# This file is a placeholder noting the dependency. See resources/jobs.yml for the PATCH job.
resources: {}
```

- [ ] **Step 7: Write `resources/jobs.yml`**

```yaml
resources:
  jobs:
    lhm_init_job:
      name: lhm-init
      tasks:
        - task_key: gen_data
          notebook_task:
            notebook_path: ./notebooks/01_generate_data.py
            base_parameters: { catalog: ${var.catalog} }
        - task_key: train_labor
          depends_on: [ { task_key: gen_data } ]
          notebook_task:
            notebook_path: ./notebooks/02_train_labor_model.py
            base_parameters: { catalog: ${var.catalog} }
        - task_key: score_loyalty
          depends_on: [ { task_key: gen_data } ]
          notebook_task:
            notebook_path: ./notebooks/03_score_loyalty.py
            base_parameters: { catalog: ${var.catalog} }
        - task_key: score_equipment
          depends_on: [ { task_key: gen_data } ]
          notebook_task:
            notebook_path: ./notebooks/04_score_equipment.py
            base_parameters: { catalog: ${var.catalog} }
        - task_key: label_reviews
          depends_on: [ { task_key: gen_data } ]
          notebook_task:
            notebook_path: ./notebooks/05_label_reviews.py
            base_parameters: { catalog: ${var.catalog} }
```

- [ ] **Step 8: Commit**

```bash
git add app.yaml databricks.yml resources/
git commit -m "feat(deploy): DAB bundle (app + lakebase + serving + init job)"
```

### Task 7.2: Build the UI before bundle deploy

**Files:**
- Create: `Makefile`

- [ ] **Step 1: Write `Makefile`**

```makefile
.PHONY: dev build deploy run-init

dev:
	cd ui && npm run dev & uvicorn lakehouse_market.app:app --reload --port 8000

build:
	cd ui && npm install && npm run build

deploy: build
	databricks bundle deploy

run-init:
	databricks bundle run lhm_init_job
```

- [ ] **Step 2: Verify the bundle is valid**

Run: `databricks bundle validate`
Expected: no errors. (May warn about missing Genie space id; that's expected pre-PATCH.)

- [ ] **Step 3: Commit**

```bash
git add Makefile
git commit -m "chore: Makefile for dev / build / deploy / run-init"
```

### Task 7.3: README with run instructions

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Lakehouse Market · Homebase

A Databricks App: store-manager daily operations console for a fictional QSR.
Built end-to-end on Databricks (UC, Lakebase, Model Serving, Genie, Foundation Models).

## Quick start (deploy to Databricks)

```bash
make build && make deploy && make run-init
```

After `run-init` succeeds, open the deployed app from the Databricks workspace and select your store.

## Local dev

```bash
uv sync --all-extras
export DATABRICKS_HOST=...   DATABRICKS_WAREHOUSE_ID=...   DATABRICKS_TOKEN=...
make dev
# UI on http://localhost:5173, API on http://localhost:8000
```

## Architecture

See `docs/superpowers/specs/2026-05-30-lakehouse-market-demo-design.md` and `docs/superpowers/plans/2026-05-30-lakehouse-market-homebase.md`.

## Five tabs

01 Labor · 02 Loyalty · 03 Supply Chain · 04 Sentiment · 05 Maintenance.
Every tab has an embedded Genie panel and at least one Lakebase write action.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with quick-start"
```

---

## Phase 8 — End-to-end smoke

### Task 8.1: Deploy to the workspace and run init

- [ ] **Step 1: Validate**

Run: `databricks bundle validate`
Expected: no errors.

- [ ] **Step 2: Deploy**

Run: `make deploy`
Expected: bundle deploys; app stub created in workspace; serving endpoint provisioned; Lakebase instance provisioning starts.

- [ ] **Step 3: Run init job**

Run: `make run-init`
Expected: 5 notebook tasks complete. Verify in workspace UI.

- [ ] **Step 4: PATCH the Genie space** — create a Genie space in the UI scoped over the 21 tables listed in the spec §8, paste the id into `GENIE_SPACE_ID` env var, re-deploy.

Run: `databricks genie spaces list | grep lhm-ops` (or use the UI)
Expected: a space exists. Set the env var on the app.

- [ ] **Step 5: Open the app**

In the workspace UI, open the deployed app URL.
Expected: lands on `/`, shows hub diagram + action queue. Switch tabs; verify each renders. Run one write action per tab and confirm a row appears in Lakebase via `psql` or workspace SQL editor.

### Task 8.2: Walkthrough acceptance

- [ ] **Step 1: Run a 15-minute walkthrough against the success criteria in the spec §10**

Check off:
- [ ] Bundle deploy + init job completes in <30 min from clean checkout.
- [ ] All 5 tabs render with data scoped to the selected store.
- [ ] All 5 write-back actions land rows in Lakebase.
- [ ] Genie answers at least one seeded prompt per tab.
- [ ] Loyalty trade-area map renders centered on selected store.
- [ ] Hub shows the morning briefing.
- [ ] Visual quality OK; no AI-generic boxiness.

- [ ] **Step 2: Tag v0.1.0**

```bash
git tag v0.1.0 && git push --tags
```

---

## Self-review note

The plan covers spec §1–§11. Each tab has read, write, and Genie tasks. The single served model (labor) and four precomputed score notebooks match the spec decision. Lakebase write tables match (`app_labor_overrides`, `app_offer_pushes`, `app_purchase_orders`, `app_review_responses`, `app_work_orders`). Trade-area map is implemented on Loyalty per the spec. Hub landing page is implemented per the spec.

**Known gaps to be filled in execution:** the data-gen notebook's `text` field on `reviews` uses a placeholder string — a follow-up pass replacing it with real FM-generated short review snippets is worth a single Task 1.5b but the demo still works without it (snippets show as `placeholder-review-{id}` until then). If you want realistic snippets at launch, add a task that calls `databricks-meta-llama-3-3-70b-instruct` with rating + topic seeds and updates the `reviews.text` column.
