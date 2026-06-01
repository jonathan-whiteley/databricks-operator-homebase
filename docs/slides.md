# Lakehouse Market · Homebase — reference slide deck

> 6-slide outline (incl. title). Marp-compatible (`---` separators). Drop into
> Google Slides via the [fe-google-tools markdown_to_gdocs flow](../README.md)
> or render in Marp. Highlights **Genie** and **Lakebase** with the manager
> persona front and centre.

---

<!-- Slide 1 — Title -->

# Lakehouse Market · Homebase

### One Databricks App. Six modules. One store manager's morning.

**Built on:** Unity Catalog · Lakebase · Genie · Model Serving · Databricks Apps

*Data + AI Summit demo — Field Engineering*

---

<!-- Slide 2 — The manager's morning (business value) -->

## The store manager's 7am console

A single-store QSR manager logs in once and does the whole opening:

- 🕖 **Lock the day-part schedule** before the morning rush
- 📦 **Release reorders** before the truck cut-off
- ❄️ **Schedule a tech** before the walk-in cooler dies
- 💬 **Reply to overnight reviews** in their own voice
- 🎁 **Push a counter offer** to recover at-risk regulars

**Why it matters:** today this is 5 separate tools, 5 logins, and a spreadsheet. Homebase replaces all of them with one operational console fed by the lakehouse the analytics team already trusts.

**Hard ROI levers:** labor variance ↓, food waste ↓, equipment downtime ↓, churn save rate ↑.

---

<!-- Slide 3 — Architecture at a glance -->

## One lakehouse, one app, three Databricks primitives

```
              React + FastAPI on Databricks Apps
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   Unity Catalog      Lakebase          Genie + Model
   (21 tables —       Postgres          Serving + FM
   reads via SQL      (write-back —     (NL Q&A +
   warehouse)         5 app tables)     labor + LLM)
```

- **UC** — single governed copy of demand, members, SKUs, equipment, reviews.
- **Lakebase** — operational writes (overrides, POs, work orders, offers, replies). Auto-discoverable from UC.
- **Genie** — one shared space, route-aware, scoped over all 21 UC tables.
- **Model Serving** — `lhm-labor-recommender` (ElasticNet) + Claude Sonnet for digest.

**The point:** every capability is a native Databricks resource. Nothing bolted on.

---

<!-- Slide 4 — Genie -->

## Genie · the manager's ops analyst on call

**Embedded as a right slide-over on every screen.** The current route auto-injects context (`tab_id` + `store_id`) so questions stay scoped.

| On this screen… | A manager can ask Genie… |
|---|---|
| Labor | *"Why is lunch staffing higher than last Friday?"* |
| Inventory | *"Which SKUs spiked last week vs. the 4-week mean?"* |
| Equipment | *"Show me coolers with RUL under 30 days"* |
| Loyalty | *"Top 10 at-risk Gold members by lifetime value"* |
| Feedback | *"Negative-sentiment themes from this week's reviews"* |

**Why this lands with operators:**
- No SQL, no BI ticket, no waiting on the analytics team.
- Same data as the dashboards: governed by UC, audited centrally.
- Space is **idempotent** — version-controlled in `notebooks/06_ensure_genie_space.py`. Easy hand-off.

---

<!-- Slide 5 — Lakebase -->

## Lakebase · operational write-back, native to the lakehouse

Every approve / lock / release / send button writes to **Lakebase Postgres** instance `lakehouse-market-app-db`, schema `lhm_app`.

**What gets written:**

| Module | Table | Action |
|---|---|---|
| Labor | `app_labor_overrides` | Manager-approved schedule |
| Inventory | `app_purchase_orders` | Released POs |
| Equipment | `app_work_orders` | Scheduled service |
| Loyalty | `app_offer_pushes` | Win-back offers (executemany) |
| Feedback | `app_review_responses` | Posted replies |

**Why Lakebase beats "bring your own Postgres":**
- **Short-lived OAuth tokens** minted by the SDK (`w.database.generate_database_credential`); no static passwords in `app.yaml`.
- **Reverse ETL is free** — Lakebase tables surface back in UC for downstream analytics.
- **Zero infra** — the App SP owns the instance; managed updates and backups handled.
- **Same governance plane** as the rest of the platform (UC catalogs, audit logs).

---

<!-- Slide 6 — Why this matters -->

## Why this lands for store ops

**For the manager:**
- One login, one console, one source of truth — replaces 5 tools and a spreadsheet.
- Decisions get logged automatically (Lakebase write-back) — no separate audit step.
- Genie is *their* analyst, not a ticket queue.

**For the customer's data team:**
- All built with **native Databricks resources** — no custom services, no extra hosting.
- Same UC governance for reads, writes, and AI.
- Deployable from a single `databricks bundle deploy`; idempotent setup script.
- Pattern transfers to **any operator-in-the-loop workflow**: hotel front desk, branch banker, plant supervisor, claims adjuster.

> "If your manager can use a dashboard today, they can use Homebase tomorrow — and start writing back to the lakehouse the same morning."

**Live demo:** [`lakehouse-market-homebase`](https://lakehouse-market-homebase-66306676349647.aws.databricksapps.com)

---

## Speaker notes

- Hard cap: 6 slides + title — do not add more for the standard demo block.
- If you only have 3 slides: keep **Title, Architecture, Why it matters**. Demo the app live for Genie + Lakebase instead.
- Pair this deck with [`demo-script.md`](./demo-script.md) — the deck is the framing, the script is the click path.
