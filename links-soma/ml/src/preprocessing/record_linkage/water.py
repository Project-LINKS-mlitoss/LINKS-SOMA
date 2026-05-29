"""Water meter data loading and usage aggregation.

Step 1: Load 1_水道開閉栓状況.csv → normalize address, derive disconnection flag.
Step 2: Load 2_水道使用量.csv → join to status, create f1..f6 and aggregates.
"""

from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd

from src.preprocessing.address_utils import CleanData


# ── Date helpers ──────────────────────────────────────────────────────────────

# Japanese era offsets to Gregorian year
_ERA_OFFSETS = {
    "R": 2018,   # 令和 (Reiwa):   R01 = 2019
    "H": 1988,   # 平成 (Heisei):  H01 = 1989
    "S": 1925,   # 昭和 (Showa):   S01 = 1926
    "T": 1911,   # 大正 (Taisho):  T01 = 1912
    "M": 1867,   # 明治 (Meiji):   M01 = 1868
}
_ERA_PAT = re.compile(
    r"^([RHSTMrhmst])(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{1,2})$"
)


def _normalize_date_series(series: pd.Series) -> pd.Series:
    """Convert a mixed date column to YYYYMMDD float (NaN on failure).

    Handles:
      - YYYYMMDD integer/float (e.g. 20240528, 20240528.0)
      - ISO string YYYY-MM-DD
      - Japanese era string RYY.MM.DD / HYY.MM.DD etc.
    """
    def _convert(val) -> float:
        if pd.isna(val):
            return float("nan")
        s = str(val).strip()
        if s in ("nan", "", "None"):
            return float("nan")
        # Try era format first (e.g. R06.05.28)
        m = _ERA_PAT.match(s)
        if m:
            era, yr, mo, dy = m.group(1).upper(), int(m.group(2)), int(m.group(3)), int(m.group(4))
            offset = _ERA_OFFSETS.get(era, 0)
            year = offset + yr
            return float(year * 10000 + mo * 100 + dy)
        # Try ISO format (e.g. 2024-05-28)
        if "-" in s and len(s) == 10:
            try:
                dt = pd.Timestamp(s)
                return float(dt.year * 10000 + dt.month * 100 + dt.day)
            except Exception:
                pass
        # Try numeric YYYYMMDD (e.g. 20040130 or 20040130.0)
        try:
            v = float(s)
            if 18000000 <= v <= 21000000:
                return v
        except Exception:
            pass
        return float("nan")

    return series.map(_convert)


# ── Constants ─────────────────────────────────────────────────────────────────

N_USAGE_PERIODS = 6   # number of reading-period slots (f1=oldest, f6=newest)

# Canonical output column names
USAGE_F_COLS = [f"suido_usage_f{i}" for i in range(1, N_USAGE_PERIODS + 1)]
DATE_F_COLS  = [f"meter_reading_date_f{i}" for i in range(1, N_USAGE_PERIODS + 1)]


# ── Step 1: Water meter status ────────────────────────────────────────────────

def load_water_status(
    city_cfg: dict,
    data_dir: Path,
    standard_date: pd.Timestamp | None = None,
) -> pd.DataFrame:
    """Load 1_水道開閉栓状況.csv and return a canonical DataFrame.

    Returns one row per water meter with columns:
      water_supply_number, normalized_address, usage_start_date,
      usage_end_date, water_disconnection_flag

    water_disconnection_flag = 1 iff usage_end_date is not null
    (confirmed empirically: 100% precision/recall vs old pipeline flag).
    """
    cfg     = city_cfg["suido_status"]
    cols    = cfg["columns"]
    path    = data_dir / cfg["file"]
    src_col = {v: k for k, v in cols.items() if v is not None}

    df = pd.read_csv(path, low_memory=False)
    # Rename to canonical names
    df = df.rename(columns=src_col)
    # Concatenate address_suffix if present (e.g. 装置場所 + 装置場所方書)
    if "address_suffix" in df.columns:
        df["address"] = df["address"].fillna("") + df["address_suffix"].fillna("")
    # Keep only canonical columns that exist
    keep = [c for c in [
        "water_supply_number", "address",
        "usage_start_date", "usage_end_date", "meter_status_code",
    ] if c in df.columns]
    df = df[keep].copy()

    # ── Dedup: some cities have multiple rows per meter (service history) ────
    if cfg.get("dedup_by_latest_start_date"):
        df["usage_start_date"] = _normalize_date_series(df["usage_start_date"])
        # Keep only the most recent service period per meter
        df = (df.sort_values("usage_start_date", ascending=False, na_position="last")
                .drop_duplicates(subset=["water_supply_number"], keep="first")
                .reset_index(drop=True))
        print(f"  [water_status] Deduped to {len(df):,} unique meters "
              f"(most recent service period each)")

    # ── Dedup: some cities have multiple meters (contracts) per address ──────
    # When a resident moves out and a new one moves in, a new お客様番号 is issued
    # at the same address. Old contracts remain in the file with a 閉栓日.
    # Keep only the most recent PRE-SURVEY contract per address.
    if cfg.get("dedup_by_latest_start_date_per_address"):
        # Normalize address first so dedup uses the same key as the join later
        df["normalized_address"] = CleanData.normalize_series(df["address"], municipality=city_cfg.get("municipality"))
        df["usage_start_date"] = _normalize_date_series(df["usage_start_date"])
        # Problem-1 fix: before dedup, exclude post-survey contracts so that the
        # most-recent-per-address selection picks the pre-survey state.
        if standard_date is not None:
            cutoff_num = int(standard_date.strftime("%Y%m%d"))
            pre_filter = len(df)
            df = df[df["usage_start_date"].fillna(0) <= cutoff_num].copy()
            n_post = pre_filter - len(df)
            if n_post > 0:
                print(f"  [water_status] Removed {n_post:,} post-survey contracts "
                      f"before address dedup (start > {standard_date.date()})")
        n_before = len(df)
        df = (df.sort_values("usage_start_date", ascending=False, na_position="last")
                .drop_duplicates(subset=["normalized_address"], keep="first")
                .reset_index(drop=True))
        print(f"  [water_status] Address-level dedup: {n_before:,} -> {len(df):,} "
              f"(most recent pre-survey contract per address)")

    # Normalize address
    df["normalized_address"] = CleanData.normalize_series(df["address"], municipality=city_cfg.get("municipality"))

    # Normalize date columns (handle era dates, ISO, YYYYMMDD)
    for date_col in ["usage_start_date", "usage_end_date"]:
        if date_col in df.columns:
            df[date_col] = _normalize_date_series(df[date_col])

    # ── Problem-1 (general): remove post-survey contracts for all cities ─────
    # Contracts opened after the survey date reflect the current state, not the
    # state at the time vacancies were surveyed.  Remove them universally.
    if standard_date is not None and "usage_start_date" in df.columns:
        cutoff_num = int(standard_date.strftime("%Y%m%d"))
        post_survey = (
            df["usage_start_date"].notna() & (df["usage_start_date"] > cutoff_num)
        )
        n_post = int(post_survey.sum())
        if n_post > 0:
            df = df[~post_survey].reset_index(drop=True)
            print(f"  [water_status] Removed {n_post:,} post-survey contracts "
                  f"(usage_start_date > {standard_date.date()})")

    # Disconnection flag ────────────────────────────────────────────────────
    disc_cfg = cfg.get("disconnection_from_text")
    if disc_cfg:
        # meter_status_code has values like '開栓中'/'閉栓(検有)'/'閉栓(検無)'/'給水停止'
        # closed_value may be a string (single value) or a list (multiple values)
        closed_val = disc_cfg["closed_value"]
        if "meter_status_code" in df.columns:
            if isinstance(closed_val, list):
                df["water_disconnection_flag"] = (
                    df["meter_status_code"].isin(closed_val)
                ).astype(int)
            else:
                df["water_disconnection_flag"] = (
                    df["meter_status_code"] == closed_val
                ).astype(int)
        else:
            df["water_disconnection_flag"] = 0
    elif "usage_end_date" in df.columns:
        end_dates = df["usage_end_date"]
        # If standard_date is set: a meter closed AFTER standard_date was still
        # open at the reference time → flag = 0 for those
        if standard_date is not None:
            cutoff = int(standard_date.strftime("%Y%m%d"))
            df["water_disconnection_flag"] = (
                end_dates.notna() & (end_dates <= cutoff)
            ).astype(int)
        else:
            df["water_disconnection_flag"] = end_dates.notna().astype(int)
    else:
        df["water_disconnection_flag"] = 0

    # ── Problem-2: clear flag where usage_end_date is in the future ──────────
    # For disconnection_from_text cities, the flag is set from
    # meter_status_code without checking the close date against standard_date.
    # Meters closed AFTER the survey date were open at the reference time → flag=0.
    if standard_date is not None and "usage_end_date" in df.columns:
        cutoff_num = int(standard_date.strftime("%Y%m%d"))
        future_close = (
            df["usage_end_date"].notna() &
            (pd.to_numeric(df["usage_end_date"], errors="coerce") > cutoff_num) &
            (df["water_disconnection_flag"] == 1)
        )
        n_future = int(future_close.sum())
        if n_future > 0:
            df.loc[future_close, "water_disconnection_flag"] = 0
            print(f"  [water_status] Cleared {n_future:,} disconnection flags "
                  f"(usage_end_date > {standard_date.date()})")

    # ── Sanity check: open_date > close_date means meter was reopened ────────
    # In some cities, data entry errors or re-opening events leave
    # open_date > close_date. These meters are actually open → clear the flag.
    if "usage_start_date" in df.columns and "usage_end_date" in df.columns:
        open_dates = df["usage_start_date"]
        end_dates2 = df["usage_end_date"]
        reopened = (
            open_dates.notna() & end_dates2.notna() &
            (open_dates > end_dates2) &
            (df["water_disconnection_flag"] == 1)
        )
        if reopened.sum() > 0:
            df.loc[reopened, "water_disconnection_flag"] = 0
            print(f"  [water_status] Cleared disconnection flag for {reopened.sum()} "
                  f"meters where open_date > close_date (re-opened meters)")

    # ── Final safety dedup: ensure water_supply_number is unique ─────────────
    # Catches duplicate meter numbers that address-level dedup may not remove.
    before = len(df)
    df = df.drop_duplicates(subset=["water_supply_number"], keep="first").reset_index(drop=True)
    if len(df) < before:
        print(f"  [water_status] Removed {before - len(df)} duplicate water_supply_number rows")

    n = len(df)
    n_closed = df["water_disconnection_flag"].sum()
    print(f"  [water_status] {n:,} meters | disconnected: {n_closed:,} ({n_closed/n:.1%})")
    return df


# ── Step 2: Usage aggregation ─────────────────────────────────────────────────

def aggregate_usage(
    city_cfg: dict,
    data_dir: Path,
    df_status: pd.DataFrame,
    standard_date: pd.Timestamp | None = None,
) -> pd.DataFrame:
    """Load 2_水道使用量.csv, attach to status, and compute f1..f6 + aggregates.

    Args:
        city_cfg: City configuration dict.
        data_dir: Path to city data directory.
        df_status: DataFrame from load_water_status().

    Returns:
        df_status augmented with usage columns.
    """
    use_cfg  = city_cfg["suido_use"]
    use_cols = use_cfg["columns"]
    src_col  = {v: k for k, v in use_cols.items()}

    # Load usage file(s)
    frames = []
    for fname in use_cfg["files"]:
        p = data_dir / fname
        if p.exists():
            frames.append(pd.read_csv(p, low_memory=False))
        else:
            print(f"  [usage] Warning: {p} not found, skipping")
    if not frames:
        print("  [usage] No usage files found -- skipping")
        return df_status

    use_df = pd.concat(frames, ignore_index=True)
    use_df = use_df.rename(columns=src_col)
    use_df = use_df[["water_supply_number", "meter_reading_date", "suido_usage"]].copy()
    use_df["suido_usage"] = pd.to_numeric(use_df["suido_usage"], errors="coerce")
    use_df["meter_reading_date"] = pd.to_numeric(use_df["meter_reading_date"], errors="coerce")

    # ── Filter by standard_date: only readings on or before the survey date ──
    if standard_date is not None:
        cutoff = int(standard_date.strftime("%Y%m%d"))
        n_before = len(use_df)
        use_df = use_df[use_df["meter_reading_date"] <= cutoff]
        n_after = len(use_df)
        pct = n_after / max(1, n_before)
        if n_after == 0:
            print(f"  [usage] [!] WARNING: 0 readings on or before {standard_date.date()} "
                  f"(all {n_before:,} readings are after the survey date). "
                  f"Usage features will be NaN.")
        else:
            print(f"  [usage] Filtered to <= {standard_date.date()}: "
                  f"{n_after:,} / {n_before:,} readings kept ({pct:.0%})")

    if len(use_df) > 0:
        print(f"  [usage] {len(use_df):,} readings | "
              f"meters: {use_df['water_supply_number'].nunique():,} | "
              f"date range: {int(use_df['meter_reading_date'].min())} - "
              f"{int(use_df['meter_reading_date'].max())}")
    else:
        print(f"  [usage] 0 readings after filtering -- usage features will be NaN")
        return df_status  # no usage data; return status unchanged

    # Sort ascending (oldest first → f1, newest last → f6)
    use_df = use_df.sort_values(["water_supply_number", "meter_reading_date"])

    # ── Pivot to f1..f6 ──────────────────────────────────────────────────────
    pivot_rows = []
    for wn, grp in use_df.groupby("water_supply_number", sort=False):
        # Take last N_USAGE_PERIODS readings (oldest→newest = f1→f6)
        tail = grp.tail(N_USAGE_PERIODS)
        row: dict = {"water_supply_number": wn}
        for i, (_, r) in enumerate(tail.iterrows(), 1):
            row[f"suido_usage_f{i}"]         = r["suido_usage"]
            row[f"meter_reading_date_f{i}"]  = r["meter_reading_date"]
        pivot_rows.append(row)

    usage_pivot = pd.DataFrame(pivot_rows)

    # ── Clip negative usage values (physically impossible; data entry errors) ─
    usage_pivot[USAGE_F_COLS] = usage_pivot[USAGE_F_COLS].clip(lower=0)

    # ── Aggregate statistics ──────────────────────────────────────────────────
    u = usage_pivot[USAGE_F_COLS].astype(float)

    usage_pivot["total_water_usage"] = u.sum(axis=1)
    usage_pivot["max_water_usage"]   = u.max(axis=1)
    usage_pivot["avg_water_usage"]   = u.mean(axis=1)

    # flag: any 4 consecutive reading periods all zero
    usage_pivot["flag_zero_usage_over4consecutivemonths"] = _flag_4consecutive_zeros(u)

    # change rate: last 4 periods vs first 2 periods
    # (proxy for "recent drop in usage")
    has_early = u.iloc[:, :2].notna().any(axis=1)
    early_avg = u.iloc[:, :2].mean(axis=1)
    late_avg  = u.iloc[:, 2:].mean(axis=1)
    usage_pivot["change_rate_waterusage_over_last4months"] = np.where(
        has_early & (early_avg > 0),
        (late_avg - early_avg) / early_avg,
        np.nan,
    )

    # average usage per person placeholder (filled after juki join)
    # — computed in pipeline.py after household_size is available

    print(f"  [usage] Pivot complete: {len(usage_pivot):,} meters with usage data")

    # ── Join back to status ───────────────────────────────────────────────────
    result = df_status.merge(usage_pivot, on="water_supply_number", how="left")

    # Meters with no usage data get NaN for all f columns
    n_with_usage = result[USAGE_F_COLS[0]].notna().sum()
    print(f"  [usage] Meters with usage data: {n_with_usage:,} / {len(result):,} "
          f"({n_with_usage/len(result):.1%})")
    return result


def _flag_4consecutive_zeros(u: pd.DataFrame) -> pd.Series:
    """Return 1 where any 4 consecutive columns in u are all zero."""
    arr = u.to_numpy(dtype=float)
    n_cols = arr.shape[1]
    flag = np.zeros(len(arr), dtype=int)
    for start in range(n_cols - 3):
        window = arr[:, start:start + 4]
        all_zero = (window == 0).all(axis=1) & (~np.isnan(window).any(axis=1))
        flag |= all_zero.astype(int)
    return pd.Series(flag, index=u.index)
