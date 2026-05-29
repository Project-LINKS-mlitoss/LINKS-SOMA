"""Water meter feature engineering — minimal signal set.

Keeps only features with clear, direct vacancy interpretation:
  - num_zero_periods: how many reading periods had zero usage
  - min_water_usage: minimum across all periods (0 = very strong vacancy signal)
  - years_since_closure: how long the meter has been closed
"""

from __future__ import annotations

import numpy as np
import pandas as pd


USAGE_COLS = ["suido_usage_f1", "suido_usage_f2", "suido_usage_f3",
              "suido_usage_f4", "suido_usage_f5", "suido_usage_f6"]


def _parse_yyyymmdd(series: pd.Series) -> pd.Series:
    """Convert YYYYMMDD float or ISO string to datetime."""
    def _to_ts(val):
        if pd.isna(val):
            return pd.NaT
        s = str(val).strip()
        if s in ("nan", "", "None"):
            return pd.NaT
        if "-" in s and len(s) == 10:
            try:
                return pd.Timestamp(s)
            except Exception:
                return pd.NaT
        try:
            v = int(float(s))
            return pd.to_datetime(str(v), format="%Y%m%d", errors="coerce")
        except Exception:
            return pd.NaT
    return series.map(_to_ts)


def add_water_features(df: pd.DataFrame, reference_date: pd.Timestamp) -> pd.DataFrame:
    """Add water-meter features to *df* and return it.

    Adds:
      num_zero_periods          — count of f1-f6 periods with usage == 0
      min_water_usage           — minimum usage across all periods
      years_since_closure       — years meter has been closed (closed meters only)
    """
    present_cols = [c for c in USAGE_COLS if c in df.columns]
    added = []

    # has_usage_data: 1 if any f1-f6 column has a non-NaN value, else 0.
    # Distinguishes "no usage records joined" from "records joined but all zero".
    if present_cols:
        df["has_usage_data"] = df[present_cols].notna().any(axis=1).astype(int)
        added.append("has_usage_data")

    if present_cols:
        U = df[present_cols].copy()
        # Cap 99th-percentile outliers (commercial/industrial meters)
        for col in present_cols:
            cap = U[col].quantile(0.99)
            if cap > 0:
                U[col] = U[col].clip(upper=cap)

        arr = U.to_numpy(dtype=float)

        # Count periods with exactly 0 usage (NaN slots not counted as zero)
        df["num_zero_periods"] = (arr == 0).sum(axis=1).astype(float)
        added.append("num_zero_periods")

        # Minimum usage — 0 is a very strong vacancy signal
        df["min_water_usage"] = np.nanmin(arr, axis=1)
        added.append("min_water_usage")

        # ── Half-year temporal features ──────────────────────────────────
        # f1-f3 = first half (older periods), f4-f6 = second half (recent)
        # Captures re-occupation ("vacant early, occupied later") and
        # gradual decline ("occupied early, vacant later").
        n_cols = arr.shape[1]
        mid = n_cols // 2  # 3 for 6 periods

        first_half = arr[:, :mid]    # f1, f2, f3
        second_half = arr[:, mid:]   # f4, f5, f6

        first_half_avg = np.nanmean(first_half, axis=1)
        second_half_avg = np.nanmean(second_half, axis=1)

        df["usage_first_half_avg"] = first_half_avg
        df["usage_second_half_avg"] = second_half_avg
        added += ["usage_first_half_avg", "usage_second_half_avg"]

        # Half-year change rate: positive = usage increased (re-occupation signal)
        #                        negative = usage decreased (vacancy progression)
        safe_denom = np.where(first_half_avg > 0, first_half_avg, np.nan)
        df["usage_half_year_change_rate"] = (second_half_avg - first_half_avg) / safe_denom
        added.append("usage_half_year_change_rate")

        # Recent usage (last 2 periods = f5, f6): most current state of the building
        recent = arr[:, -2:]  # f5, f6
        df["recent_usage_avg"] = np.nanmean(recent, axis=1)
        added.append("recent_usage_avg")

    # Years since meter closure (closed meters only)
    if "usage_end_date" in df.columns:
        end_dt = _parse_yyyymmdd(df["usage_end_date"])
        days_since = (reference_date - end_dt).dt.days
        closed = df.get("water_disconnection_flag", pd.Series(0, index=df.index))
        df["years_since_closure"] = np.where(
            (closed == 1) & end_dt.notna(),
            days_since / 365.25,
            np.nan,
        )
        # BUG-2: Clip negative values — future close dates are data entry errors
        df["years_since_closure"] = df["years_since_closure"].clip(lower=0)
        added.append("years_since_closure")

    # F-6 fix: distinguish "meter closed long before data period (no usage records)"
    # from "meter active with zero usage readings".
    # When water_disconnection_flag=1 AND avg_water_usage=NaN, usage records simply
    # don't exist (meter was closed before data collection began). Without this flag,
    # num_zero_periods=0 for these meters — making them look like active meters.
    # 15,228+ long-term closed buildings (ysc>=10yr) are stuck in mid-score range
    # due to this misprocessing.
    if "water_disconnection_flag" in df.columns and "avg_water_usage" in df.columns:
        df["usage_data_unavailable_flag"] = (
            (df["water_disconnection_flag"] == 1) &
            df["avg_water_usage"].isna()
        ).astype(int)
        n_unavail = df["usage_data_unavailable_flag"].sum()
        added.append("usage_data_unavailable_flag")
        print(f"  [water] usage_data_unavailable_flag=1: {n_unavail:,} meters "
              f"(closed before data collection period)")

    print(f"  [water] Added {len(added)} features | rows: {len(df):,}")
    return df
