"""App settings sourced from environment variables.

Settings are pulled at first call to get_settings() and cached. The Databricks
App runtime sets DATABRICKS_HOST and DATABRICKS_WAREHOUSE_ID; everything else
is wired through app.yaml or local .env for dev.
"""
from __future__ import annotations

import os
from functools import lru_cache

from pydantic import BaseModel


class Settings(BaseModel):
    databricks_host: str = ""
    warehouse_id: str = ""
    catalog: str = "main"
    schema_name: str = "lakehouse_market"
    lakebase_host: str = ""
    lakebase_db: str = "homebase"
    lakebase_user: str = ""
    lakebase_password: str = ""
    genie_space_id: str = ""
    fm_endpoint: str = "databricks-claude-sonnet-4-6"
    # Synthetic data ends 2025-10-30; queries anchor to this instead of current_date()
    # so KPIs always populate regardless of when the demo is run.
    demo_anchor_date: str = "2025-10-30"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        databricks_host=os.getenv("DATABRICKS_HOST", ""),
        warehouse_id=os.getenv("DATABRICKS_WAREHOUSE_ID", ""),
        catalog=os.getenv("LHM_CATALOG", "main"),
        schema_name=os.getenv("LHM_SCHEMA", "lakehouse_market"),
        # Databricks Apps `database` binding injects PGHOST/PGUSER/PGPASSWORD/PGDATABASE.
        # Fall back to LAKEBASE_* for local dev / explicit overrides.
        lakebase_host=os.getenv("LAKEBASE_HOST") or os.getenv("PGHOST", ""),
        lakebase_db=os.getenv("LAKEBASE_DB") or os.getenv("PGDATABASE", "databricks_postgres"),
        lakebase_user=os.getenv("LAKEBASE_USER") or os.getenv("PGUSER", ""),
        lakebase_password=os.getenv("LAKEBASE_PASSWORD") or os.getenv("PGPASSWORD", ""),
        genie_space_id=os.getenv("GENIE_SPACE_ID", ""),
        fm_endpoint=os.getenv("FM_ENDPOINT", "databricks-claude-sonnet-4-6"),
        demo_anchor_date=os.getenv("DEMO_ANCHOR_DATE", "2025-10-30"),
    )
