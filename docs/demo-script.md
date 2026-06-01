# Lakehouse Market · Homebase — Demo Script

**Audience:** Customer ops, store-ops platform team, or any persona that runs distributed locations (QSR, retail, hospitality, branches).
**Length:** 12-15 minutes hands-on, 5 min Q&A.
**Pair with:** [`slides.md`](./slides.md) (6 slides max for framing).

---

## 0. Before the demo (do this 5 min before joining the call)

- [ ] Open the deployed app: <https://lakehouse-market-homebase-66306676349647.aws.databricksapps.com>
- [ ] Hard refresh once (**Cmd+Shift+R**) to bust any cached bundles
- [ ] Click into `/today` so the warehouse spins up while you talk through slides
- [ ] Open the Genie panel once and ask any question — confirms the space is reachable
- [ ] Confirm Lakebase is live by clicking **Lock** on `/labor` (then undo via `databricks sql` if you want a clean slate)
- [ ] Have these tabs ready in case anyone asks:
  - Databricks workspace → **App page** (`lakehouse-market-homebase`)
  - Workspace → **Catalog Explorer** → `jdub_demo.lakehouse_market` (show the 21 UC tables)
  - Workspace → **Genie** → `lhm-ops-assistant` space (show the spec)
  - Workspace → **Lakebase** → `lakehouse-market-app-db` (show `lhm_app.app_*` tables)

**If the warehouse went cold:** first KPI load can take 5-10s. Don't panic. Mention auto-stop and keep talking.

---

## 1. Set the scene (1 min)

> "This is **Lakehouse Market · Homebase** — what your store manager's console looks like when you build it on the lakehouse instead of stitching five point tools together. The user is a single-store QSR GM logging in at 7am. They've got six things to do before the lunch rush, and they all need to happen against the same data the analytics team already trusts in Unity Catalog."

**Show the title slide. Don't dwell.**

---

## 2. Today view — the radial Genie hub (1 min)

**Where:** `/today`

**Do:**
- Land on the page. Hero card surfaces the manager's brief for the day.
- Point at the radial layout: **Genie sits at the centre, the 5 modules orbit it**.
- Each module node carries a count badge if there are outstanding items.

**Say:**
> "Notice the layout — Genie isn't a feature buried in a sidebar. It's the centre of the console, with the work that needs doing arranged around it. The manager's mental model is: 'ask Genie, then act.'"

> "Hover the module nodes — the ring colour signals urgency. Green means nothing waiting. Lava-red means *go here next*."

---

## 3. Labor — the AI recommendation + Lakebase write-back (3 min)

**Where:** `/labor`

**Do:**
1. Walk through one day-part card: forecast → recommended FTEs → manager override field.
2. Bump one slot by +0.5, hit **Recompute** — costs/coverage update inline.
3. Hit **Lock day**. Confirm dialog opens, summarising what's about to write.
4. Approve. Toast in the bottom-right confirms.

**Say (during the click path):**
> "The recommended staffing comes from `lhm-labor-recommender` — a Model Serving endpoint we deployed alongside the app, fed by the daily forecast table in UC."

> "When the manager hits Lock, **two things matter to the data team**: First, we're writing to **Lakebase**, not some external Postgres they have to operate. The connection mints a short-lived OAuth token from the SDK — no static credentials in `app.yaml`. Second, the override lands in `lhm_app.app_labor_overrides`, which is **discoverable from UC** for downstream analytics. The audit trail is automatic."

**Backstop:** if the write fails, point at the app logs page. Recovery: `databricks apps restart lakehouse-market-homebase`.

---

## 4. Genie — natural-language ops Q&A (3 min)

**Where:** stay on `/labor`. Open the Genie slide-over from the top-bar button.

**Ask three questions in this order:**

1. *"Why is Friday lunch staffing higher than last Friday?"*
   - Genie returns a per-hour delta with a 5-row preview from `hourly_transactions` + `daily_sales_forecast`.

2. *"Show me coolers with RUL under 30 days"*
   - Cross-domain — Genie pulls from `equipment_telemetry` + `rul_predictions`. Demonstrates the unified space.

3. *"Negative-sentiment themes this week"*
   - Pulls from `review_topics` + `review_sentiment`. Shows the LLM-labelled data is queryable.

**Say:**
> "Three things to clock here: First, **route context** — the frontend auto-injects `tab_id` and `store_id` with every Genie call. The manager doesn't have to disambiguate 'this store, this week.'"

> "Second, **one space covers all 21 UC tables**. We didn't have to build one Genie space per module — the instructions and example SQL in `notebooks/06_ensure_genie_space.py` keep it focused."

> "Third, **it's idempotent**. That notebook will create the space on first run and PATCH it on subsequent runs. Version-controlled, deployable, no manual UI clicking."

---

## 5. One more write-back — your highest-impact module (2 min)

Pick **one** of these depending on audience:

### Inventory (best for retail / QSR ops)
**Where:** `/inventory`
- Show a per-vendor PO card. Toggle one SKU off, hit **Release order**.
- Confirm dialog → approve → toast.
- Call out: writes to `lhm_app.app_purchase_orders` with the eligible items, vendor cut-off, manager note.

### Loyalty (best for marketing / CRM-adjacent audiences)
**Where:** `/members`
- Show the at-risk grid + trade-area map.
- Compose a guided win-back: select segment, pick offer, hit **Send to all**.
- Call out: one round-trip via asyncpg `executemany` — inserts N rows for N members.

### Equipment (best for manufacturing / facilities / hospitality)
**Where:** `/equipment`
- Land on the navy CoolerAlert hero (`RUL < 14 days`).
- Schedule service from the at-risk grid → confirm → toast.
- Call out: work order lands in `lhm_app.app_work_orders` with the unit, vendor, ETA, manager note.

**Say (whichever you pick):**
> "Same pattern as Labor: confirm dialog → POST to FastAPI → Lakebase insert. **The point isn't that we can write to a database — anyone can. The point is that the write goes to a Postgres instance the App SP owns, on the same governance plane as the read data, with the same Databricks identity for audit.**"

---

## 6. Close (1 min)

**Show slide 6 ("Why this lands for store ops").**

> "Nothing here is bolted on. UC for governed reads. Lakebase for governed writes. Genie for natural-language Q&A. Model Serving for the labor recommendation. Apps for hosting. Four primitives, one console, deployable from a single `databricks bundle deploy`."

> "The pattern transfers anywhere you have an operator in the loop and data they need to act on: branch banker, hotel front desk, plant floor supervisor, claims adjuster. The shape of Homebase stays the same — the modules change."

**Ask:**
> "Which of your operational workflows looks closest to this? Let's sketch the modules together."

---

## 7. Q&A — likely questions & one-liner answers

| Question | Answer |
|---|---|
| "Why Lakebase over RDS / Cloud SQL?" | Same governance plane as UC. Short-lived OAuth from the SDK. Tables surface back in UC. No separate ops burden. |
| "How do you handle multi-store?" | The current build is single-store; `store_id` is in every query. Multi-store is a sidebar dropdown + grant change — same schema scales. |
| "Where does the ML model live?" | UC-registered model, served by Model Serving as `lhm-labor-recommender`. Endpoint URL injected via `LABOR_ENDPOINT` env. |
| "Can the manager *create* Genie space content?" | Today it's curated in `notebooks/06_ensure_genie_space.py` (instructions + example SQLs). Users can ask anything; the space steers the SQL. |
| "What about access control per manager?" | App SP today; OBO-ready for per-user. UC grants cascade to writes (`lhm_app` schema is SP-owned, writes carry the SP identity). |
| "How long to stand up for our brand?" | `make setup` is ~12-15 min on a fresh workspace. Real customisation (your tables, your modules) is a 1-2 sprint engagement. |
| "What if the warehouse is cold?" | Auto-stop bumped to 120 min by `setup.sh`. First call after a long idle pays 5-10s. Subsequent calls are cached for 10 min in `sql_utils`. |
| "Can we use Claude / a different FM?" | `FM_ENDPOINT` env. Default is `databricks-claude-sonnet-4-6` for the digest. Any FM endpoint on the workspace works. |

---

## 8. Recovery — if something breaks live

| Symptom | What to do |
|---|---|
| Page won't load | `databricks apps logs lakehouse-market-homebase --follow` in a side terminal. 90% of the time it's the warehouse being cold. |
| Genie returns the prompt echoed | Stale build. `make build && databricks bundle deploy && databricks bundle run homebase`. Hard refresh. |
| Write fails with `permission denied` | The app restarted before the migration finished. `databricks apps restart lakehouse-market-homebase`, wait 30s. |
| Toast doesn't appear | Pop the inspector — check the network tab for the `/api/<router>/<action>` response. If 200, it's a CSS bug; if not, it's Lakebase. |
| Logo / sidebar looks wrong | Browser cached old JS. Hard refresh (Cmd+Shift+R). |

If something is irrecoverable mid-demo: **pivot to slides 3-5 and walk through the architecture**. Don't try to fix it live.

---

## 9. After the demo

- Capture which module resonated and which questions came up — these inform the follow-up note.
- File any new gotchas in [`docs/learnings.md`](./learnings.md).
- If they want a copy, point them at the public GitHub branch (`feature/claude-design-homebase`) and the deployed app URL above.
