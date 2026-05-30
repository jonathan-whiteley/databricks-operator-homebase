# Lakehouse Market: Travel & Hospitality Demo App

**Spec date:** 2026-05-30
**Owner:** Jonathan Whiteley
**Status:** Draft for review

## 1. Purpose

A single Databricks App that demonstrates five Travel & Hospitality use cases against one synthetic dataset for a fictional QSR chain ("Lakehouse Market"). Built for SA-led demos: a customer should be able to click through five polished tabs in 15 minutes and see the lakehouse-as-platform story end-to-end (data → ML/AI → ops UI → write-back).

The five use cases:

1. **Labor Optimization** — forecast-driven day-part headcount, manager override + approval flow.
2. **Loyalty / Personalization** — guest segmentation, next-best-offer, churn risk.
3. **Supply Chain / Inventory Management** — on-hand inventory, reorder recommendations, supplier risk.
4. **Sentiment Analysis of Reviews** — review volume + sentiment timeline, topic discovery, LLM weekly digest.
5. **Predictive Maintenance** — kitchen equipment health, remaining useful life (RUL), work-order queue.

## 2. Non-goals

- Real customer data. Everything is synthetic. No PII handling, no GDPR/CCPA work.
- Production-grade auth. Use the default Databricks Apps OBO model with the SP. No custom user system.
- Multi-tenancy / brand customizer in the UI. Only one brand ships: Databricks-themed Lakehouse Market.
- Bespoke ML model quality. Models are demo-grade; the point is the platform integration, not lifting accuracy.
- Mobile-first. Desktop-only layout; tablet acceptable but not optimized.

## 3. Brand fiction & visual language

**Lakehouse Market** is a 1,200-store QSR chain (mixed mall food court + drive-thru), founded 2018, HQ in San Francisco. Menu: breakfast bowls, lunch sandwiches/salads, dinner plates, late-night snacks. Equipment: ovens, fryers, refrigeration, espresso machines, POS terminals. Suppliers: produce, proteins, packaging.

**Visual identity:** Databricks brand applied as the "platform skin" — the app is presented as the Databricks-built operations cockpit for Lakehouse Market.

- **Logo**: real Databricks lava-flame mark + "Databricks" wordmark in the top-left chrome. "Lakehouse Market" appears as a secondary wordmark / page subtitle, never replacing the Databricks mark.
- **Palette** (lifted from live-data-intelligence `brand-tokens.css`):
  - Lava `#FF3621` (primary / CTA / brand accent)
  - Navy `#0B2026` (ink / dark surfaces)
  - Success `#00A972`, Warning `#FBB300`, Info `#4462C9`
  - Teal `#1B5162`, Rose `#98102A` (chart series)
  - Neutral grays + oklch mix overlays
- **Type**: DM Sans (body), DM Mono (numbers, IDs). H1 48 / H2 32 / H3 24 / H4 20 / body 16.
- **Spacing**: 4-px base grid. **Radius**: 4 / 8 / 12 / pill. **Shadows**: sm / md / lg per live-data-intelligence tokens.

## 4. Stack & architecture

Take the labor-iq stack wholesale; it works and the user knows it.

**Backend** (`src/lakehouse_market/`):
- FastAPI 0.115+ on Uvicorn.
- Pydantic 2 schemas.
- `databricks-sdk` for SQL warehouse + serving + vector search.
- `asyncpg` for Lakebase Postgres (app writes only).
- Static-files mount serves the built React UI at `/`; `/api/*` routes registered first.

**Frontend** (`ui/`):
- React 19 + Vite 8 + TypeScript.
- Tailwind 4 via `@tailwindcss/vite`, with `@theme` block.
- React Router 6 for the 5 tabs + hub (lazy-loaded pages, mirroring live-data-intelligence).
- TanStack Query for fetch + cache.
- Recharts for charts. Lucide for icons. Leaflet only if map needed (defer).
- Brand theme object pattern from labor-iq (`ui/src/lib/themes/lakehouse-market.ts`); ships a single theme but keeps the seam.

**Data**:
- **Unity Catalog** `jdub_demo.lakehouse_market` (per memory rule: default workspace catalog is `jdub_demo`). Read-only from the app.
- **Lakebase Postgres** instance `lakehouse-market-app-db` for app writes: labor overrides, accepted offers, generated POs, work-order acks. Schemas mirror the write tables only.
- **Synthetic-data notebook** (`notebooks/01_generate_data.py`) produces all UC tables using Polars + Mimesis per the `databricks-data-generation` skill. Idempotent; one-shot regenerate.

**Project layout** (mirrors labor-iq):

```
lakehouse-market-demo/
  app.yaml                 # Databricks App start command
  databricks.yml           # DAB root
  pyproject.toml
  uv.lock
  resources/               # DAB resource yml: app, lakebase, genie, jobs
  notebooks/
    01_generate_data.py
    02_train_labor_model.py
    03_train_churn_model.py
    04_train_rul_model.py
    05_sentiment_inference.py
  src/lakehouse_market/
    app.py                 # FastAPI entry; mounts static + routers
    config.py
    deps.py                # warehouse + lakebase pool deps
    routers/
      labor.py
      loyalty.py
      supply.py
      sentiment.py
      maintenance.py
      genie.py             # shared AI router
      meta.py              # /api/health, /api/version, /api/anchor
    static/                # built UI lands here
  ui/
    package.json
    vite.config.ts
    tailwind config inline in styles.css per Tailwind 4
    src/
      App.tsx              # router shell
      lib/
        api.ts             # axios + react-query helpers
        theme.ts           # brand-theme contract
        themes/lakehouse-market.ts
        tokens/
          brand-tokens.css
          chart-tokens.ts
      components/
        AppHeader.tsx      # sticky top nav (live-data-intelligence pattern)
        TabNav.tsx
        MetricCard.tsx
        KPIRing.tsx
        DataTable.tsx
        AskAIPanel.tsx     # global Genie/FM drawer
        ... (per-tab components below)
      pages/
        HubPage.tsx
        LaborPage.tsx
        LoyaltyPage.tsx
        SupplyPage.tsx
        SentimentPage.tsx
        MaintenancePage.tsx
  docs/superpowers/specs/  # this file lives here
  tests/
```

## 5. Layout shell

Direct lift of the live-data-intelligence chrome, re-skinned:

- **Sticky `AppHeader`** at top, z-50, glass-blur, shadow.
  - Left: real Databricks lava mark + "Databricks" wordmark + thin divider + "Lakehouse Market" subtitle in Navy.
  - Center: 5-tab nav with numbered badges:
    - `01 Labor` → `/labor`
    - `02 Loyalty` → `/loyalty`
    - `03 Supply Chain` → `/supply`
    - `04 Sentiment` → `/sentiment`
    - `05 Maintenance` → `/maintenance`
  - Right: store selector dropdown (scope filter, persists in localStorage), "Ask AI" lava-colored button opens the global drawer.
- **Hub landing page** (`/`): 5-app circular SVG diagram (live-data-intelligence pattern), each node links to its tab.
- **Page content**: each tab follows the same skeleton — page title row, KPI strip (3-4 `MetricCard`s), main panel(s), action surface (table or queue), and a tab-local "Ask AI" prompt seed.
- **AskAIPanel**: right-side drawer, shared across tabs. Each tab seeds it with context-specific prompts ("Why did labor % spike at store 42 last Friday?"). Backed by a Genie space + an FM endpoint for free-form summarization.

## 6. The five tabs

For each tab: what the demo shows, the synthetic data it reads, and what the user can write back.

### 6.1 Labor Optimization (`/labor`)

Lifts the labor-iq UX 1:1 and re-skins it.

- **Top KPI strip**: total forecasted revenue today, recommended headcount, projected labor %, vs-yesterday delta.
- **Day-part cards** (Breakfast / Lunch / Dinner / Late): forecast revenue, recommended crew by role (cashier / cook / runner), labor %, override input → recompute via labor model serving endpoint.
- **Approvals table**: recent overrides with delta crew, delta cost, manager note, locked/unlocked state.
- **Write-back** (Lakebase, table `app_labor_overrides`): approved schedule per (store, date, day-part).
- **Reads**: `daily_sales_forecast`, `hourly_transactions`, `staff_roster`, `stores`.

### 6.2 Loyalty / Personalization (`/loyalty`)

- **Top KPI strip**: active members, 30-day spend, churn-risk members, top-segment LTV.
- **Segment cards**: Whales, Loyal, At-Risk, New, Lapsed — counts + 30-day trend sparkline + median LTV.
- **Member table**: top members by predicted CLV with churn risk score, next-best-offer (from offer ranker), accept/decline action.
- **Offer impact chart**: redemption rate vs. control over last 8 weeks.
- **Write-back** (Lakebase, table `app_offer_acceptances`): accepted offers per member.
- **Reads**: `loyalty_members`, `transactions`, `offers`, `member_segments`, `churn_predictions`.

### 6.3 Supply Chain / Inventory (`/supply`)

- **Top KPI strip**: SKUs below reorder point, projected stock-outs (7 day), open POs, supplier on-time %.
- **Inventory table**: SKU, location, on-hand, days-of-cover, reorder point, supplier, lead-time band, status chip.
- **Demand vs supply chart**: forecasted weekly demand vs current on-hand + scheduled inbound for a selected SKU.
- **Supplier card grid**: top suppliers with reliability score, late-delivery rate, average lead time.
- **Action**: one-click "Generate PO" from a flagged SKU → row added to Lakebase `app_purchase_orders`.
- **Reads**: `inventory_snapshots`, `skus`, `suppliers`, `purchase_orders`, `demand_forecast`.

### 6.4 Sentiment Analysis of Reviews (`/sentiment`)

- **Top KPI strip**: 30-day review count, average rating, % negative, NPS proxy.
- **Sentiment timeline**: stacked area of positive / neutral / negative reviews per day, with the foundation-model weekly digest summary card next to it.
- **Topic explorer**: top topics (service speed, food quality, cleanliness, value, app/order experience) with sentiment split + sample excerpts on hover.
- **Store leaderboard**: best and worst rated stores last 30 days, with one-click "Send to GM" stub (toast only; no email integration).
- **LLM weekly digest**: `databricks-claude-sonnet-4-6` summary card generated server-side, cached 1h.
- **Reads**: `reviews`, `review_sentiment`, `review_topics`, `stores`.
- **No app write-back** (sentiment is read-only).

### 6.5 Predictive Maintenance (`/maintenance`)

- **Top KPI strip**: equipment online %, predicted failures next 7 days, open work orders, mean time between failures (MTBF) trend chip.
- **Equipment grid**: each unit with health-score ring (KPIRing component), RUL in days, last-telemetry timestamp, status badge.
- **Telemetry detail panel**: pick a unit → sparkline triplet (temperature, vibration, runtime hours) over last 14 days + predicted failure date.
- **Work-order queue**: open / in-progress / done columns; one-click "Create Work Order" from a high-risk unit → row in Lakebase `app_work_orders`.
- **Reads**: `equipment`, `equipment_telemetry`, `rul_predictions`, `work_orders`.

## 7. Synthetic data plan

One UC schema, generated once by `notebooks/01_generate_data.py`.

**Catalog/schema**: `jdub_demo.lakehouse_market`

**Scale targets** (right-sized for a fast demo):
- 25 stores, 12 months of daily history, 90 days of hourly transactions for labor.
- 50,000 loyalty members, ~500k transactions over 6 months.
- 800 SKUs, 30 suppliers, 90 days of inventory snapshots and 26 weeks of demand history.
- 30,000 reviews over 18 months with `review_sentiment` scored once at generation time via FM batch (or rule-based fallback if FM is slow).
- 600 equipment units (5 categories × 25 stores ≈ 600 with some variation), 90 days of telemetry, RUL predictions refreshed daily by a notebook job.

**Tables** (read by the app via SQL warehouse):

| Domain | Tables |
|---|---|
| Shared | `stores`, `dim_date`, `dim_time` |
| Labor | `daily_sales_forecast`, `hourly_transactions`, `staff_roster` |
| Loyalty | `loyalty_members`, `transactions`, `offers`, `member_segments`, `churn_predictions` |
| Supply | `skus`, `inventory_snapshots`, `suppliers`, `purchase_orders`, `demand_forecast` |
| Sentiment | `reviews`, `review_sentiment`, `review_topics` |
| Maintenance | `equipment`, `equipment_telemetry`, `rul_predictions`, `work_orders` |

**Tools**: the generation notebook runs inside the Databricks workspace as part of `lhm_init_job`, so use `dbldatagen` (Spark-native, scales fine to 500k rows) per the `databricks-data-generation` skill. Mimesis is only used for realistic name/address strings on the lookup dims (`stores`, `loyalty_members`, `suppliers`). Sentiment + topic labels are written once at generation time (cheaper than running FM on every request).

**Lakebase write tables** (separate schema in the Postgres instance):
- `app_labor_overrides`
- `app_offer_acceptances`
- `app_purchase_orders`
- `app_work_orders`

## 8. ML & AI integration

Each piece is a real Databricks integration so the demo doubles as a platform proof point.

- **Labor model**: small linear/elasticnet regressor on day-part revenue → headcount. Served by Model Serving endpoint `lhm-labor-recommender`. Notebook `02_train_labor_model.py` trains it on the synthetic forecast.
- **Churn / CLV model**: gradient-boosted scorer on member features → churn probability + predicted CLV. Endpoint `lhm-churn-clv`. Notebook `03_train_churn_model.py`.
- **RUL model**: simple survival-style scorer per equipment category. Endpoint `lhm-equipment-rul`. Notebook `04_train_rul_model.py`.
- **Sentiment + topic**: FM batch labels at generation time via `databricks-claude-sonnet-4-6` (or `databricks-meta-llama-3-3-70b-instruct` as fallback) in notebook `05_sentiment_inference.py`. The app re-scores nothing at runtime.
- **Weekly digest**: foundation-model endpoint call at app runtime, 1-hour server cache.
- **Ask AI drawer**: one Genie space `lhm-ops-assistant` mapped to all six tables groups via UC; the drawer also offers an FM free-form mode for narrative summaries when Genie's structured answer isn't what the user wants. Tab pages seed the prompt with a context blurb.

## 9. Deployment

Single Databricks Asset Bundle (DAB).

**`databricks.yml`** declares:
- Variables: `catalog` (default `jdub_demo`), `schema` (`lakehouse_market`), `app_name`, `lakebase_instance`, `genie_space_id`, `serving_endpoint_*` per model.
- Includes `resources/*.yml`: app, lakebase instance, three model serving endpoints, Genie space PATCH, and a data-gen job that runs the five notebooks in order.

**Default target**: workspace `fe-vm-jdub-vm-serverless` (per memory). One `databricks bundle deploy && databricks bundle run lhm_init_job` from a clean repo provisions everything.

**Local dev** mirrors labor-iq:
- `cd ui && npm run dev` (Vite on 5173, proxy `/api` → 8000)
- `uvicorn lakehouse_market.app:app --reload --port 8000` (with `DATABRICKS_HOST` + `DATABRICKS_WAREHOUSE_ID` env)
- Build → `cd ui && npm run build` writes to `src/lakehouse_market/static/`

## 10. Success criteria

The demo is "done" when:

1. `databricks bundle deploy && databricks bundle run lhm_init_job` produces a working app from a clean checkout in under 30 minutes.
2. All five tabs render with real synthetic data and at least one chart + one table per tab.
3. Three write-back actions work end-to-end (labor override → Lakebase row; PO generate → Lakebase row; work-order create → Lakebase row).
4. The Ask AI drawer answers at least one structured question per tab via Genie.
5. Visual quality matches labor-iq's polish: DM Sans typography, consistent spacing, Databricks lava CTA color, no AI-generic boxiness. A T&H account exec can present from it without slide deck fallback.

## 11. Risks & open questions to revisit

- **Genie scope**: one global space across all six table groups vs. five tab-scoped spaces. Default: one global; revisit if tab-specific accuracy drops.
- **Serving endpoint cold start**: three custom endpoints + one FM endpoint may be slow on a fresh workspace. Mitigation: keep models tiny; warm them in `lhm_init_job` post-deploy.
- **FM cost for sentiment labeling at generation time**: 30k reviews × Sonnet 4.6 is non-trivial. Use Llama 3.3 70B for labeling; reserve Sonnet for the weekly digest UI call.
- **Lakebase region availability**: only available in some regions. Verify `fe-vm-jdub-vm-serverless` supports Lakebase before deploy; if not, switch the target workspace or drop write-back features and use a UC managed table for app writes as a fallback.
