# Lakehouse Market Homebase: Store Manager's Daily Operations Console

**Spec date:** 2026-05-30
**Owner:** Jonathan Whiteley
**Status:** Draft for review
**Working title / repo name:** `lakehouse-market-e2e-DAIS-demo` (DAIS = Data + AI Summit demo)
**Product name in the UI:** Lakehouse Market · Homebase
**Resource short code:** `lhm` (used in serving endpoint names, Genie space ids, DAB resource keys)

## 1. Purpose

A single Databricks App framed as **Homebase**, the daily operations console for a store manager at a fictional QSR chain ("Lakehouse Market"). The intended user is a single-store operator who logs in each morning to see what needs attention today: labor to approve, reorders to release, equipment to schedule, members to win back, and guest feedback to act on.

This is **not** a corporate analytics demo. It is the manager's homebase: one store at a time, action-oriented, every tab surfacing 3-5 things to actually do. The platform story (lakehouse → ML/AI → Lakebase write-back) is told through the manager's day, not through dashboards.

Demo positioning: a Databricks SA shows this to a T&H customer's ops team and says "this is what a store manager's console looks like when you build it on the lakehouse." The customer should leave wanting to build their own version.

The five operational domains (one tab each):

1. **Labor Optimization** — forecast-driven day-part headcount, manager override + lock.
2. **Loyalty / Personalization** — at-risk members in my store, next-best-offer to push at the counter today.
3. **Supply Chain / Inventory Management** — what to reorder before close, supplier risk for tomorrow's deliveries.
4. **Sentiment Analysis of Reviews** — new reviews of my store, topics trending up, response queue.
5. **Predictive Maintenance** — equipment likely to fail this week, open work orders, schedule a tech.

**Genie is the answer surface on every tab.** Every tab embeds a tab-scoped Genie panel (live-data-intelligence pattern) so the manager can ask "why did labor % spike last Friday?" in the Labor tab without leaving context. **Lakebase is the write surface on every tab.** Every tab has at least one persisted action (approve schedule, accept offer push, release PO, send response, create work order) so the demo always closes with "and that just wrote to Postgres on Databricks."

## 2. Non-goals

- Real customer data. Everything is synthetic. No PII handling, no GDPR/CCPA work.
- Production-grade auth. Use the default Databricks Apps OBO model with the SP. No custom user system.
- Multi-tenancy / brand customizer in the UI. Only one brand ships: Databricks-themed Lakehouse Market.
- Bespoke ML model quality. Models are demo-grade; the point is the platform integration, not lifting accuracy.
- Mobile-first. Desktop-only layout; tablet acceptable but not optimized.

## 3. Brand fiction & visual language

**Lakehouse Market** is a 1,200-store QSR chain (mixed mall food court + drive-thru), founded 2018, HQ in San Francisco. Menu: breakfast bowls, lunch sandwiches/salads, dinner plates, late-night snacks. Equipment: ovens, fryers, refrigeration, espresso machines, POS terminals. Suppliers: produce, proteins, packaging.

The product the manager logs into is called **Homebase**. The header reads "Lakehouse Market · Homebase" — that is the wordmark.

**Visual identity:** Lakehouse Market is the dominant brand; Databricks appears as a small "Powered by Databricks" lockup in the footer / about modal. The visual language uses the Databricks palette and DM Sans / DM Mono — i.e. the design is Databricks-tasteful even though the wordmark is the fictional QSR.

- **Logo**: custom "Lakehouse Market" wordmark (simple type lockup, lava-red accent) + small "Homebase" tag in the top-left. "Powered by Databricks" lockup with real Databricks lava-flame mark sits in the footer and the about modal only.
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
- Recharts for charts. Lucide for icons. **Leaflet + react-leaflet** for the trade-area map on the Loyalty tab (lifted from live-data-intelligence's `StoreMap` component, re-themed).
- Brand theme object pattern from labor-iq (`ui/src/lib/themes/lakehouse-market.ts`); ships a single theme but keeps the seam.

**Data**:
- **Unity Catalog** `jdub_demo.lakehouse_market` (per memory rule: default workspace catalog is `jdub_demo`). Read-only from the app.
- **Lakebase Postgres** instance `lakehouse-market-app-db` for app writes: labor overrides, accepted offers, generated POs, work-order acks. Schemas mirror the write tables only.
- **Synthetic-data notebook** (`notebooks/01_generate_data.py`) produces all UC tables using Polars + Mimesis per the `databricks-data-generation` skill. Idempotent; one-shot regenerate.

**Project layout** (mirrors labor-iq):

```
lakehouse-market-e2e-DAIS-demo/
  app.yaml                 # Databricks App start command
  databricks.yml           # DAB root
  pyproject.toml
  uv.lock
  resources/               # DAB resource yml: app, lakebase, genie, jobs
  notebooks/
    01_generate_data.py
    02_train_labor_model.py        # only ML training notebook (the served model)
    03_score_loyalty.py            # rule-based churn + CLV → churn_predictions
    04_score_equipment.py          # rule-based RUL → rul_predictions
    05_label_reviews.py            # FM batch sentiment + topic labels
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
        AppFooter.tsx      # "Powered by Databricks" lockup
        TabNav.tsx
        StoreSelector.tsx
        MetricCard.tsx
        KPIRing.tsx
        DataTable.tsx
        GenieBanner.tsx    # per-tab embedded Genie banner (lifted)
        GenieChat.tsx      # per-tab embedded Genie chat (lifted)
        StoreMap.tsx       # Leaflet trade-area map for Loyalty tab
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

Direct lift of the live-data-intelligence chrome, re-skinned and re-oriented around a single-store manager:

- **Sticky `AppHeader`** at top, z-50, glass-blur, shadow.
  - Left: "Lakehouse Market" wordmark with lava-red dot accent + thin divider + small "Homebase" tag.
  - Center: 5-tab nav with numbered badges:
    - `01 Labor` → `/labor`
    - `02 Loyalty` → `/loyalty`
    - `03 Supply Chain` → `/supply`
    - `04 Sentiment` → `/sentiment`
    - `05 Maintenance` → `/maintenance`
  - Right: **store selector dropdown** (the manager's store; defaults from localStorage; for demo, can switch). Greeting chip ("Good morning, [manager first name] — Store #042").
- **Hub landing page** (`/`): the manager's morning briefing. Top: a 5-app circular SVG diagram (live-data-intelligence pattern) with badge counts on each node (e.g. "3 to approve" on Labor, "2 reorders" on Supply, "5 new reviews" on Sentiment). Below: "Today at your store" — the 5-10 highest-priority items pulled across all five tabs as a unified action queue. Each item is a one-line card with the tab badge color and a direct-link button to act.
- **Per-page skeleton** (every tab follows the same shape):
  1. Page title row + the manager's store name pinned right.
  2. KPI strip (3-4 `MetricCard`s) for the manager's store, today + comparison.
  3. **Action surface** — the queue/grid/table of things to do today. Always primary above the fold.
  4. Secondary detail panel (chart, telemetry, or detail card).
  5. **Embedded Genie panel** (live-data-intelligence `GenieBanner` + `GenieChat` pattern) pinned to the right or bottom of the tab. Each tab seeds Genie with tab-scoped prompt chips ("Why did labor % spike last Friday?", "Which members at this store are most at risk?"). Always visible, not hidden in a drawer.
- **No global Ask AI drawer.** Per the live-data-intelligence pattern and the user's direction, Genie is **inline on every tab** with tab-specific context. The footer has a "Powered by Databricks · Lakebase + Genie + Model Serving" lockup so the platform story is always visible without competing with the operations content.

## 6. The five tabs

Every tab is scoped to **the manager's store**. Every tab has the same skeleton (KPI strip → action queue → secondary detail → embedded Genie panel with seeded prompts → at least one Lakebase write action).

### 6.1 Labor Optimization (`/labor`)

The manager arrives at 7am to lock today's schedule.

- **KPI strip**: today's forecasted revenue, recommended headcount, projected labor %, vs-last-week delta.
- **Day-part cards** (Breakfast / Lunch / Dinner / Late): forecast revenue, recommended crew by role (cashier / cook / runner), labor %, override input → recompute via `lhm-labor-recommender` serving endpoint.
- **Approvals queue**: pending day-parts to lock today + history of recent overrides at this store with delta crew, delta cost, manager note.
- **Embedded Genie panel** (right rail): prompt chips — "Why is lunch headcount higher than last Tuesday?", "What was my labor % last Friday vs forecast?", "How does my labor % compare to nearby stores?". Backed by the shared `lhm-ops-assistant` Genie space, scoped to the manager's store via a context blurb.
- **Write-back** (Lakebase `app_labor_overrides`): approved schedule per (store, date, day-part) with timestamp + manager id.
- **Reads**: `daily_sales_forecast`, `hourly_transactions`, `staff_roster`, `stores`.

### 6.2 Loyalty / Personalization (`/loyalty`)

The manager wants to know who to recognize, who to win back, and which counter prompts to push today.

- **KPI strip**: active members visiting this store (30d), 30-day spend at this store, at-risk members in this store's territory, top offer redemption %.
- **At-risk member queue**: members who shop this store, with churn risk score (precomputed in data-gen) + suggested next-best-offer + a "push to POS prompt" action that writes to `app_offer_pushes` so the POS prompts the cashier on their next visit.
- **Counter-prompt picker**: today's three suggested offers ranked by expected lift for this store's traffic mix; manager activates one per day-part.
- **Trade-area map** (Leaflet, re-themed `StoreMap` lifted from live-data-intelligence): centered on the manager's store with a 5-mile catchment ring. Plots member density as dots — **green** for active 30-day members, **gray** for lapsed, **lava** for at-risk-high-LTV. Answers "who lives near my store and is/isn't visiting" at a glance and gives the app the geospatial moment that the reference app has.
- **Offer impact mini-chart**: redemption rate vs. control for the manager's store over last 8 weeks.
- **Embedded Genie panel**: prompt chips — "Who hasn't visited in 30 days but spent $500+ last quarter?", "Which offer worked best at my store last month?", "Show me my top 10 loyalty members this week".
- **Write-back** (Lakebase `app_offer_pushes`): activated counter prompts + targeted member pushes.
- **Reads**: `loyalty_members`, `transactions`, `offers`, `member_segments`, `churn_predictions` (precomputed).

### 6.3 Supply Chain / Inventory (`/supply`)

The manager needs to release reorders before close and check what's arriving tomorrow.

- **KPI strip**: SKUs below reorder point at this store, projected stock-outs (next 7 days), open POs in flight, today's supplier on-time %.
- **Reorder action queue**: SKUs flagged by the demand model with one-click "Release PO" per row → writes to `app_purchase_orders`. Bulk approve at the top.
- **Inventory table**: SKU, on-hand, days-of-cover, reorder point, supplier, lead-time band, status chip — filterable.
- **Tomorrow's deliveries panel**: scheduled inbound POs with supplier reliability badge so the manager knows what to expect at the receiving door.
- **Embedded Genie panel**: prompt chips — "What am I likely to run out of this week?", "Which supplier has missed delivery windows recently?", "Show inbound POs for tomorrow".
- **Write-back** (Lakebase `app_purchase_orders`): manager-released POs with quantity, supplier, target delivery date.
- **Reads**: `inventory_snapshots`, `skus`, `suppliers`, `purchase_orders`, `demand_forecast`.

### 6.4 Sentiment Analysis of Reviews (`/sentiment`)

The manager wants to see new reviews of *their* store and respond.

- **KPI strip**: this store's 30-day review count, average rating, % negative, vs-last-month delta.
- **Inbox-style review queue**: new reviews for this store since last login, sorted by sentiment severity. Each row has the review snippet, source (Google / Yelp / app), sentiment chip, topic tags, and three actions: **Respond** (writes a manager response stub to `app_review_responses`), **Flag** (escalates to district), **Mark Resolved**.
- **Topic trend panel**: top three rising negative topics at this store this week with example excerpts and an LLM (`databricks-claude-sonnet-4-6`) one-paragraph summary of "what guests are saying about your store right now" — server-side, cached 1h.
- **Sentiment timeline**: stacked area of positive / neutral / negative for this store over 30 days.
- **Embedded Genie panel**: prompt chips — "What's the top complaint this week at my store?", "Which day-part gets the worst reviews?", "Compare my store's rating to nearby stores".
- **Write-back** (Lakebase `app_review_responses`): manager actions on reviews (response text, flag, resolve) with timestamp + manager id.
- **Reads**: `reviews`, `review_sentiment`, `review_topics`, `stores`.

### 6.5 Predictive Maintenance (`/maintenance`)

The manager wants to know what's likely to break this week and schedule a tech before it does.

- **KPI strip**: equipment online %, predicted failures at this store (next 7 days), open work orders, MTBF trend chip.
- **At-risk equipment queue**: units with high failure probability this week (precomputed RUL scores), sorted by predicted failure date. Each row: equipment name, category, health score ring, RUL in days, last-telemetry timestamp, "Schedule Tech" button → writes to `app_work_orders` with target date.
- **Telemetry detail panel**: pick a unit → sparkline triplet (temperature, vibration, runtime hours) over last 14 days + predicted failure date + recent maintenance history.
- **Work-order kanban**: open / in-progress / done columns for this store; drag to update status (writes to `app_work_orders`).
- **Embedded Genie panel**: prompt chips — "Which equipment is most likely to fail this week?", "What's the average time-to-repair for fryers?", "Show me work orders open more than 7 days".
- **Write-back** (Lakebase `app_work_orders`): manager-created work orders + status updates.
- **Reads**: `equipment`, `equipment_telemetry`, `rul_predictions` (precomputed), `work_orders`.

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

**Lakebase write tables** (separate schema in the Postgres instance) — every tab writes:
- `app_labor_overrides` — approved day-part schedules
- `app_offer_pushes` — activated counter prompts + targeted member pushes
- `app_purchase_orders` — manager-released POs
- `app_review_responses` — manager actions on reviews (respond / flag / resolve)
- `app_work_orders` — manager-created work orders + status updates

## 8. ML & AI integration

Per the decision in §11, only labor is a real served model. Other domain scores are precomputed in the data-gen / scoring notebook so the demo always renders fast and provisioning stays small. Genie is the AI surface that's prominent on every tab.

**Served models** (one custom endpoint, used live at runtime):
- **Labor recommender** — small linear/elasticnet regressor on day-part revenue → headcount + role mix. Served by Model Serving endpoint `lhm-labor-recommender`. Notebook `02_train_labor_model.py` trains it.

**Precomputed scores** (written into UC tables at generation time, app reads them as plain columns):
- **Churn probability + predicted CLV** per loyalty member → column on `churn_predictions` table. Scored by rule-based heuristic in `notebooks/03_score_loyalty.py` (recency / frequency / spend bands; a touch of noise to look ML-shaped).
- **Equipment RUL** per unit → column on `rul_predictions` table. Scored by a rule-based heuristic (runtime hours since last service, telemetry trend) in `notebooks/04_score_equipment.py`.
- **Review sentiment + topic labels** per review → columns on `review_sentiment` and `review_topics`. FM batch labels at generation time via `databricks-meta-llama-3-3-70b-instruct` in `notebooks/05_label_reviews.py`. App reads pre-labeled rows; no re-scoring at runtime.

**Runtime FM calls** (foundation models, no custom endpoints):
- **Sentiment tab "this week's summary"** card — one `databricks-claude-sonnet-4-6` call per tab visit, cached server-side 1 hour.

**Genie — one space, embedded on every tab.** Per the user's direction, the *visual treatment* matches live-data-intelligence (`GenieBanner` + `GenieChat` inline on each tab, not hidden in a drawer), but the backend is a single shared Genie space `lhm-ops-assistant` scoped over all UC tables. (Lakebase write tables are exposed to Genie via UC sync if region supports it, otherwise omitted from the Genie scope — write-backs are still visible in the app.)

| | |
|---|---|
| Genie space id | `lhm-ops-assistant` |
| UC tables in scope | `stores`, `daily_sales_forecast`, `hourly_transactions`, `staff_roster`, `loyalty_members`, `transactions`, `offers`, `member_segments`, `churn_predictions`, `inventory_snapshots`, `skus`, `suppliers`, `purchase_orders`, `demand_forecast`, `reviews`, `review_sentiment`, `review_topics`, `equipment`, `equipment_telemetry`, `rul_predictions`, `work_orders` |
| Per-tab UI seed | Each tab's `<GenieChat>` instance opens with a tab-specific intro line + tab-specific prompt chips (see §6.1–§6.5 for chip lists) + a hidden context blurb that prepends the current `store_id` and tab name so Genie scopes answers to the manager's store. |
| Curated example Qs | PATCHed into the space at deploy time, grouped by tab via question prefixes ("Labor: ...", "Loyalty: ...", etc.) so the Genie space's own example list stays organized. |

The app talks to the space via the Databricks Genie API (`POST /api/2.0/genie/spaces/{id}/conversations` and message follow-ups), wrapped in `routers/genie.py`. The frontend `GenieBanner` + `GenieChat` components are lifted from live-data-intelligence and re-themed; they accept a `tabId` prop that drives the seed line + chip list.

## 9. Deployment

Single Databricks Asset Bundle (DAB).

**`databricks.yml`** declares:
- Variables: `catalog` (default `jdub_demo`), `schema` (`lakehouse_market`), `app_name`, `lakebase_instance`, `genie_space_id` (single shared space), `labor_serving_endpoint`.
- Includes `resources/*.yml`: app, lakebase instance, **one** model serving endpoint (`lhm-labor-recommender`), Genie space PATCH for `lhm-ops-assistant`, and a data-gen job that runs the five notebooks in order.

**Default target**: workspace `fe-vm-jdub-vm-serverless` (per memory). One `databricks bundle deploy && databricks bundle run lhm_init_job` from a clean repo provisions everything.

**Local dev** mirrors labor-iq:
- `cd ui && npm run dev` (Vite on 5173, proxy `/api` → 8000)
- `uvicorn lakehouse_market.app:app --reload --port 8000` (with `DATABRICKS_HOST` + `DATABRICKS_WAREHOUSE_ID` env)
- Build → `cd ui && npm run build` writes to `src/lakehouse_market/static/`

## 10. Success criteria

The demo is "done" when:

1. `databricks bundle deploy && databricks bundle run lhm_init_job` produces a working app from a clean checkout in under 30 minutes.
2. All five tabs render with real synthetic data scoped to the manager's selected store, with at least one chart + one action queue per tab.
3. **Five write-back actions** work end-to-end (one per tab): labor override → `app_labor_overrides`; offer push → `app_offer_pushes`; PO release → `app_purchase_orders`; review response → `app_review_responses`; work order create → `app_work_orders`.
4. The embedded Genie panel on each tab answers at least one tab-specific seeded question with results scoped to the current store.
5. The Loyalty trade-area map renders with member density dots and is centered on the selected store.
6. Hub page shows the morning briefing (5-app circular diagram with live badge counts + "Today at your store" action queue).
7. Visual quality matches labor-iq's polish: DM Sans typography, consistent spacing, Databricks lava CTA color, no AI-generic boxiness. A T&H account exec or DAIS audience member can watch a 15-minute walkthrough without slide deck fallback.

## 11. Risks & open questions to revisit

- **Genie answer quality with 21 tables in one space**: the user explicitly chose a single space for simplicity, but if Genie struggles to pick the right table for tab-scoped questions, the fallback is to split into five smaller spaces (UI components already accept a `tabId` prop, so the change is localized to `routers/genie.py` mapping `tabId` → `spaceId`).
- **Serving endpoint cold start**: `lhm-labor-recommender` may be slow on a fresh workspace. Mitigation: keep the model tiny; warm it in `lhm_init_job` post-deploy with a synthetic prediction call.
- **FM cost for sentiment labeling at generation time**: 30k reviews × Llama 3.3 70B for labeling is manageable; reserve Sonnet 4.6 for the weekly digest UI call only.
- **Lakebase region availability**: only available in some regions. Verify `fe-vm-jdub-vm-serverless` supports Lakebase before deploy; if not, switch the target workspace or fall back to a UC managed table for app writes (loses the "writes to Postgres" demo line).
- **Map data realism**: synthetic member lat/long for the trade-area map need to cluster around plausible store catchments (not random across the country). Generation notebook must seed member coordinates as a 2D Gaussian around each member's preferred store.
