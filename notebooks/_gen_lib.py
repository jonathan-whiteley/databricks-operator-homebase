# notebooks/_gen_lib.py
"""Common helpers for data generation notebooks.
Designed to run inside a Databricks workspace (Spark available)."""
from __future__ import annotations
from datetime import date, timedelta
import random
import numpy as np

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

STORE_COUNT = 25
DAYPART_LABELS = ["Breakfast", "Lunch", "Dinner", "Late"]

def daterange(start: date, days: int):
    return [start + timedelta(days=i) for i in range(days)]

def jitter(value: float, pct: float = 0.1) -> float:
    return value * (1.0 + random.uniform(-pct, pct))
