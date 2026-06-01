# Lakehouse Market · Homebase — 5-Minute Demo Script

**Length:** 5 min flat. Touches every tab's write-back, frames Genie as the unified chat across domains, lands business value for store operators.
**Pair with:** [`slides.md`](./slides.md).

---

## Before joining (2 min prep)

- [ ] Open <https://lakehouse-market-homebase-66306676349647.aws.databricksapps.com>, hard refresh (Cmd+Shift+R)
- [ ] Click `/today` so the warehouse warms up while you intro
- [ ] Open Genie panel once and ask any question to confirm it's reachable

---

## The 5-minute beat sheet

| Time | Tab | Click | What you say |
|---|---|---|---|
| **0:00-0:30** | `/today` | Land here. Point at the radial hub. | "One console, six things a store manager does at 7am. **Genie at the centre, modules around it** — ask, then act." |
| **0:30-1:15** | `/labor` | Bump one slot, hit **Recompute**, then **Lock day** → approve. | "ML rec from a Model Serving endpoint. Manager locks it — **writes to Lakebase**, short-lived OAuth from the SDK, lands in `lhm_app.app_labor_overrides` discoverable back in UC." |
| **1:15-1:45** | `/inventory` | Toggle one SKU off a PO card, **Release order**. | "Same pattern. **Lakebase write** to `app_purchase_orders` before the truck cut-off. Audit trail is automatic." |
| **1:45-2:15** | `/equipment` | Schedule service from the navy CoolerAlert hero. | "RUL model flagged this cooler. One click **writes a work order** to Lakebase. Zero swivel-chair to a CMMS." |
| **2:15-2:45** | `/members` | Pick a segment, **Send to all**. | "Win-back offer to N at-risk regulars. One `executemany` round-trip — **N rows into Lakebase** for the CRM team to pick up." |
| **2:45-3:15** | `/feedback` | Click a low-star review, accept the AI-drafted reply. | "LLM-drafted in the manager's voice. Approve and **Lakebase logs the response** for compliance." |
| **3:15-4:30** | open Genie slide-over from any tab | Ask three questions across domains: <br>1. *"Why is Friday lunch staffing higher than last week?"* <br>2. *"Show me coolers with RUL under 30 days"* <br>3. *"Negative-sentiment themes this week"* | "**One Genie space, all 21 UC tables.** Route context (`tab_id`, `store_id`) auto-injected. Labor question, equipment question, sentiment question — same chat, same governance, no SQL." |
| **4:30-5:00** | back to `/today` | Close on the radial hub. | "Four Databricks primitives — **UC, Lakebase, Genie, Model Serving** — one console. The manager replaces five tools with one login. Your data team gets every write back in UC, on the same governance plane. Pattern transfers to any operator-in-the-loop workflow." |

---

## Business value — drop one of these into the close

- **For the manager:** one login replaces five tools; every decision is auto-logged.
- **For ops leadership:** labor variance ↓, food waste ↓, equipment downtime ↓, churn save rate ↑.
- **For the data team:** all reads UC-governed, all writes Lakebase-governed, all AI on Databricks identity. Nothing bolted on.

---

## If something breaks live

| Symptom | Pivot |
|---|---|
| Page won't load | Warehouse cold — keep talking, it warms in 5-10s. |
| Genie echoes the prompt | Stale bundle. Skip Genie, demo a write instead. |
| Write 500s | `databricks apps restart lakehouse-market-homebase` after the demo. Pivot to slide 3 (architecture). |

If it's unrecoverable: switch to [`slides.md`](./slides.md) slides 3-5 and walk the architecture. Don't fix it live.
