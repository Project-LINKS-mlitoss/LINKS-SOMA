"""Residential registry (住基) event feature engineering.

Extracts vacancy-predictive signals from the per-person transfer reason and
move_date columns (reason_transfer_N_juki_residence, move_date_N_juki_residence).

Key features:
  - has_death_event / has_cancellation_event — any NG event in the household
  - years_since_last_transfer — elapsed years since the last move_date (住定日).
    move_date is unaffected by administrative batch updates (e.g. My Number),
    so no reason-based filtering is needed.
  - sole_elderly_resident — single elderly person (high post-death vacancy risk)
  - death_no_replacement — death with no subsequent in-migrants
  - household_shrinkage_rate — outmigrants / household_size
"""

from __future__ import annotations

import numpy as np
import pandas as pd


N_SLOTS = 11  # number of reason/move_date pivot slots


def _reason_cols(df: pd.DataFrame) -> list[str]:
    return [c for c in (
        f"reason_transfer_{i}_juki_residence" for i in range(1, N_SLOTS + 1)
    ) if c in df.columns]


def _move_date_cols(df: pd.DataFrame) -> list[str]:
    return [c for c in (
        f"move_date_{i}_juki_residence" for i in range(1, N_SLOTS + 1)
    ) if c in df.columns]


def _contains_keyword(series: pd.Series, keyword: str) -> pd.Series:
    return series.astype(str).str.contains(keyword, na=False)


def _parse_yyyymmdd(series: pd.Series) -> pd.Series:
    """Convert date column to datetime (NaT on failure/NaN)."""
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
        if "/" in s:
            parts = s.split("/")
            if len(parts) == 3:
                try:
                    y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                    return pd.Timestamp(year=y, month=m, day=d)
                except Exception:
                    return pd.NaT
        try:
            v = int(float(s))
            return pd.to_datetime(str(v), format="%Y%m%d", errors="coerce")
        except Exception:
            return pd.NaT
    return series.map(_to_ts)


def add_juki_features(df: pd.DataFrame, reference_date: pd.Timestamp) -> pd.DataFrame:
    """Add residential-registry event features to df (in-place) and return it.

    Args:
        df: Training DataFrame from preprocessed_new.csv.
        reference_date: Reference "today" for duration calculations.

    Returns:
        df with new columns added.
    """
    reason_cols    = _reason_cols(df)
    move_date_cols = _move_date_cols(df)
    added = []

    # INFO-1: Cap residence_duration at 100 years — older values are historical artifacts
    if "residence_duration_juki_residence" in df.columns:
        df["residence_duration_juki_residence"] = (
            df["residence_duration_juki_residence"].clip(upper=36500)
        )

    # ── 0. Cap household_size at 20 ───────────────────────────────────────────
    # Address-level juki aggregation can produce very large values (max > 1000)
    # when many households share the same normalized address (e.g. apartment block
    # with 丁目-level address). Values > 20 are not meaningful for single-building
    # vacancy estimation and would confuse the model.
    _HH_CAP = 20
    if "household_size_juki_residence" in df.columns:
        df["household_size_juki_residence"] = (
            df["household_size_juki_residence"].clip(upper=_HH_CAP)
        )

    # ── 1. Null flag for max_age ──────────────────────────────────────────────
    if "max_age_juki_residence" in df.columns:
        df["max_age_juki_residence_isnull"] = df["max_age_juki_residence"].isna().astype(int)
        added.append("max_age_juki_residence_isnull")

    # ── 2. Event flags from reason_transfer columns ───────────────────────────
    if reason_cols:
        reason_df = df[reason_cols]
        df["has_death_event"] = reason_df.apply(
            lambda col: _contains_keyword(col, "死亡")
        ).any(axis=1).astype(int)
        # 照合語は num_cancellations_juki_residence（record_linkage/juki.py の「消除」）
        # より狭い。「消除」に広げると死亡消除・転出消除も立ち、本列はモデルの説明変数
        # （app/src/features/model/constants.ts）のためプリセットモデル再学習が要る。
        df["has_cancellation_event"] = reason_df.apply(
            lambda col: _contains_keyword(col, "職権消除")
        ).any(axis=1).astype(int)
        df["num_outmigrant_events"] = reason_df.apply(
            lambda col: _contains_keyword(col, "転出")
        ).sum(axis=1).astype(float)
    else:
        df["has_death_event"] = 0
        df["has_cancellation_event"] = 0
        df["num_outmigrant_events"] = np.nan
    added += ["has_death_event", "has_cancellation_event", "num_outmigrant_events"]

    # ── 3. Latest move_date → years since last transfer ──────────────────────
    # move_date（住定日）は行政イベント（マイナンバー一括更新等）の影響を受けないため、
    # reason_transfer によるフィルタリングは不要。
    if move_date_cols:
        parsed_parts = []
        for md_col in move_date_cols:
            parsed = _parse_yyyymmdd(df[md_col])
            # 未来の住定日はマスク（reference_date 以降のイベントは未発生扱い）
            parsed = parsed.where(parsed <= reference_date)
            parsed_parts.append(parsed)
        latest_move = pd.concat(parsed_parts, axis=1).max(axis=1)
        days_since = (reference_date - latest_move).dt.days
        df["years_since_last_transfer"] = np.where(
            latest_move.notna(), days_since / 365.25, np.nan
        )
        df["years_since_last_transfer_is_missing"] = (
            df["years_since_last_transfer"].isna().astype(int)
        )
    else:
        df["years_since_last_transfer"] = np.nan
        df["years_since_last_transfer_is_missing"] = 1
    added += ["years_since_last_transfer", "years_since_last_transfer_is_missing"]

    # ── 4. Sole elderly resident ──────────────────────────────────────────────
    if "household_size_juki_residence" in df.columns and "max_age_juki_residence" in df.columns:
        sole    = (df["household_size_juki_residence"] == 1)
        elderly = (df["max_age_juki_residence"] >= 65)
        df["sole_elderly_resident"] = (sole & elderly).astype(int)
    else:
        df["sole_elderly_resident"] = 0
    added.append("sole_elderly_resident")

    # ── 5. Death with no replacement ─────────────────────────────────────────
    if "num_inmigrants_juki_residence" in df.columns:
        df["death_no_replacement"] = (
            (df["has_death_event"] == 1) &
            (df["num_inmigrants_juki_residence"].fillna(0) == 0)
        ).astype(int)
    else:
        df["death_no_replacement"] = df["has_death_event"]
    added.append("death_no_replacement")

    # ── 6. Household shrinkage rate ───────────────────────────────────────────
    if "num_outmigrants_relocations_juki_residence" in df.columns:
        # 世帯人数が不明な行は縮小率を出せない。1人と仮定すると 0.0 になり、
        # 転出者がいた住所でも「誰も出ていない安定した世帯」を示す値になる。
        outmig = df["num_outmigrants_relocations_juki_residence"].fillna(0)
        hsize  = pd.to_numeric(
            df.get("household_size_juki_residence", pd.Series(np.nan, index=df.index)),
            errors="coerce",
        )
        df["household_shrinkage_rate"] = (
            outmig / hsize.clip(lower=1)
        ).where(hsize.notna())
    else:
        df["household_shrinkage_rate"] = np.nan
    added.append("household_shrinkage_rate")

    print(f"  [juki] Added {len(added)} features | rows: {len(df):,}")
    return df
