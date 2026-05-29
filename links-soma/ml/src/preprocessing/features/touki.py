"""Building registration (建物登記) feature engineering.

Only applicable to municipalities with touki data (Toyota, Okazaki).
All features are guarded and silently skipped for cities without touki data.
"""

from __future__ import annotations

import re

import numpy as np
import pandas as pd


# Registration reasons that indicate pure residential use
_RESIDENTIAL_REASONS = {"居宅", "共同住宅", "長屋"}


def _parse_yyyymmdd(series: pd.Series) -> pd.Series:
    """Convert YYYYMMDD float column to datetime (NaT on failure/NaN)."""
    s = series.dropna().astype(np.int64).astype(str)
    parsed = pd.to_datetime(s, format="%Y%m%d", errors="coerce")
    result = pd.Series(pd.NaT, index=series.index, dtype="datetime64[ns]")
    result.loc[parsed.index] = parsed.values
    return result


def add_touki_features(df: pd.DataFrame, reference_date: pd.Timestamp) -> pd.DataFrame:
    """Add building registry features to *df* (in-place) and return it.

    Silently no-ops if touki columns are absent (e.g. Shimonoseki).

    Args:
        df: Training DataFrame (modified in-place).
        reference_date: Date used as "today" for duration calculations.

    Returns:
        df with new columns added.
    """
    if "touki_residence_flag" not in df.columns:
        print("  [touki] Skipped — touki columns not present")
        return df

    added = []

    # ── 1. 建物登録経過年数 ─────────────────────────────────────────
    if "registration_date_touki_residence" in df.columns:
        reg_dt = _parse_yyyymmdd(df["registration_date_touki_residence"])
        days = (reference_date - reg_dt).dt.days
        df["building_registration_age_years"] = np.where(
            reg_dt.notna() & (df["touki_residence_flag"] == 1),
            days / 365.25,
            np.nan,
        )
        df["building_registration_age_years_is_missing"] = (
            df["building_registration_age_years"].isna().astype(int)
        )
        added.extend([
            "building_registration_age_years",
            "building_registration_age_years_is_missing",
        ])

    # ── 2. 純居住用途判定 ───────────────────────────────────────────
    # touki_residence_flag=0（登記マッチ失敗）の行では NaN にする。
    # 「登記データなし」と「明示的に非居住用途」を区別するため。
    if "registration_reason_touki_residence" in df.columns:
        reason_str = df["registration_reason_touki_residence"].astype(str)
        pattern = "|".join(re.escape(r) for r in _RESIDENTIAL_REASONS)
        is_residential = reason_str.str.contains(pattern, na=False)
        df["is_pure_residential"] = is_residential.astype(float)
        # 登記マッチ失敗の行は NaN（unknown）にする
        if "touki_residence_flag" in df.columns:
            unmatched = df["touki_residence_flag"] == 0
            df.loc[unmatched, "is_pure_residential"] = np.nan
        df["is_pure_residential_is_missing"] = (
            df["is_pure_residential"].isna().astype(int)
        )
        added += ["is_pure_residential", "is_pure_residential_is_missing"]

    # ── 3. 所有権移転回数（登記イベント3回以上）─────────────────────
    if "events_count_touki_residence" in df.columns:
        df["multiple_ownership_changes"] = (
            (df["events_count_touki_residence"].fillna(0) >= 3)
            & (df["touki_residence_flag"] == 1)
        ).astype(int)
        added.append("multiple_ownership_changes")

    print(f"  [touki] Added {len(added)} features | rows: {len(df):,}")
    return df
