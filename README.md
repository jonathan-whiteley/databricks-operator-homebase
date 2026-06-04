# Lakehouse Market · Homebase

**A Databricks App: store-manager daily operations console for a fictional QSR, built end-to-end on the lakehouse.**

Six modules — Today / Labor / Inventory / Equipment / Loyalty / Guest Feedback — sharing one synthetic dataset, real Lakebase write-back on every action, real Genie chat from a right slide-over, and one Model Serving endpoint backing labor recommendations. Designed for the Data + AI Summit demo loop and SA-led customer walkthroughs.

> Working name: `lakehouse-market-e2e-DAIS-demo` · Product name in the UI: **Lakehouse Market · Homebase**

**Deployed:** [`lakehouse-market-homebase`](https://lakehouse-market-homebase-66306676349647.aws.databricksapps.com) on `fe-vm-jdub-vm-serverless` (branch `feature/claude-design-homebase`).

---

## Audience

The user inside the app is a **single-store QSR manager** logging in at 7am:

- Lock today's day-part schedule (Labor)
- Push counter prompts and recover at-risk regulars (Loyalty)
- Release reorders before close (Inventory)
- Triage new reviews and respond (Guest Feedback)
- Schedule a tech before the cooler dies (Equipment)

The demo audience is a Databricks customer's ops or platform team. The pitch: **"this is what your manager's console looks like when you build it on the lakehouse."**

---

## Architecture

```
                ┌─────────────────────────────────────────────┐
                │  React 19 + Vite + Tailwind 4 UI (db/* tokens) │
                │  Sidebar + TopBar + Genie slide-over            │
                │  6 views: Today / Labor / Inventory /          │
                │           Equipment / Loyalty / Feedback        │
                └────────────────┬────────────────────────────────┘
                                 │  /api/*
                ┌────────────────▼────────────────────────────────┐
                │  FastAPI (uvicorn :8000, mounts static UI at /) │
                │  Routers: meta · today · labor · loyalty ·       │
                │           supply · sentiment · maintenance · genie │
                └──┬───────────────┬──────────────────┬────────────┘
                   │               │                  │
                   ▼               ▼                  ▼
              ┌─────────┐    ┌──────────┐      ┌───────────────┐
              │ UC reads│    │ Lakebase │      │  Genie space  │
              │ via SQL │    │ Postgres │      │  + Model      │
              │ warehouse│   │ (writes) │      │  Serving FM   │
              └─────────┘    └──────────┘      └───────────────┘
```

- **Unity Catalog** `${catalog}.lakehouse_market` (read-only from the app) — 21 tables populated by the init job.
- **Lakebase Postgres** instance `lakehouse-market-app-db`, schema `lhm_app` (SP-owned) — 5 write tables.
- **Model Serving** endpoint `lhm-labor-recommender` (or `dev_<user>_lhm-labor-recommender` in DAB dev mode) — one small ElasticNet.
- **Foundation Models**: `databricks-claude-sonnet-4-6` for the Feedback weekly digest. `databricks-meta-llama-3-3-70b-instruct` for batch review labeling.
- **Genie**: one shared space `lhm-ops-assistant` scoped over all 21 UC tables. Embedded as a right slide-over with route-derived `tab_id`.

---

## Quick start — deploy from scratch

Single command, fresh workspace:

```bash
make setup
```

This runs `scripts/setup.sh` which is **idempotent** — safe to re-run. Under the hood:

1. Picks a SQL warehouse (env `WAREHOUSE_ID` wins; otherwise first Serverless / running)
2. Builds the UI
3. **Stage 1 deploy** — bundle without the Lakebase resource binding and without the Model Serving endpoint (those depend on resources that don't exist yet)
4. **Grants** the App SP `USE CATALOG / USE SCHEMA / SELECT` on the UC catalog/schema
5. Bumps warehouse `auto_stop_mins` from 10 → 120 so the demo stays warm
6. Runs `lhm_init_job` — 6 notebooks (data gen, labor training, churn scoring, equipment RUL, review labeling, Genie space)
7. Captures the Genie space id, grants the App SP `CAN_RUN` on it
8. **Stage 2 deploy** — re-enables the Lakebase binding + Serving endpoint, wires `GENIE_SPACE_ID` and `LABOR_ENDPOINT` env (with dev-mode prefix)
9. Re-deploys the app source so it picks up the new bindings
10. Waits for `RUNNING` and prints the URL

Total time on a fresh workspace: ~12-15 minutes (most of it is the init job).

**Redeploying an existing workspace** (UI changes only, no resource churn):

```bash
make build       # bundles UI into src/lakehouse_market/static/
databricks bundle deploy
databricks bundle run homebase
```

**Prereqs:**

- `databricks` CLI v0.230+ authenticated to the target workspace (`databricks auth login`)
- `uv` (`pip install uv` or `brew install uv`)
- Node ≥ 20
- `jq`

---

## Local dev

```bash
make install
cp .env.example .env       # edit with your DATABRICKS_HOST, WAREHOUSE_ID, TOKEN
make dev                   # UI on :5173 (proxies /api → :8000), FastAPI on :8000
```

Run tests:

```bash
make test
```

---

## Tour mode

A booth-loop walkthrough hangs off the top-bar **Tour** button. It runs the script in `ui/src/lib/tour-script.ts` end-to-end in **2:00**, navigating the six routes, opening the Genie slide-over for the Genie beat, and driving an animated cursor (`ui/src/components/db/TourCursor.tsx`) that glides to each beat's primary action, rings the target, ripples on click, and fires the matching fake-success toast. The cursor never dispatches real DOM events; any real interaction (click, keydown, wheel) pauses the loop and gives the user normal control.

Beat layout: `/today` 8s → `/labor` 16s → `/inventory` 16s → `/equipment` 16s → `/members` 16s → `/feedback` 16s → Genie panel 24s → `/today` 8s.

Tour targets are tagged on the primary action of each view via `data-tour-target="<page>.<key>"` (`Btn` exposes a `dataTourTarget` prop). Add targets there if you extend the script.

---

## View tour

Every view uses a shared design system at `ui/src/components/db/*` (Btn, Pill, Card, AIRec, LakebaseTag, etc.) and routes are React Router 6.

| # | Route | View | What it does | Writes to |
|---|---|---|---|---|
| 1 | `/today` | TodayView | Genie-at-center radial hub (5 module nodes) + today's-brief hero card. Sidebar logo uses the Databricks symbol SVG | n/a |
| 2 | `/labor` | LaborView | Day-part planner cards with override + Recompute + Lock | `app_labor_overrides` |
| 3 | `/inventory` | InventoryView | Per-vendor PO cards + tomorrow's deliveries + "Release order" | `app_purchase_orders` |
| 4 | `/equipment` | EquipmentView | Navy CoolerAlert hero + at-risk grid + service scheduling | `app_work_orders` |
| 5 | `/members` | MembersView | Guided win-back composer + trade-area map + at-risk preview | `app_offer_pushes` |
| 6 | `/feedback` | FeedbackView | Sentiment timeline + reply queue + AI-drafted responses | `app_review_responses` |

Genie is a single right slide-over (`ui/src/components/db/GeniePanel.tsx`) toggled from the top bar, with prompt context derived from the current route (`tab_id` + `store_id` are auto-injected on every `/api/genie/ask`).

---

## Data anchor (dynamic)

Synthetic data has a fixed date window (last day of the demo dataset). All date-filtered queries use `sql_utils.get_anchor_date()` which queries `MAX(date) FROM daily_sales_forecast` **once per process** and caches the result. The demo keeps working no matter how stale the data is. Override for tests / pinning: set `DEMO_ANCHOR_DATE=YYYY-MM-DD` env on the app.

---

## Data domains

UC schema: `${catalog}.lakehouse_market` (catalog default `jdub_demo`)

| Domain | Tables |
|---|---|
| Shared | `stores`, `dim_date`, `dim_time` |
| Labor | `daily_sales_forecast`, `hourly_transactions`, `staff_roster` |
| Loyalty | `loyalty_members`, `transactions`, `offers`, `member_segments`, `churn_predictions` |
| Supply | `skus`, `inventory_snapshots`, `suppliers`, `purchase_orders`, `demand_forecast` |
| Sentiment | `reviews`, `review_sentiment`, `review_topics` |
| Maintenance | `equipment`, `equipment_telemetry`, `rul_predictions`, `work_orders` |

Lakebase schema (writes only): `lhm_app.app_labor_overrides`, `lhm_app.app_offer_pushes`, `lhm_app.app_purchase_orders`, `lhm_app.app_review_responses`, `lhm_app.app_work_orders`.

Scale: 25 stores · 50k members · 500k transactions · 800 SKUs · 30k reviews · ~600 equipment units.

---

## Project layout

```
lakehouse-market-e2e-DAIS-demo/
├── app.yaml                # Databricks App start command + env
├── databricks.yml          # DAB root + variables (warehouse_id, catalog, schema, …)
├── pyproject.toml          # uv-managed Python deps
├── Makefile                # install / setup / dev / build / deploy / test
├── README.md               # this file
├── scripts/
│   ├── setup.sh            # idempotent fresh-workspace deploy (see Quick start)
│   └── grants.sql          # UC grants for the App SP (used by setup.sh)
├── resources/              # DAB resources
│   ├── app.yml             # App + bound warehouse + Lakebase database
│   ├── lakebase.yml        # Lakebase Postgres instance
│   ├── serving.yml         # lhm-labor-recommender Model Serving endpoint
│   ├── jobs.yml            # lhm-init job (6 notebook tasks)
│   └── genie.yml           # placeholder (Genie spaces are created by notebook 06)
├── notebooks/
│   ├── 01_generate_data.py # 21 UC tables (CROSS JOIN for daily forecast)
│   ├── 02_train_labor_model.py # ElasticNet + UC model signature
│   ├── 03_score_loyalty.py # rule-based churn + CLV
│   ├── 04_score_equipment.py   # rule-based RUL + health score
│   ├── 05_label_reviews.py # sentiment + topic labels + review text
│   └── 06_ensure_genie_space.py # idempotent Genie space create/PATCH
├── src/lakehouse_market/
│   ├── app.py              # FastAPI entry + SPA fallback for client routes
│   ├── config.py           # env-driven Settings
│   ├── deps.py             # warehouse client + Lakebase pool + token mint
│   ├── sql_utils.py        # fetch_all + 10-min TTL cache + get_anchor_date()
│   ├── lakebase_migrate.py # idempotent schema/table create (lhm_app)
│   ├── lakebase_schema.sql # 5 write tables in lhm_app schema
│   ├── fm.py               # foundation-model invocation helper
│   ├── genie.py            # Genie API wrapper (start-conversation, poll, fetch results)
│   ├── routers/            # 8 routers (today/meta/labor/loyalty/supply/sentiment/maintenance/genie)
│   └── static/             # built UI lands here (gitignored; force-included by DAB sync)
├── ui/                     # React 19 + Vite + Tailwind 4 + TypeScript
│   ├── public/fonts/       # DM Sans + DM Mono .ttfs (bundled)
│   ├── src/components/db/  # design-system primitives (Btn, Card, Sidebar, …)
│   ├── src/pages/          # 6 views (TodayView, LaborView, InventoryView, …)
│   └── src/state/          # store selector + Genie slide-over context
├── docs/
│   ├── learnings.md        # everything that broke and what fixed it
│   └── superpowers/
│       ├── specs/          # original spec
│       └── plans/          # implementation plans
└── tests/                  # pytest (29 tests, all routers + Lakebase migration)
```

---

## How writes work

Every write surface follows the same pattern:

1. UI click → opens `ConfirmDialog` (`ui/src/components/ConfirmDialog.tsx`) with a summary of what's about to happen + optional manager note
2. Approve → `POST /api/<router>/<action>` to the FastAPI backend
3. Backend acquires a Lakebase connection from the asyncpg pool (`deps.get_lakebase_pool`); pool init mints a fresh OAuth token via `w.database.generate_database_credential(...)` (Lakebase doesn't accept static passwords)
4. INSERT into `lhm_app.app_*` (fully qualified — `search_path` isn't reliable in pooled connections)
5. Response toast renders in the bottom-right (dark navy, `z-index: 9999` so the Leaflet map can't obscure it)

For the win-back bulk action, the backend uses asyncpg's `executemany` to insert one row per eligible member in a single round trip.

---

## How Genie works

| Bit | Where |
|---|---|
| Space spec (tables + sample qs + example SQLs + instructions) | `notebooks/06_ensure_genie_space.py` — idempotent: creates new on first run, PATCHes existing on subsequent runs |
| Serialized space proto | `version: 2` with sorted uuid-keyed `data_sources.tables`, `instructions.text_instructions`, `instructions.example_question_sqls`, `config.sample_questions` |
| Permission grant | `PUT /api/2.0/permissions/genie/{space_id}` with `CAN_RUN` for the App SP (done by `setup.sh`) |
| App → Genie | `routers/genie.py:ask()` POSTs `/api/2.0/genie/spaces/{id}/start-conversation`, polls `/messages/{id}` until COMPLETED, extracts `attachments[].query.description + ` a 5-row data preview |
| Frontend | `state/genie-panel.tsx` derives `tab_id` from the current route, sends `{ tab_id, store_id, question }` to `/api/genie/ask` |

---

## Troubleshooting

See **[`docs/learnings.md`](docs/learnings.md)** for the full list of gotchas and fixes from the build-out. Common ones:

| Symptom | Fix |
|---|---|
| All `/api/*` return 500 right after deploy | The App SP doesn't have UC grants yet. Run `make setup` again, or grant manually (see `scripts/grants.sql`) |
| Write buttons 500 with `permission denied for schema public` | The migration didn't run. Check `databricks apps logs lakehouse-market-homebase` for `[lakebase_migrate] tables in lhm_app: [...]` — restart the app if missing |
| Write buttons 500 with `'str' object has no attribute 'toordinal'` | asyncpg DATE encoder rejects strings. Convert with `datetime.date.fromisoformat()` in the router |
| Genie chat returns the prompt echoed back | API response is wrapped: read `resp["message"]` not `resp` directly, extract from `message["attachments"]` not `message["content"]` |
| KPIs all show 0 / blank | Warehouse is STOPPED (auto-stop fired). It restarts on first query; subsequent calls are fast. Bump `auto_stop_mins` or accept the 5-10s warm-up |
| Tabs return 404 from FastAPI | SPA fallback missing — `app.py` needs the catch-all that returns `index.html` for non-`/api/*` paths |

---

## What's intentionally not here

- **Real PII** — all data synthetic.
- **Production auth** — uses the App SP via OBO. No custom user system.
- **Mobile** — desktop-only.
- **Multi-brand theming** — theme-object seam preserved in `ui/src/components/db/`, but only one brand ships.
- **Production ML quality** — models are demo-grade.

---

Powered by Databricks · Lakebase + Genie + Model Serving + UC + Apps.
