# Generic, DAB-Native, Lightweight Homebase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `lakehouse-market-e2e-DAIS-demo` a generic, widely-reusable QSR demo that any SA deploys to their own workspace by editing only `databricks.yml`, with a short reliable bootstrap and no Model Serving dependency.

**Architecture:** Drop the Model Serving endpoint (compute labor headcount in-process from the trained model's coefficients); keep Lakebase + Genie with graceful degradation; move all app env to the DAB App resource's `config.env` (single source of truth) so `app.yaml` carries only the start command; self-wire the Genie space id through a UC `app_config` table; replace the 10-stage `setup.sh` with a 4-step `bootstrap.sh`.

**Tech Stack:** Databricks Asset Bundles (CLI v0.299), FastAPI + uvicorn (Python 3.11, `uv`), React 19 + Vite (UI), Lakebase (asyncpg), Databricks SQL warehouse, MLflow/UC (labor model training only), Databricks Genie API, pytest.

## Global Constraints

- **No em dashes or en dashes** in any prose/comments/docs. Use colons, semicolons, commas, parentheses. Hyphens only for ranges.
- **Catalog default:** `main`. **Schema default:** `lakehouse_market`. Defined once in `databricks.yml` variables; every other reference derives from it.
- **Single source of truth:** app environment is defined only in `resources/app.yml` `config.env` (values sourced from `${var.*}`). `app.yaml` contains no environment-specific content. `config.py` env defaults exist solely as a local-dev fallback and MUST match the DAB var defaults.
- **Zero personal/workspace leakage** in shipping files (`app.yaml`, `databricks.yml`, `pyproject.toml`, `resources/**`, `src/**`, `ui/src/**`): no `jonathan`, `jdub`, `whiteley`, `66306676349647`, `fe-vm`, `dev_jonathan_whiteley_*`. (The `dais` target's event-workspace host/email is an allowed documented example.)
- **Graceful degradation:** the app MUST boot and serve read tabs even when Lakebase, Genie, or the labor coefficients table are absent. Write/Genie/recommend surfaces return friendly responses, never 500, when their backing resource is missing.
- **CLI verified fact:** the DAB App resource supports inline `config.env` (`resources.AppConfig.env`, list of `{name, value, value_from}`), and `value` resolves `${var.*}`. Confirmed against `databricks bundle schema` on v0.299.
- **Grants stay in the bootstrap**, NOT declarative: the schema and tables do not exist until the init job runs, and the App SP does not exist until the app deploys, so `uc_securable` grants would fail on first deploy.
- **TDD** for Python logic; frequent commits; DRY; YAGNI.

---

## File Structure

**Delete:**
- `notebooks/standalone-labor/` (entire directory: separate mini-demo)
- `src/lakehouse_market/serving.py` (Model Serving wrapper)
- `resources/serving.yml` (Model Serving endpoint resource)
- `scripts/setup.sh` (replaced by `scripts/bootstrap.sh`)

**Create:**
- `scripts/bootstrap.sh` (slim 4-step deploy)
- `src/lakehouse_market/app_config.py` (UC `app_config` table reader: resolves Genie space id at runtime)
- `docs/architecture.md` (deep how-writes / how-Genie / troubleshooting moved out of README)
- `tests/test_labor_compute.py` (in-process headcount)
- `tests/test_app_config.py` (Genie space id resolution + fallback)

**Modify:**
- `src/lakehouse_market/routers/labor.py` (in-process `/recommend`, drop `invoke_serving`)
- `src/lakehouse_market/config.py` (drop `labor_endpoint`; standardize defaults; add nothing for Genie beyond env)
- `src/lakehouse_market/genie.py` (resolve space id lazily via `app_config`; degrade when unset)
- `src/lakehouse_market/routers/genie.py` (return friendly message when no space id)
- `notebooks/02_train_labor_model.py` (write `labor_model_coefficients` table; standardize schema default)
- `notebooks/06_ensure_genie_space.py` (write space id to `app_config`; grant App SP `CAN_RUN`; standardize defaults)
- `notebooks/01,03,04,05` (standardize schema default `tth_ops_homebase` → `lakehouse_market` where hardcoded as fallback)
- `resources/app.yml` (add `config.env` block; keep warehouse + database bindings)
- `app.yaml` (delete `env:`, keep `command:`)
- `databricks.yml` (var table per spec §6.2; neutral `user_email`; comment cleanup; align `dais` schema)
- `pyproject.toml` (generic author)
- `.env.example` (generic defaults; drop serving-endpoint section)
- `ui/src/pages/ArchitectureView.tsx` (neutral catalog/schema label)
- `tests/test_labor_router.py` (drop `invoke_serving` mock; call in-process compute)
- `README.md` (punchy rewrite)

---

## Task 1: Delete the standalone-labor mini-demo

**Files:**
- Delete: `notebooks/standalone-labor/` (entire directory)

- [ ] **Step 1: Confirm what's being removed**

Run: `ls -la notebooks/standalone-labor/`
Expected: lists `README.md`, `ensure_labor_genie_space.py`, `load_labor_tables.py` (a self-contained mini-demo, not imported anywhere).

- [ ] **Step 2: Verify nothing else references it**

Run: `git grep -n "standalone-labor" -- . ':!docs/superpowers'`
Expected: no hits outside docs. If any shipping file references it, stop and report.

- [ ] **Step 3: Delete the directory**

Run: `git rm -r notebooks/standalone-labor/`
Expected: files staged for deletion.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove standalone-labor mini-demo (dead weight)"
```

---

## Task 2: Compute labor headcount in-process (drop Model Serving)

Replace the Model Serving call in `/api/labor/recommend` with an in-process computation that reads coefficients from a UC table (written by notebook 02 in Task 3), falling back to the known synthetic heuristic when the table is absent.

**Files:**
- Modify: `src/lakehouse_market/routers/labor.py`
- Delete: `src/lakehouse_market/serving.py`
- Test: `tests/test_labor_compute.py` (create), `tests/test_labor_router.py` (modify)

**Interfaces:**
- Consumes: `sql_utils.fetch_all(sql, params) -> list[dict]` (existing).
- Produces:
  - `labor.compute_headcount(forecast_revenue: float, daypart: str) -> int` — pure function used by the route.
  - `labor._load_coefficients() -> dict[str, tuple[float, float]]` — maps `daypart -> (base, per_dollar)`, cached; empty dict when the table is absent.
  - Route `POST /api/labor/recommend` unchanged contract: body `{forecast_revenue: float, daypart: str}` → `{headcount: int}`.
  - UC table read: `SELECT daypart, base, per_dollar FROM labor_model_coefficients` in the app's catalog/schema.

- [ ] **Step 1: Write the failing test**

Create `tests/test_labor_compute.py`:

```python
# tests/test_labor_compute.py
from fastapi.testclient import TestClient

from lakehouse_market.app import app
from lakehouse_market.routers import labor as labor_mod


def test_compute_headcount_uses_coefficients(monkeypatch):
    # base + per_dollar * revenue, rounded. Lunch: base 3, per_dollar 1/350.
    monkeypatch.setattr(
        labor_mod, "_load_coefficients",
        lambda: {"Lunch": (3.0, 1.0 / 350.0)},
    )
    # 3 + 3500/350 = 3 + 10 = 13
    assert labor_mod.compute_headcount(3500.0, "Lunch") == 13


def test_compute_headcount_falls_back_when_no_table(monkeypatch):
    # No coefficients table -> heuristic: round(revenue/350 + daypart_offset)
    monkeypatch.setattr(labor_mod, "_load_coefficients", lambda: {})
    # Dinner offset = 2; 2800/350 = 8; total 10
    assert labor_mod.compute_headcount(2800.0, "Dinner") == 10


def test_recommend_route_returns_headcount(monkeypatch):
    monkeypatch.setattr(labor_mod, "_load_coefficients", lambda: {})
    r = TestClient(app).post(
        "/api/labor/recommend",
        json={"forecast_revenue": 3500, "daypart": "Lunch"},
    )
    assert r.status_code == 200
    # heuristic Lunch offset = 3; 3500/350 = 10; total 13
    assert r.json()["headcount"] == 13
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_labor_compute.py -v`
Expected: FAIL — `AttributeError: module ... has no attribute 'compute_headcount'` (or `_load_coefficients`).

- [ ] **Step 3: Implement in-process compute in `labor.py`**

In `src/lakehouse_market/routers/labor.py`, remove the `from ..serving import invoke_serving` import (line 6). Replace the `recommend` function (lines 66-73) and add the compute helpers. The new block:

```python
from functools import lru_cache

# Synthetic-label offsets baked into notebook 02's training target. Used as the
# fallback when the trained-coefficients table is absent so /recommend never 500s.
_HEURISTIC_OFFSETS = {"Breakfast": 1.0, "Lunch": 3.0, "Dinner": 2.0, "Late": 0.0}
_PER_DOLLAR = 1.0 / 350.0


@lru_cache(maxsize=1)
def _load_coefficients() -> dict[str, tuple[float, float]]:
    """Read per-daypart (base, per_dollar) from the trained-model coefficients
    table written by notebook 02. Cached for the process. Returns {} when the
    table is missing (fresh workspace before the init job) so callers fall back
    to the heuristic."""
    try:
        rows = fetch_all("SELECT daypart, base, per_dollar FROM labor_model_coefficients")
    except Exception:
        return {}
    return {r["daypart"]: (float(r["base"]), float(r["per_dollar"])) for r in rows}


def compute_headcount(forecast_revenue: float, daypart: str) -> int:
    """Headcount from the trained model's coefficients; heuristic fallback."""
    coeffs = _load_coefficients()
    if daypart in coeffs:
        base, per_dollar = coeffs[daypart]
    else:
        base, per_dollar = _HEURISTIC_OFFSETS.get(daypart, 0.0), _PER_DOLLAR
    return max(0, round(base + per_dollar * forecast_revenue))


@router.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest):
    return {"headcount": compute_headcount(req.forecast_revenue, req.daypart)}
```

Keep the `fetch_all, get_anchor_date` import on line 7 (still used).

- [ ] **Step 4: Delete the Model Serving wrapper**

Run: `git rm src/lakehouse_market/serving.py`
Expected: file staged for deletion.

- [ ] **Step 5: Update the existing labor router test**

In `tests/test_labor_router.py`, replace `test_recommend_returns_headcount` (lines 22-31) so it no longer mocks `invoke_serving`:

```python
def test_recommend_returns_headcount(monkeypatch):
    from lakehouse_market.routers import labor as labor_mod
    monkeypatch.setattr(labor_mod, "_load_coefficients", lambda: {})
    r = TestClient(app).post(
        "/api/labor/recommend",
        json={"forecast_revenue": 3500, "daypart": "Lunch"},
    )
    assert r.status_code == 200
    assert r.json()["headcount"] == 13  # heuristic: 3500/350 + Lunch offset 3
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `uv run pytest tests/test_labor_compute.py tests/test_labor_router.py -v`
Expected: PASS (all).

- [ ] **Step 7: Verify no lingering serving references**

Run: `git grep -n "invoke_serving\|serving import\|labor_endpoint\|from ..serving" -- src/ tests/`
Expected: no hits.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(labor): compute headcount in-process; drop Model Serving endpoint"
```

---

## Task 3: Notebook 02 writes the coefficients table

Notebook 02 keeps training + registering the model to UC (MLflow lineage), and additionally derives per-daypart `(base, per_dollar)` from the fitted model and writes them to `labor_model_coefficients` for the app to read.

**Files:**
- Modify: `notebooks/02_train_labor_model.py`

**Interfaces:**
- Produces: UC table `<catalog>.<schema>.labor_model_coefficients(daypart STRING, base DOUBLE, per_dollar DOUBLE)`, one row per daypart in `{Breakfast, Lunch, Dinner, Late}`. `base = model.predict(daypart, revenue=0)`; `per_dollar = (model.predict(daypart, 1000) - base) / 1000`.

- [ ] **Step 1: Standardize the schema fallback default**

In `notebooks/02_train_labor_model.py` line 16, change the fallback `"tth_ops_homebase"` to `"lakehouse_market"`:

```python
SCHEMA  = dbutils.widgets.get("schema")  if "schema"  in dbutils.widgets.getAll() else "lakehouse_market"
```

Also change line 15 fallback `"retail_consumer_goods"` to `"main"`:

```python
CATALOG = dbutils.widgets.get("catalog") if "catalog" in dbutils.widgets.getAll() else "main"
```

- [ ] **Step 2: Derive coefficients from the fitted model and write the table**

Append a new `# COMMAND ----------` cell at the end of `notebooks/02_train_labor_model.py`:

```python
# COMMAND ----------
# Derive per-daypart linear coefficients from the fitted pipeline by probing it
# at revenue 0 and 1000, then persist for the app's in-process /recommend.
# (The app reads this table instead of calling a Model Serving endpoint.)
import pandas as pd

DAYPARTS = ["Breakfast", "Lunch", "Dinner", "Late"]
coef_rows = []
for dp in DAYPARTS:
    probe = pd.DataFrame(
        {"forecast_revenue": [0.0, 1000.0], "daypart": [dp, dp]}
    )
    y0, y1 = pipe.predict(probe)
    base = float(y0)
    per_dollar = float((y1 - y0) / 1000.0)
    coef_rows.append((dp, base, per_dollar))

coef_df = spark.createDataFrame(coef_rows, schema="daypart string, base double, per_dollar double")
coef_df.write.mode("overwrite").saveAsTable(f"{CATALOG}.{SCHEMA}.labor_model_coefficients")
print("wrote", CATALOG + "." + SCHEMA + ".labor_model_coefficients:", coef_rows)
```

- [ ] **Step 3: Sanity-check the notebook parses**

Run: `python3 -c "import ast; ast.parse(open('notebooks/02_train_labor_model.py').read()); print('ok')"`
Expected: `ok` (Databricks magic comments are comments; this validates Python syntax).

- [ ] **Step 4: Commit**

```bash
git add notebooks/02_train_labor_model.py
git commit -m "feat(labor-nb): write labor_model_coefficients table for in-app compute"
```

---

## Task 4: Genie space id resolves from a UC `app_config` table

Add an `app_config` reader so the app resolves the Genie space id at runtime from a UC table (written by notebook 06 in Task 5) when the `GENIE_SPACE_ID` env is empty. Env still wins.

**Files:**
- Create: `src/lakehouse_market/app_config.py`
- Test: `tests/test_app_config.py` (create)

**Interfaces:**
- Consumes: `config.get_settings().genie_space_id` (env); `sql_utils.fetch_all`.
- Produces: `app_config.resolve_genie_space_id() -> str` — returns env value if set, else the `genie_space_id` row from `app_config`, else `""`. Cached per process. `app_config.clear_cache() -> None` for tests.

- [ ] **Step 1: Write the failing test**

Create `tests/test_app_config.py`:

```python
# tests/test_app_config.py
from lakehouse_market import app_config


def teardown_function():
    app_config.clear_cache()


def test_env_wins(monkeypatch):
    monkeypatch.setattr(app_config, "_settings_space_id", lambda: "env-space-123")
    # Even if the table would return something, env takes precedence.
    monkeypatch.setattr(app_config, "_fetch_config", lambda k: "table-space-999")
    assert app_config.resolve_genie_space_id() == "env-space-123"


def test_falls_back_to_table(monkeypatch):
    monkeypatch.setattr(app_config, "_settings_space_id", lambda: "")
    monkeypatch.setattr(app_config, "_fetch_config", lambda k: "table-space-999")
    assert app_config.resolve_genie_space_id() == "table-space-999"


def test_empty_when_neither(monkeypatch):
    monkeypatch.setattr(app_config, "_settings_space_id", lambda: "")
    monkeypatch.setattr(app_config, "_fetch_config", lambda k: "")
    assert app_config.resolve_genie_space_id() == ""
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_app_config.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lakehouse_market.app_config'`.

- [ ] **Step 3: Implement `app_config.py`**

Create `src/lakehouse_market/app_config.py`:

```python
# src/lakehouse_market/app_config.py
"""Runtime key/value config the app reads from a UC table.

The init job (notebook 06) writes runtime-resolved values here that are not
known at deploy time. Today that is the Genie space id: notebook 06 creates the
space and MERGEs its id into <catalog>.<schema>.app_config(config_key,
config_value). The app reads it lazily so no id is hardcoded in the bundle.
"""
from __future__ import annotations

from functools import lru_cache

from .config import get_settings
from .sql_utils import fetch_all


def _settings_space_id() -> str:
    return get_settings().genie_space_id


def _fetch_config(key: str) -> str:
    """Read one config value from the UC app_config table. Returns "" when the
    table is absent (fresh workspace before the init job) or the key is unset."""
    try:
        rows = fetch_all(
            "SELECT config_value FROM app_config WHERE config_key = :k",
            {"k": key},
        )
    except Exception:
        return ""
    return str(rows[0]["config_value"]) if rows else ""


@lru_cache(maxsize=1)
def resolve_genie_space_id() -> str:
    """Env GENIE_SPACE_ID wins; else the app_config table; else ""."""
    env_id = _settings_space_id()
    if env_id:
        return env_id
    return _fetch_config("genie_space_id")


def clear_cache() -> None:
    resolve_genie_space_id.cache_clear()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_app_config.py -v`
Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/lakehouse_market/app_config.py tests/test_app_config.py
git commit -m "feat(config): resolve Genie space id from UC app_config table"
```

---

## Task 5: Genie router uses resolved space id and degrades gracefully

Wire `genie.py` to use `app_config.resolve_genie_space_id()` and return a friendly message (not a 500) when no space id resolves.

**Files:**
- Modify: `src/lakehouse_market/genie.py`
- Modify: `src/lakehouse_market/routers/genie.py`
- Test: `tests/test_genie.py` (modify/extend)

**Interfaces:**
- Consumes: `app_config.resolve_genie_space_id()`.
- Produces: `/api/genie/ask` returns `AskResponse` with `text="Genie is not configured for this workspace yet."`, `table=None`, empty ids, when no space id resolves. Otherwise unchanged.

- [ ] **Step 1: Write the failing test**

Add to `tests/test_genie.py`:

```python
def test_ask_degrades_when_no_space(monkeypatch):
    from fastapi.testclient import TestClient
    from lakehouse_market.app import app
    from lakehouse_market.routers import genie as genie_router
    monkeypatch.setattr(genie_router, "resolve_genie_space_id", lambda: "")
    r = TestClient(app).post(
        "/api/genie/ask",
        json={"tab_id": "labor", "store_id": 1, "question": "how are sales?"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "not configured" in body["text"].lower()
    assert body["table"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_genie.py::test_ask_degrades_when_no_space -v`
Expected: FAIL — either `resolve_genie_space_id` not importable in the router, or a 500 from the missing space.

- [ ] **Step 3: Use resolved id in the genie wrapper**

In `src/lakehouse_market/genie.py`, replace the two `s = get_settings()` + `s.genie_space_id` usages (in `create_conversation` and `poll_message`, and `fetch_query_result` if present) with the resolved id. At the top, add:

```python
from .app_config import resolve_genie_space_id
```

Then in each function, replace `s = get_settings()` / `s.genie_space_id` with:

```python
    space_id = resolve_genie_space_id()
```

and use `space_id` in the URL (e.g. `f"/api/2.0/genie/spaces/{space_id}/start-conversation"`). Remove the now-unused `get_settings` import if nothing else uses it.

- [ ] **Step 4: Degrade in the router**

In `src/lakehouse_market/routers/genie.py`, add the import and a guard at the top of the `ask` handler (the POST `/ask` endpoint). Add near the existing imports:

```python
from ..app_config import resolve_genie_space_id
```

At the very start of the `ask` function body, before any Genie call:

```python
    if not resolve_genie_space_id():
        return AskResponse(
            text="Genie is not configured for this workspace yet.",
            table=None,
            conversation_id="",
            message_id="",
        )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `uv run pytest tests/test_genie.py -v`
Expected: PASS (existing + new).

- [ ] **Step 6: Commit**

```bash
git add src/lakehouse_market/genie.py src/lakehouse_market/routers/genie.py tests/test_genie.py
git commit -m "feat(genie): resolve space id at runtime; degrade when unconfigured"
```

---

## Task 6: Notebook 06 self-wires the space id and grants the App SP

Notebook 06 writes the resolved space id to `app_config` and grants the App SP `CAN_RUN`, removing both the `setup.sh` id-capture step and the hardcoded id.

**Files:**
- Modify: `notebooks/06_ensure_genie_space.py`

**Interfaces:**
- Consumes: job params `catalog`, `schema`, `warehouse_id`, and a new optional `app_sp_id` (App service principal client id).
- Produces: after create/PATCH, upserts `app_config(config_key='genie_space_id', config_value=<id>)` in `<catalog>.<schema>`, and grants `CAN_RUN` to `app_sp_id` on the space when provided.

- [ ] **Step 1: Standardize fallback defaults**

In `notebooks/06_ensure_genie_space.py`, change the fallback defaults in the `_widget` calls (around lines 47-48):
- `CATALOG = _widget("catalog", "main")`
- `SCHEMA = _widget("schema", "lakehouse_market")`

- [ ] **Step 2: Add an `app_sp_id` widget**

Near the other widget definitions (after the `space_id` widget block at line ~205), add:

```python
try:
    dbutils.widgets.text("app_sp_id", "", "App service principal client id (for CAN_RUN grant)")
except NameError:
    pass
app_sp_id = ""
try:
    app_sp_id = dbutils.widgets.get("app_sp_id").strip()
except Exception:
    pass
```

- [ ] **Step 3: Persist the space id to app_config and grant CAN_RUN**

After the create/PATCH block (after line 242, the `else:` branch that prints the new id), append a new `# COMMAND ----------` cell. Note `resolved_id` must be set in both branches: in the PATCH branch it is `space_id`; in the CREATE branch it is `new_id`. Add `resolved_id = space_id or new_id` handling:

```python
# COMMAND ----------
# Self-wire: persist the space id so the app resolves it from UC (no hardcoded
# id, no post-run app.yaml rewrite), and grant the App SP CAN_RUN on the space.
resolved_id = resp.get("space_id") or resp.get("id") or space_id
if not resolved_id:
    raise RuntimeError(f"Could not resolve space id from response: {resp!r}")

spark.sql(f"USE CATALOG {CATALOG}")
spark.sql(f"USE SCHEMA {SCHEMA}")
spark.sql(
    "CREATE TABLE IF NOT EXISTS app_config "
    "(config_key STRING, config_value STRING) USING DELTA"
)
spark.sql(
    "MERGE INTO app_config t "
    f"USING (SELECT 'genie_space_id' AS k, '{resolved_id}' AS v) s "
    "ON t.config_key = s.k "
    "WHEN MATCHED THEN UPDATE SET t.config_value = s.v "
    "WHEN NOT MATCHED THEN INSERT (config_key, config_value) VALUES (s.k, s.v)"
)
print(f"app_config.genie_space_id = {resolved_id}")

if app_sp_id:
    w.api_client.do(
        "PUT",
        f"/api/2.0/permissions/genie/{resolved_id}",
        body={
            "access_control_list": [
                {"service_principal_name": app_sp_id, "permission_level": "CAN_RUN"}
            ]
        },
    )
    print(f"Granted CAN_RUN on space {resolved_id} to SP {app_sp_id}")
else:
    print("No app_sp_id provided; skipping CAN_RUN grant (bootstrap will handle it).")
```

- [ ] **Step 4: Pass `app_sp_id` from the init job**

In `resources/jobs.yml`, the `ensure_genie_space` task `base_parameters` — add `app_sp_id`. Since the App SP id is only known after the app deploys, source it from a DAB var with an empty default (bootstrap passes it via `--var` on the `bundle run`, or the bootstrap grants CAN_RUN itself as a fallback). Add to the task's `base_parameters`:

```yaml
              app_sp_id: ${var.app_sp_id}
```

- [ ] **Step 5: Sanity-check notebook parses**

Run: `python3 -c "import ast; ast.parse(open('notebooks/06_ensure_genie_space.py').read()); print('ok')"`
Expected: `ok`.

- [ ] **Step 6: Commit**

```bash
git add notebooks/06_ensure_genie_space.py resources/jobs.yml
git commit -m "feat(genie-nb): self-wire space id to app_config + grant App SP CAN_RUN"
```

---

## Task 7: Single-source env via DAB `config.env`; strip `app.yaml`

Move all app environment into `resources/app.yml` `config.env` sourced from `${var.*}`, and reduce `app.yaml` to just the start command.

**Files:**
- Modify: `resources/app.yml`
- Modify: `app.yaml`
- Modify: `databricks.yml`
- Modify: `src/lakehouse_market/config.py`

**Interfaces:**
- Produces: DAB vars per spec §6.2. App env resolved from `config.env`. `config.py` defaults match var defaults (local-dev fallback only).

- [ ] **Step 1: Add the full variable set to `databricks.yml`**

Replace the `variables:` block (lines 8-29) with:

```yaml
variables:
  catalog:
    description: Unity Catalog catalog (must be writable by the deployer). Default is the workspace default catalog.
    default: main
  schema:
    description: Schema inside the catalog.
    default: lakehouse_market
  app_name:
    description: Databricks App name.
    default: lakehouse-market-homebase
  warehouse_id:
    description: SQL warehouse id the app reads from. Resolved by scripts/bootstrap.sh when empty.
    default: ""
  lakebase_instance:
    description: Lakebase (Postgres on Databricks) instance name.
    default: lakehouse-market-app-db
  lakebase_db:
    description: Lakebase database name.
    default: databricks_postgres
  lakebase_capacity:
    description: Lakebase instance capacity.
    default: CU_1
  demo_anchor_date:
    description: Synthetic data window end; used as "today" in date-filtered queries.
    default: "2025-10-30"
  query_cache_ttl:
    description: In-process TTL cache seconds for warehouse reads (demo data changes only on redeploy).
    default: "86400"
  fm_endpoint:
    description: Foundation Model endpoint for the Feedback digest.
    default: databricks-claude-sonnet-4-6
  genie_space_title:
    description: Title of the Genie space created by the init job.
    default: lhm-ops-assistant
  app_sp_id:
    description: App service principal client id; passed by bootstrap after the app deploys (empty at first deploy).
    default: ""
  contract_recon_url:
    description: Optional sibling-app URL for the /apps launcher (hidden when empty).
    default: ""
  computer_vision_url:
    description: Optional sibling-app URL for the /apps launcher (hidden when empty).
    default: ""
  irregular_ops_url:
    description: Optional sibling-app URL for the /apps launcher (hidden when empty).
    default: ""
  user_email:
    description: Deployer email for run-as; supplied by bootstrap via databricks current-user me.
    default: ""
```

Also update the header comment (lines 1-3) to drop the Model Serving mention:

```yaml
# Databricks Asset Bundle (DAB) — root config for Lakehouse Market · Homebase.
# Provisions: the App, the Lakebase Postgres instance, and the init job that
# runs the data-gen + scoring + Genie notebooks. Retarget any workspace by
# editing the variable defaults below (or passing --var).
```

And align the `dais` target's `schema` (line 59) from `tth_ops_homebase` to `lakehouse_market` (leave its `catalog` as the event's `retail_consumer_goods`).

- [ ] **Step 2: Handle empty `user_email` in run-as**

In `databricks.yml`, the `default` target `run_as.user_name: ${var.user_email}` fails if `user_email` is empty. Remove the `run_as` block from the `default` target so DAB uses the deploying user's identity by default:

Delete lines 46-47 (the `run_as:` and `user_name:` under `default`). The `dais` target keeps its explicit `run_as`.

- [ ] **Step 3: Add `config.env` to the app resource**

Replace `resources/app.yml` contents with:

```yaml
# Databricks App resource. The app source is the whole repo; app.yaml at the
# repo root provides only the start command. All environment is defined here
# (single source of truth), sourced from databricks.yml variables.
resources:
  apps:
    homebase:
      name: ${var.app_name}
      source_code_path: ${workspace.file_path}
      resources:
        - name: warehouse-default
          sql_warehouse:
            id: ${var.warehouse_id}
            permission: CAN_USE
        - name: homebase-db
          database:
            instance_name: ${var.lakebase_instance}
            database_name: ${var.lakebase_db}
            permission: CAN_CONNECT_AND_CREATE
      config:
        env:
          - name: LHM_CATALOG
            value: ${var.catalog}
          - name: LHM_SCHEMA
            value: ${var.schema}
          - name: DATABRICKS_WAREHOUSE_ID
            value_from: warehouse-default
          - name: FM_ENDPOINT
            value: ${var.fm_endpoint}
          - name: DEMO_ANCHOR_DATE
            value: ${var.demo_anchor_date}
          - name: LHM_QUERY_CACHE_TTL
            value: ${var.query_cache_ttl}
          - name: LAKEBASE_INSTANCE
            value: ${var.lakebase_instance}
          - name: LAKEBASE_DB
            value: ${var.lakebase_db}
          - name: CONTRACT_RECON_URL
            value: ${var.contract_recon_url}
          - name: COMPUTER_VISION_URL
            value: ${var.computer_vision_url}
          - name: IRREGULAR_OPS_URL
            value: ${var.irregular_ops_url}
```

- [ ] **Step 4: Strip `app.yaml` to the command only**

Replace `app.yaml` contents with:

```yaml
# Databricks App start command. All environment is defined in resources/app.yml
# config.env (sourced from databricks.yml variables) — the single source of truth.
command:
  - uvicorn
  - lakehouse_market.app:app
  - --host=0.0.0.0
  - --port=8000
```

- [ ] **Step 5: Standardize `config.py` fallback defaults**

In `src/lakehouse_market/config.py`, update defaults so the local-dev fallback matches the DAB vars. In the `Settings` class and `get_settings()`:
- `catalog` default `"retail_consumer_goods"` → `"main"` (both the class field line and the `os.getenv("LHM_CATALOG", ...)` line).
- `schema_name` default `"tth_ops_homebase"` → `"lakehouse_market"` (both places).
- Remove the `labor_endpoint` field (class + `get_settings`) and its `os.getenv("LABOR_ENDPOINT", ...)`.
- Keep `genie_space_id`, `fm_endpoint`, `demo_anchor_date`, lakebase fields.

- [ ] **Step 6: Verify config tests still pass**

Run: `uv run pytest tests/ -v -k "config or labor or genie or startup"`
Expected: PASS.

- [ ] **Step 7: Validate the bundle**

Run: `databricks bundle validate`
Expected: `Validation OK!` (or equivalent success). If it errors on `config.env` schema, stop and report the exact message.

- [ ] **Step 8: Commit**

```bash
git add databricks.yml resources/app.yml app.yaml src/lakehouse_market/config.py
git commit -m "feat(dab): single-source app env via config.env; strip app.yaml"
```

---

## Task 8: Scrub remaining personal/workspace references

**Files:**
- Modify: `pyproject.toml`, `.env.example`, `ui/src/pages/ArchitectureView.tsx`
- Modify: any notebook (01/03/04/05) with hardcoded `tth_ops_homebase`/`retail_consumer_goods` fallbacks

**Interfaces:** none (config/copy only).

- [ ] **Step 1: Generic author in `pyproject.toml`**

Change line 7:

```toml
authors = [{ name = "Databricks Field Engineering" }]
```

- [ ] **Step 2: Rewrite `.env.example`**

Replace `.env.example` contents with:

```bash
# Copy to .env and fill in. Required only for `make dev` (local development).
# The deployed App gets its environment from resources/app.yml config.env.

# ---------- Databricks workspace ----------
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_WAREHOUSE_ID=
DATABRICKS_TOKEN=

# ---------- UC scope (match your databricks.yml vars) ----------
LHM_CATALOG=main
LHM_SCHEMA=lakehouse_market

# ---------- Lakebase (fill from App > Resources > Database after first deploy) ----------
LAKEBASE_INSTANCE=lakehouse-market-app-db
LAKEBASE_HOST=
LAKEBASE_DB=databricks_postgres
LAKEBASE_USER=
LAKEBASE_PASSWORD=
# Or the standard Postgres envs: PGHOST / PGUSER / PGPASSWORD / PGDATABASE

# ---------- Genie (optional local pin; the deployed app resolves this from UC) ----------
GENIE_SPACE_ID=

# ---------- Foundation model ----------
FM_ENDPOINT=databricks-claude-sonnet-4-6

# ---------- Demo data anchor (optional) ----------
# DEMO_ANCHOR_DATE=2025-10-30
```

- [ ] **Step 3: Neutral label in `ArchitectureView.tsx`**

In `ui/src/pages/ArchitectureView.tsx` line 245, change:

```tsx
    "main.lakehouse_market · 21 tables · 6 domains",
```

- [ ] **Step 4: Standardize notebook fallback defaults (01/03/04/05)**

Run: `git grep -n "retail_consumer_goods\|tth_ops_homebase" -- notebooks/`
For each hit that is a Python fallback default, change `retail_consumer_goods` → `main` and `tth_ops_homebase` → `lakehouse_market`. (Widget-driven values from the job are unaffected; this only touches the local-run fallbacks.)

- [ ] **Step 5: Verify the scrub is clean**

Run: `git grep -niE "jonathan|jdub|whiteley|66306676349647|fe-vm|dev_jonathan|little.?caesar|\blce\b" -- app.yaml databricks.yml pyproject.toml resources/ src/ ui/src/ .env.example`
Expected: no hits. (The `dais` target's `databricks-events.com` host/email is allowed and lives in `databricks.yml`; the grep above does not match it.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scrub personal/workspace refs; standardize catalog/schema defaults"
```

---

## Task 9: Slim bootstrap script (replace 10-stage setup.sh)

Replace `setup.sh` with a 4-step `bootstrap.sh`: resolve warehouse, deploy, grant, run init. No Model Serving stash/restore, no `app.yaml` rewrite, no stage-2 redeploy.

**Files:**
- Create: `scripts/bootstrap.sh`
- Delete: `scripts/setup.sh`
- Keep: `scripts/grants.sql`
- Modify: `Makefile`

**Interfaces:**
- `make setup` → `bash scripts/bootstrap.sh`. Env overrides: `WAREHOUSE_ID`, `LHM_CATALOG`, `LHM_SCHEMA`, `DAB_TARGET`.

- [ ] **Step 1: Write `scripts/bootstrap.sh`**

Create `scripts/bootstrap.sh`:

```bash
#!/usr/bin/env bash
# scripts/bootstrap.sh — one-shot deploy to a fresh workspace. Idempotent.
#
# Prereqs: databricks CLI v0.230+ authenticated; uv; node >= 20; jq.
#
# Steps:
#   1. Resolve a SQL warehouse (WAREHOUSE_ID env wins) + bump auto_stop_mins
#   2. Build the UI and `databricks bundle deploy` (app + Lakebase + init job)
#   3. Grant the App SP USE CATALOG / USE SCHEMA / SELECT (scripts/grants.sql)
#   4. `databricks bundle run lhm_init_job` (data gen + scoring + self-wiring Genie)
set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf "\n\033[1;34m> %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31mx %s\033[0m\n" "$*"; exit 1; }

DAB_TARGET="${DAB_TARGET:-default}"
TARGET_ARGS=(--target "$DAB_TARGET")

# Export as LHM_CATALOG / LHM_SCHEMA so both `--var` and grants.sql (envsubst) see them.
LHM_CATALOG="${LHM_CATALOG:-$(databricks bundle summary "${TARGET_ARGS[@]}" -o json 2>/dev/null | jq -r '.variables.catalog.value // .variables.catalog.default // "main"')}"
LHM_SCHEMA="${LHM_SCHEMA:-$(databricks bundle summary "${TARGET_ARGS[@]}" -o json 2>/dev/null | jq -r '.variables.schema.value // .variables.schema.default // "lakehouse_market"')}"
export LHM_CATALOG LHM_SCHEMA

# 1. warehouse
log "Resolving SQL warehouse"
if [[ -z "${WAREHOUSE_ID:-}" ]]; then
  WAREHOUSE_ID=$(databricks warehouses list "${TARGET_ARGS[@]}" -o json | jq -r '
    [.[] | select(.state == "RUNNING")][0].id //
    [.[] | select(.enable_serverless_compute == true)][0].id //
    .[0].id // ""')
fi
[[ -z "$WAREHOUSE_ID" ]] && fail "No SQL warehouse available in this workspace"
export WAREHOUSE_ID
log "Using warehouse $WAREHOUSE_ID (catalog=$LHM_CATALOG schema=$LHM_SCHEMA)"
databricks warehouses edit "$WAREHOUSE_ID" "${TARGET_ARGS[@]}" --auto-stop-mins 120 >/dev/null 2>&1 || true

# 2. build + deploy
log "Building UI"
make build >/dev/null
log "Deploying bundle (app + Lakebase instance + init job)"
databricks bundle deploy "${TARGET_ARGS[@]}" \
  --var "warehouse_id=$WAREHOUSE_ID" --var "catalog=$LHM_CATALOG" --var "schema=$LHM_SCHEMA" \
  --var "user_email=$(databricks current-user me "${TARGET_ARGS[@]}" -o json | jq -r '.userName')"

# 3. grants
log "Granting App SP access to $LHM_CATALOG.$LHM_SCHEMA"
APP_NAME=$(databricks bundle summary "${TARGET_ARGS[@]}" -o json | jq -r '.resources.apps.homebase.name // "lakehouse-market-homebase"')
APP_SP_ID=$(databricks apps get "$APP_NAME" "${TARGET_ARGS[@]}" -o json | jq -r '.service_principal_client_id')
[[ -z "$APP_SP_ID" || "$APP_SP_ID" == "null" ]] && fail "Could not resolve App SP id"
export APP_SP_ID
envsubst < scripts/grants.sql | while IFS= read -r stmt; do
  [[ -z "$stmt" || "$stmt" == "--"* ]] && continue
  databricks api post /api/2.0/sql/statements "${TARGET_ARGS[@]}" \
    --json "{\"statement\":$(jq -Rs <<<"$stmt"),\"warehouse_id\":\"$WAREHOUSE_ID\",\"wait_timeout\":\"30s\"}" >/dev/null \
    && echo "  ok: $stmt"
done

# 4. init job (data gen + scoring + self-wiring Genie; pass App SP for CAN_RUN grant)
log "Running init job (data gen + scoring + Genie space)"
databricks bundle run "${TARGET_ARGS[@]}" lhm_init_job --var "app_sp_id=$APP_SP_ID"

URL=$(databricks apps get "$APP_NAME" "${TARGET_ARGS[@]}" -o json | jq -r '.url')
log "Done. App: $URL"
```

- [ ] **Step 2: Make it executable and delete the old script**

Run: `chmod +x scripts/bootstrap.sh && git rm scripts/setup.sh`
Expected: `bootstrap.sh` executable; `setup.sh` staged for deletion.

- [ ] **Step 3: Update the `Makefile`**

In `Makefile`, change the `setup` target and its help line:
- Help line: `@echo "  setup     One-shot deploy from scratch (warehouse + deploy + grants + init)"`
- Target:

```make
setup: install
	bash scripts/bootstrap.sh
```

- [ ] **Step 4: Confirm grants.sql var names match the bootstrap exports**

Run: `cat scripts/grants.sql`
Expected: statements reference `${APP_SP_ID}`, `${LHM_CATALOG}`, `${LHM_SCHEMA}` — exactly the names `bootstrap.sh` exports, so `envsubst` substitutes them correctly. No change needed. If any name differs, align it to these three.

- [ ] **Step 5: Shellcheck the bootstrap (best-effort)**

Run: `bash -n scripts/bootstrap.sh && echo "syntax ok"`
Expected: `syntax ok`.

- [ ] **Step 6: Commit**

```bash
git add scripts/bootstrap.sh Makefile scripts/grants.sql
git rm --cached scripts/setup.sh 2>/dev/null || true
git commit -m "feat(deploy): slim 4-step bootstrap.sh; retire 10-stage setup.sh"
```

---

## Task 10: Punchy README + move deep material to docs

**Files:**
- Modify: `README.md`
- Create: `docs/architecture.md`

**Interfaces:** none (docs).

- [ ] **Step 1: Create `docs/architecture.md` with the deep material**

Create `docs/architecture.md` and move (cut) these sections out of the current `README.md` into it, scrubbed of the workspace URL / id / branch: the full ASCII architecture, "How writes work", "How Genie works", "Data anchor", "Data domains", "Project layout", "Tour mode", and the troubleshooting table. Add a top line:

```markdown
# Architecture & Operations — Lakehouse Market · Homebase

Deep reference for the demo internals. For setup, see the root [README](../README.md).
```

- [ ] **Step 2: Replace `README.md` with the punchy version**

Replace `README.md` contents with:

```markdown
# Lakehouse Market · Homebase

A Databricks App: a store manager's daily operations console for a fictional QSR, built end to end on the lakehouse. One synthetic dataset, real Lakebase write-back on every action, Genie chat from a slide-over, and an in-app labor recommendation from a UC-trained model.

**Modules:** Today · Labor · Inventory · Equipment · Loyalty · Guest Feedback.

## Architecture

```
React + Vite UI  ->  FastAPI (uvicorn)  ->  UC reads (SQL warehouse)
                                         ->  Lakebase Postgres (writes)
                                         ->  Genie space (chat)
```

The app reads governed data from Unity Catalog, writes every manager action to a Lakebase Postgres instance, and answers natural-language questions through a Genie space. Full internals: [docs/architecture.md](docs/architecture.md).

## Quick start

Deploy to a fresh workspace:

```bash
make setup
```

This resolves a SQL warehouse, deploys the bundle (app + Lakebase instance + init job), grants the App service principal UC access, and runs the init job (data generation, scoring, and Genie space creation). Takes about 10 to 15 minutes, most of it the init job.

Retarget any workspace by editing the variable defaults in `databricks.yml` (or passing `--var catalog=... --var schema=...`). Nothing else needs editing.

Redeploy after UI or code changes only:

```bash
make build && databricks bundle deploy && databricks bundle run homebase
```

**Prereqs:** `databricks` CLI v0.230+ (authenticated), `uv`, Node 20+, `jq`.

## Local dev

```bash
make install
cp .env.example .env    # fill in DATABRICKS_HOST, WAREHOUSE_ID, TOKEN
make dev                 # UI on :5173 (proxies /api -> :8000), FastAPI on :8000
make test
```

## What's inside

| Module | Route | Writes to |
|---|---|---|
| Today | `/today` | (read only) |
| Labor | `/labor` | `app_labor_overrides` |
| Inventory | `/inventory` | `app_purchase_orders` |
| Equipment | `/equipment` | `app_work_orders` |
| Loyalty | `/members` | `app_offer_pushes` |
| Guest Feedback | `/feedback` | `app_review_responses` |

## What's intentionally not here

Real PII (all data synthetic), production auth (uses the App service principal), mobile (desktop only), and production-grade ML (models are demo grade).

Powered by Databricks: Lakebase + Genie + Unity Catalog + Apps.
```

- [ ] **Step 3: Verify README has no leaked references**

Run: `git grep -niE "jonathan|jdub|whiteley|66306676349647|fe-vm|Model Serving|setup\.sh" -- README.md`
Expected: no hits (Model Serving is gone; the script is now bootstrap.sh).

- [ ] **Step 4: Commit**

```bash
git add README.md docs/architecture.md
git commit -m "docs: punchy README with Quick Start; move internals to docs/architecture.md"
```

---

## Task 11: Full verification pass

**Files:** none (verification).

- [ ] **Step 1: Run the full test suite**

Run: `uv run pytest -v`
Expected: all tests pass (labor compute, app_config, genie degradation, existing routers, startup, static mount).

- [ ] **Step 2: Validate the bundle**

Run: `databricks bundle validate`
Expected: success. Confirms `config.env`, the new vars, and the removed `serving.yml` all parse.

- [ ] **Step 3: Confirm serving.yml and its references are gone**

Run: `git grep -n "serving\|model_serving\|invoke_serving\|LABOR_ENDPOINT" -- src/ resources/ app.yaml databricks.yml`
Expected: no hits (docs may mention the removal).

- [ ] **Step 4: Confirm single-source env**

Run: `grep -c "env:" app.yaml || true`
Expected: `0` (app.yaml has only `command:`).
Run: `grep -n "config:" resources/app.yml`
Expected: the `config:` / `env:` block is present.

- [ ] **Step 5: Confirm the scrub across shipping files**

Run: `git grep -niE "jonathan|jdub|whiteley|66306676349647|fe-vm|dev_jonathan|little.?caesar|\blce\b" -- app.yaml databricks.yml pyproject.toml resources/ src/ ui/src/ README.md .env.example`
Expected: no hits.

- [ ] **Step 6: Final commit if anything was fixed**

```bash
git add -A && git commit -m "chore: verification fixes" || echo "nothing to fix"
```

---

## Notes for the implementer

- **Do not deploy** as part of this plan. All steps are local edits + `bundle validate` + `pytest`. A real `make setup` against a workspace is a separate, user-initiated step (it costs ~10-15 min and provisions cloud resources).
- **`config.env` is CLI-verified** to exist and accept `${var.*}` on v0.299. If `bundle validate` rejects it, the fallback is to keep env in `app.yaml` with values matching the DAB var defaults (the pre-single-source design) and report back before proceeding.
- **Grants stay in bootstrap** by design: the schema/tables and App SP do not exist at first deploy, so declarative `uc_securable` grants would fail. This matches the "keep what worked in the script" decision.
- **The `dais` target** is a legitimate DAIS event deploy; its `databricks-events.com` host and run-as email are an allowed documented example, not personal leakage. Leave it, only aligning its `schema` to `lakehouse_market`.
