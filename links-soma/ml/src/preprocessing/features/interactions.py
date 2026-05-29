"""Interaction and composite feature engineering — minimal set."""

from __future__ import annotations

import pandas as pd


def add_interaction_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add cross-source interaction features to *df* and return it."""
    added = []

    # Composite vacancy risk score — interpretable weighted sum
    # Components: water disconnection + zero usage + no resident
    score = pd.Series(0.0, index=df.index)

    if "water_disconnection_flag" in df.columns:
        score += df["water_disconnection_flag"].fillna(0) * 0.4

    if "min_water_usage" in df.columns:
        score += (df["min_water_usage"].fillna(1) == 0).astype(float) * 0.3

    if "juki_residence_flag" in df.columns:
        score += (df["juki_residence_flag"] == 0).astype(float) * 0.2

    if "household_size_juki_residence" in df.columns:
        score += (df["household_size_juki_residence"].fillna(1) == 0).astype(float) * 0.1

    df["composite_rule_score"] = score.clip(upper=1.0)
    added.append("composite_rule_score")

    print(f"  [interactions] Added {len(added)} features | rows: {len(df):,}")
    return df
