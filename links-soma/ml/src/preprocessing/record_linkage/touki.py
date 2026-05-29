"""Building registry (建物登記) loading, aggregation and address matching.

Aggregates multiple registration events per address into one row, then joins
to the water meter DataFrame by normalized address.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from src.preprocessing.address_utils import CleanData


def load_touki(city_cfg: dict, data_dir: Path) -> pd.DataFrame | None:
    """Load 4_登記情報.csv with canonical column names.

    Returns None for cities without touki data (e.g. Shimonoseki).
    """
    if city_cfg.get("touki") is None:
        print("  [touki] No touki data for this city -- skipping")
        return None

    cfg     = city_cfg["touki"]
    cols    = cfg["columns"]
    src_col = {v: k for k, v in cols.items() if v is not None}

    df = pd.read_csv(data_dir / cfg["file"], low_memory=False, dtype=str)
    df = df.rename(columns=src_col)
    keep = [c for c in [
        "address", "registration_reason", "structure", "registration_date",
    ] if c in df.columns]
    df = df[keep].copy()
    df["normalized_address"] = CleanData.normalize_series(df["address"], municipality=city_cfg.get("municipality"))
    df["registration_date"]  = pd.to_numeric(
        df.get("registration_date", pd.Series()), errors="coerce"
    )
    print(f"  [touki] Loaded {len(df):,} events | "
          f"unique addresses: {df['normalized_address'].nunique():,}")
    return df


def aggregate_touki(touki_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate per-event touki records into one row per address.

    Output columns:
      normalized_address (index)
      touki_residence_flag = 1
      registration_reason_touki_residence   (most recent event)
      registration_date_touki_residence     (most recent date, YYYYMMDD float)
      events_count_touki_residence          (total number of events)
      events_json_touki_residence           (JSON list of all events)
    """
    # Sort by date descending so .first() gives most recent event per address
    touki_df = touki_df.sort_values("registration_date", ascending=False, na_position="last")

    # Most-recent registration per address (nth(0) preserves row atomicity, unlike first() which skips NaN per column)
    first = touki_df.groupby("normalized_address").nth(0).reset_index(drop=True)
    # normalized_addressをインデックスに設定（first()と同じ構造にする）
    first = first.set_index("normalized_address")
    first = first.rename(columns={
        "registration_reason": "registration_reason_touki_residence",
        "registration_date":   "registration_date_touki_residence",
    })

    # Event counts
    counts = touki_df.groupby("normalized_address").size().rename("events_count_touki_residence")

    # JSON of all events (most recent first)
    def _to_json(grp: pd.DataFrame) -> str:
        events = []
        for _, row in grp.iterrows():
            events.append({
                "reason": row.get("registration_reason"),
                "date":   str(int(row["registration_date"])) if pd.notna(row.get("registration_date")) else None,
                "structure": row.get("structure"),
            })
        return json.dumps(events, ensure_ascii=False)

    events_json = touki_df.groupby("normalized_address").apply(_to_json).rename("events_json_touki_residence")

    agg = first[["registration_reason_touki_residence", "registration_date_touki_residence"]]
    agg = agg.join(counts).join(events_json)
    agg["touki_residence_flag"] = 1

    print(f"  [touki] Aggregated {len(agg):,} unique addresses")
    return agg


def match_touki_to_water(df_water: pd.DataFrame, touki_agg: pd.DataFrame | None) -> pd.DataFrame:
    """Left-join touki aggregate to water meter DataFrame by normalized_address.

    No-op (returns df_water unchanged) if touki_agg is None.
    """
    if touki_agg is None:
        return df_water

    result = df_water.merge(
        touki_agg.reset_index(),
        on="normalized_address",
        how="left",
    )
    result["touki_residence_flag"] = result["touki_residence_flag"].fillna(0).astype(int)

    n_matched = (result["touki_residence_flag"] == 1).sum()
    n_total   = len(result)
    print(f"  [touki] Match rate: {n_matched:,} / {n_total:,} ({n_matched/n_total:.1%})")
    return result
