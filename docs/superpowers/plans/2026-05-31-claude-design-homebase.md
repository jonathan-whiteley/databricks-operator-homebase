# Claude Design — Homebase redesign

**Branch:** `feature/claude-design-homebase`
**Design bundle:** `/tmp/claude_design/lakehouse-market-homebase-app/`
**Spec date:** 2026-05-31

> A user mocked the Homebase app in Claude Design as HTML/CSS/JS. This plan
> re-implements that design in our existing React + FastAPI + Lakebase repo.
> The backend stays put; the UI is rebuilt around a left sidebar shell and a
> "Today" Genie-first home.

## 1. Goal & scope

Lift the design from `lakehouse-market-homebase-app/project/Homebase.html` into the running app at `https://lakehouse-market-homebase-66306676349647.aws.databricksapps.com` without breaking the deployed backend.

**In scope (UI rebuild):**
- Whole-app layout: top-nav → **left sidebar** (236px, navy-900) + 56px white TopBar
- 6 views: `today / labor / inventory / equipment / members / feedback`
- Design token migration (CSS custom properties)
- New component primitives (`Btn`, `Pill`, `Card`, `AIRec`, `LakebaseTag`, etc.)
- "Genie panel" as a right slide-over (not the per-tab embedded chip panel we have today)
- Dark navy toast region (replaces our current `Toast.tsx`)

**Out of scope:**
- Backend changes beyond two small additions noted in §3
- ML models, Genie space, Lakebase schema, DAB resources — all stay as-is
- Removing routes: keep React Router so URLs are shareable; map views 1:1 to `/today`, `/labor`, `/inventory`, `/equipment`, `/members`, `/feedback`

## 2. Mapping: design module → existing app

| Design view | Existing page | Existing endpoints reused | Action language |
|---|---|---|---|
| **today** | `pages/HubPage.tsx` | `/api/labor/today`, `/api/loyalty/kpis`, `/api/supply/reorder-queue`, `/api/maintenance/at-risk`, `/api/sentiment/inbox` | none on this view |
| **labor** | `pages/LaborPage.tsx` | `/api/labor/today`, `/api/labor/recommend`, `/api/labor/override` | "Approve schedule", "Approve all" |
| **inventory** | `pages/SupplyPage.tsx` | `/api/supply/reorder-queue`, `/api/supply/tomorrow-deliveries`, `/api/supply/release-po` | "Release PO" |
| **equipment** | `pages/MaintenancePage.tsx` | `/api/maintenance/at-risk`, `/api/maintenance/telemetry`, `/api/maintenance/work-order` | "Schedule service" |
| **members** | `pages/LoyaltyPage.tsx` | `/api/loyalty/kpis`, `/api/loyalty/at-risk`, `/api/loyalty/map`, `/api/loyalty/offer-push` | "Send win-back" (bulk) |
| **feedback** | `pages/SentimentPage.tsx` | `/api/sentiment/inbox`, `/api/sentiment/digest`, `/api/sentiment/timeline`, `/api/sentiment/review-action` | "Reply", "Flag", "Resolve" |
| **Genie panel** | shared right rail | `/api/genie/ask` | n/a |

Routes change but the backend doesn't.

## 3. Data: what we need, what we have

Row counts confirmed against the live workspace:

| Table | Rows | Used by design view |
|---|---|---|
| `daily_sales_forecast` | 9,100 | today, labor |
| `staff_roster` | 548 | labor (NEW use) |
| `inventory_snapshots` | 140,000 | today, inventory |
| `equipment_telemetry` | 52,164 | equipment |
| `churn_predictions` | 50,000 | today, members |
| `reviews` | 30,000 | today, feedback |

**No new tables needed.** Two small additions:

1. **`/api/today/brief` (new endpoint)** — server-side aggregation that returns a single JSON payload the Today view needs in one round-trip: yesterday's actual revenue, today's forecast total, top open item per module (cooler trending warm, N timecards to approve, etc.), and a 5-element KPI strip (sales / forecast / labor% / guest rating / traffic). Backed by reads of existing tables. ~60 lines of SQL/Python.

2. **`/api/loyalty/win-back` (new endpoint)** — bulk version of the existing per-member offer push. Accepts `{store_id, segment, offer_id}` and inserts N rows into `app_offer_pushes` (one per matching member). The design's "Send win-back to 184 members" action calls this once and shows a single toast.

**Design reframings (no data change):**

- "Approve N timecards" → relabeled to **"Approve N day-part schedules"**. We don't have a `timecards` table and don't need one for the demo. The existing `app_labor_overrides` is the write target. The Today view shows count = unlocked day-parts for today.
- "Send win-back to N members" → uses `/api/loyalty/win-back` (new) instead of per-member buttons.
- "Schedule cooler service" → reuses `/api/maintenance/work-order` with `notes = "cooler service"`.

## 4. Design tokens → existing tokens

The design ships a complete token set in `colors_and_type.css`. Our current `ui/src/styles.css` uses a smaller subset under different names. Migration: extend the `@theme` block with **design's tokens as the source of truth**, keep our existing names as aliases for files we don't rewrite immediately.

Key palette additions:

| Design token | Hex | Replaces |
|---|---|---|
| `--db-navy-900` | `#0B2026` | matches existing `--color-navy` |
| `--db-navy-800` | `#1B3139` | new — sidebar header & dark fills |
| `--db-navy-700` | `#143D4A` | new — sidebar hover |
| `--db-navy-300/400/500/600` | grays | new — borders, secondary text |
| `--db-lava-600` | `#FF3621` | matches existing `--color-lava` |
| `--db-lava-700` | `#BD2B26` | new — primary button hover |
| `--db-lava-300/400/500` | softer reds | new — chip backgrounds, dots |
| `--db-oat-light` | `#F9F7F4` | nearly matches existing cream |
| `--db-oat-medium` | `#EEEDE9` | new — subtle surfaces |
| `--db-gray-lines` | `#DCE0E2` | replaces `--color-hairline` |
| `--db-gray-text` | `#5A6F77` | replaces `--color-ink-soft` |
| green/blue/yellow/maroon scales (5 stops each) | — | new — for KPI accents and Pill levels |
| `--shadow-xs/sm/md/lg/xl` | — | replaces existing shadow tokens |
| `--ease-out`, `--dur-fast/base/slow` | motion | new — used by hover transitions |

Type ramp adds `--fs-display-xl/lg/md` (96 / 72 / 56px) for big numbers on Today.

## 5. Component primitives to lift

These are the bricks of the design system. Each becomes a TypeScript component under `ui/src/components/db/`:

| Component | Design lines | What it does |
|---|---|---|
| `Btn` | shell.jsx:94-112 | 5 variants (`primary` / `dark` / `ghost` / `subtle` / `quiet`) × 3 sizes, optional left/right icons |
| `Pill` | shell.jsx:114-122 | 5 levels (danger/warn/info/ok/neutral) with optional left dot |
| `Card` | shell.jsx:124-129 | white surface, 12px radius, optional hover lift |
| `Delta` | shell.jsx:131-135 | up/down arrow + green/lava text |
| `Eyebrow` | shell.jsx:137-139 | uppercase tracked-out small label |
| `PageHead` | shell.jsx:141-152 | icon + h1 + subtitle + actions slot |
| `AIRec` | shell.jsx:155-170 | "Genie says…" inline recommendation card (navy or oat variant) |
| `LakebaseTag` | shell.jsx:173-177 | "written to lakebase.TABLE" mono caption — drop on every write surface |
| `Logo` | shell.jsx:180-187 | lava square with white icon + "Lakehouse Market" wordmark |
| `Spark` | shell.jsx:67-79 | tiny inline sparkline (we already have `Sparkline.tsx` — can keep or replace) |
| `Sidebar` | shell.jsx:199-244 | 236px navy-900 vertical nav with badge counts |
| `TopBar` | shell.jsx:247-265 | 56px white bar with store breadcrumb + Ask Genie + bell |
| `ToastRegion` | shell.jsx:268-279 | bottom-right dark navy toasts (4s auto-dismiss) — replaces current `Toast.tsx` |

Naming: keep them in a `db/` subfolder so existing components (`MetricCard`, `DayPartCard`, etc.) can co-exist while we migrate page-by-page.

## 6. Page-by-page: what each view becomes

### 6.1 today (`pages/TodayView.tsx`, replaces `HubPage`)
- 5-card KPI strip (sales / forecast / labor% / guest rating / traffic) with `Spark` inline
- Genie hero card (navy-900 background, lava accent, decorative sparkle SVG): greeting + yesterday's number + today's forecast + first action chip + "Ask anything…" bar
- "Jump into a module" rail: 5 module cards with icon + name + signal ("184 members lapsing", "Cooler #2 trending warm")
- Clicking a module card or chip routes to that view

### 6.2 labor (`pages/LaborView.tsx`)
- Top: `PageHead` "Labor" + `AIRec` ("Lunch crew looks light vs forecast — bump runner +1")
- Day-part cards (existing DayPartCard re-skinned with new tokens)
- Approvals queue card with `LakebaseTag table="app_labor_overrides"`
- "Approve all" + "Approve schedule" buttons trigger the `ConfirmDialog` we built last round

### 6.3 inventory (`pages/InventoryView.tsx`)
- `PageHead` + `AIRec` ("3 SKUs likely to stock out before Tuesday")
- Reorder queue table with per-row "Release PO" — opens existing `ConfirmDialog`
- Tomorrow's deliveries panel
- Each write surface shows `LakebaseTag table="app_purchase_orders"`

### 6.4 equipment (`pages/EquipmentView.tsx`)
- `PageHead` + `AIRec` ("Cooler #2 drifting warm — book service before weekend")
- Equipment list with health ring + RUL
- "Schedule service" CTA → `ConfirmDialog` → `app_work_orders`
- Telemetry sparklines for selected unit

### 6.5 members (`pages/MembersView.tsx`)
- `PageHead` + `AIRec` ("184 high-value members haven't returned in 30 days")
- StoreMap with member density (existing)
- 3-offer counter-prompt picker (existing)
- **NEW**: "Send win-back campaign" CTA at top — single button that calls `/api/loyalty/win-back` and writes 184 rows to `app_offer_pushes` in one go

### 6.6 feedback (`pages/FeedbackView.tsx`)
- `PageHead` + `AIRec` (this week's digest summary)
- Sentiment timeline area chart (existing)
- Inbox-style review queue with Reply / Flag / Resolve buttons (existing `ConfirmDialog`)
- `LakebaseTag table="app_review_responses"` on the inbox

### 6.7 Genie panel (slide-over)
- Right-side slide-over (440px wide), navy-900 background
- Triggered by "Ask Genie" button in TopBar + chips in any `AIRec` block
- Existing `/api/genie/ask` backend powers it
- Conversation history, prompt suggestions per current view, "Ask anything" composer at the bottom

## 7. Implementation phases

Each phase is one commit. Tests must pass after every phase (`uv run pytest tests/ -q`, `cd ui && npm run build`).

| Phase | What | Files touched |
|---|---|---|
| **1. Tokens + fonts** | Copy `colors_and_type.css` content into `ui/src/styles.css` `@theme` block; bundle the 4 DM Sans + 4 DM Mono `.ttf` files under `ui/public/fonts/` (we currently load from Google Fonts) | `styles.css`, `index.html` |
| **2. Primitives library** | Build `ui/src/components/db/*.tsx`: `Btn`, `Pill`, `Card`, `Delta`, `Eyebrow`, `PageHead`, `AIRec`, `LakebaseTag`, `Icon` (port the path map), `Spark` | new files |
| **3. Shell** | Rebuild `App.tsx` with `Sidebar` + `TopBar` + outlet, drop top-nav AppHeader; new `ToastRegion` replacing `Toast.tsx` (keep same `useToast()` API) | `App.tsx`, new `Sidebar.tsx`, `TopBar.tsx`, `ToastRegion.tsx` |
| **4. Routing rename** | Routes become `/today`, `/labor`, `/inventory`, `/equipment`, `/members`, `/feedback`; redirect `/` → `/today`, keep old paths as 301-equivalents | `App.tsx` |
| **5. Today view** | Build new `TodayView.tsx`; add `/api/today/brief` backend aggregator; wire KPI strip + Genie hero + module rail | new view, new router |
| **6. Labor view** | Re-skin `LaborPage` → `LaborView` using new primitives; keep `DayPartCard` logic, swap tokens | `LaborView.tsx`, edits to `DayPartCard.tsx` |
| **7. Inventory view** | Re-skin `SupplyPage` → `InventoryView`; keep existing reorder/delivery queries | `InventoryView.tsx` |
| **8. Equipment view** | Re-skin `MaintenancePage` → `EquipmentView`; keep telemetry + RUL | `EquipmentView.tsx` |
| **9. Members view** | Re-skin `LoyaltyPage` → `MembersView` with bulk Send Win-back; add `POST /api/loyalty/win-back` | `MembersView.tsx`, new router endpoint |
| **10. Feedback view** | Re-skin `SentimentPage` → `FeedbackView`; keep inbox + digest + timeline | `FeedbackView.tsx` |
| **11. Genie slide-over** | Replace per-tab inline Genie panels with a single right slide-over fed by `/api/genie/ask`; keep tab-scoped prompt seeds | `GeniePanel.tsx`, edits to all views |
| **12. Cleanup** | Delete old `AppHeader.tsx`, `AppFooter.tsx`, `HubPage.tsx`, `HubDiagram.tsx`, `HubActionQueue.tsx`, `GreetingChip.tsx`, old `Toast.tsx`, old `MetricCard.tsx`, etc. once their replacements are wired everywhere | delete |

Phases 5–10 can happen in parallel if dispatched as subagents, since each view is independent after Phase 3 lands.

## 8. Risks & open questions

- **Layout flip is irreversible visual change.** The current top-nav users will see a left sidebar instead. Acceptable for a demo; if a stakeholder is mid-walkthrough on the current branch, ship from a separate App URL or rev the existing app under a flag.
- **Fonts**: the design bundles `.ttf` files under `project/fonts/`. Loading from local `ui/public/fonts/` is more reliable than Google Fonts (avoids a CSS `@import` race that bit us earlier). Copy them in.
- **Per-tab Genie → single slide-over**: regressing the user's earlier request that Genie be embedded on every tab. The design's pattern is a single slide-over; the user's prior preference favored per-tab. Confirm before Phase 11 lands.
- **"Approve N timecards"** — confirm relabel to "Approve N day-part schedules" is acceptable. Alternative: generate a synthetic `timecards` table (one row per employee per shift per day) and add a corresponding write endpoint. Probably overkill for the demo.
- **Tweaks panel** (`tweaks-panel.jsx` in the design): the design ships a runtime customizer (accent color, AI brief verbosity, KPI strip on/off, manager name). Out of scope unless explicitly requested.

## 9. Success criteria

1. Visiting any route renders the new shell (sidebar + top bar + Genie slide-over) without console errors.
2. Every existing write surface (Lock/Release PO/Push offer/Schedule tech/Reply review) still writes to the same Lakebase table and shows a dark navy toast with `LakebaseTag` attribution.
3. `/today` shows the KPI strip + Genie hero + module rail with live numbers from existing endpoints + new `/api/today/brief`.
4. `cd ui && npm run build` succeeds and `uv run pytest tests/ -q` shows 27+ passing (new endpoint adds ≥1 test).
5. The deployed app at the existing URL is visually a match for `lakehouse-market-homebase-app/project/Homebase.html` opened locally — modulo browser rendering of the DM Sans / DM Mono fonts.

## 10. Reference files

- `lakehouse-market-homebase-app/README.md` — Claude Design's handoff note
- `lakehouse-market-homebase-app/project/Homebase.html` — entry point, mounts `<App />`
- `lakehouse-market-homebase-app/project/colors_and_type.css` — token + type system
- `lakehouse-market-homebase-app/project/app/shell.jsx` — primitives, sidebar, top bar, toasts
- `lakehouse-market-homebase-app/project/app/home.jsx` — Today view
- `lakehouse-market-homebase-app/project/app/{labor,inventory,equipment,members,feedback}.jsx` — per-view templates
- `lakehouse-market-homebase-app/project/app/data.jsx` — design's mock data (use only as a shape reference; we read real data)
- `lakehouse-market-homebase-app/project/app/genie.jsx` — Genie slide-over template
- `lakehouse-market-homebase-app/chats/chat1.md` — full design conversation (read for intent if any ambiguity)
