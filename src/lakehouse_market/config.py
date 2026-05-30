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
