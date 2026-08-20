"""Residential registry (住民基本台帳) loading, aggregation and address matching.

Aggregates per-person snapshot records into current household state per address.

Key design principles (2026-03-26 rewrite):
  - Data is snapshot-type: each record represents ONE person
  - Aggregation targets records forming one household per address
    (see filter_single_household_addresses)
  - Group by (household_code, address) → then aggregate to address level
  - household_size_juki_residence = people settled before cutoff
    MINUS people who departed (転出/死亡) before cutoff
  - ALL person counts exclude people with 住定日 > 基準日
  - num_householdsize_after_changes_juki_residence is REMOVED
    (household_size already accounts for departures)
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from src.preprocessing.address_utils import CleanData
from src.preprocessing.date_normalize import normalize_date_series
from src.preprocessing.import_validation import (
    ensure_required_columns,
    read_csv_checked,
)


N_TRANSFER_SLOTS = 11  # max pivoted transfer-event columns per address

# Fallback reference year when standard_date is not provided
_REF_YEAR = 2024

# Departure reasons used for household size subtraction
_DEPARTURE_REASONS = ("転出", "死亡")

# 住所未入力を正規化した結果。CleanData.normalize_series が空欄・None・NaN を返す形。
_BLANK_ADDRESSES = ("", "None", "nan")


def _slash_date_to_yyyymmdd(val) -> str | float:
    """Convert YYYY/M/D (snapshot format) to YYYYMMDD string."""
    if pd.isna(val):
        return float("nan")
    s = str(val).strip()
    if "/" in s:
        parts = s.split("/")
        if len(parts) == 3:
            try:
                y, m, d = int(parts[0]), int(parts[1]), int(parts[2])
                return f"{y}{m:02d}{d:02d}"
            except Exception:
                pass
    return s


def load_juki(city_cfg: dict, data_dir: Path) -> pd.DataFrame:
    """Load juki data with canonical column names."""
    cfg     = city_cfg["juki"]
    cols    = cfg["columns"]
    src_col = {v: k for k, v in cols.items() if v is not None}
    date_fmt = cfg.get("date_format")

    df = read_csv_checked(data_dir / cfg["file"], low_memory=False, dtype=str)
    df = df.rename(columns=src_col)
    # 必須カラム未指定(E-101): 以降の無条件アクセス前に検査して明示停止する
    ensure_required_columns(df.columns, "juki")

    if "address_suffix" in df.columns:
        df["address"] = df["address"].fillna("") + df["address_suffix"].fillna("")

    keep = [c for c in [
        "household_code", "address", "birth_date",
        "move_date", "reason_transfer", "date_transfer",
    ] if c in df.columns]
    df = df[keep].copy()

    # date_format が明示指定されていなくても、データにスラッシュ形式が含まれていれば自動変換
    needs_slash_convert = date_fmt == "slash_ymd"
    if not needs_slash_convert and "birth_date" in df.columns:
        sample = df["birth_date"].dropna().head(100)
        needs_slash_convert = sample.str.contains("/", na=False).any()
    if needs_slash_convert:
        for date_col in ["date_transfer", "move_date", "birth_date"]:
            if date_col in df.columns:
                df[date_col] = df[date_col].map(_slash_date_to_yyyymmdd)

    df["normalized_address"] = CleanData.normalize_series(df["address"], municipality=city_cfg.get("municipality"))
    hh_col = "household_code"
    print(f"  [juki] Loaded {len(df):,} events | "
          f"households: {df[hh_col].nunique() if hh_col in df.columns else 'N/A':,} | "
          f"unique addresses: {df['normalized_address'].nunique():,}")
    return df


def _normalize_household_code(series: pd.Series) -> pd.Series:
    """世帯番号を比較用に整える。

    前後の空白を落とし、空白だけの値は未入力として NaN にする。空白だけの値を残すと
    それらが 1 つの世帯番号として束ねられ、無関係な住所どうしが同一世帯になる。
    """
    stripped = series.astype(str).str.strip()
    return stripped.where(series.notna() & (stripped != ""))


def filter_single_household_addresses(
    df: pd.DataFrame,
    addr_col: str = "normalized_address",
    hh_col: str = "household_code",
    judged_df: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """集計対象を 1 住所 1 世帯のレコードに限定する。

    住居の利用実態を把握できるのは、住所と世帯が 1 対 1 で対応するレコードに限られる。
    対応しないケースは 2 世帯住宅・住所表記の誤り・年内の転居などが混在し、実態を判別
    できないため集計から外す。

      - 同一住所に複数の世帯番号が付与されている場合は、その住所のレコードを外す
      - 世帯番号が同一で住所が異なる場合は、その世帯番号のレコードを外す

    judged_df は重複を数える母集団。基準日時点で 1 住所 1 世帯かを見るため、呼び出し側は
    その時点の在住者を渡す。省略時は df 自身で判定する。

    世帯番号または住所のカラムが無い入力では判定できないため、全レコードをそのまま返す。
    世帯番号が全件未入力の場合も同様。
    """
    if hh_col not in df.columns or addr_col not in df.columns:
        return df

    judged = df if judged_df is None else judged_df
    judged_code = _normalize_household_code(judged[hh_col])
    if not judged_code.notna().any():
        return df

    # 住所が入力されていない行は住所の種類として数えない。normalize_series が
    # 空欄・None・NaN をそれぞれ別文字列にするため、明示的に除く。
    has_addr = ~judged[addr_col].isin(_BLANK_ADDRESSES) & judged[addr_col].notna()
    pairs = pd.DataFrame({
        addr_col: judged[addr_col], hh_col: judged_code,
    })[judged_code.notna() & has_addr]
    codes_per_addr = pairs.groupby(addr_col)[hh_col].nunique()
    addrs_per_code = pairs.groupby(hh_col)[addr_col].nunique()
    multi_code_addrs = codes_per_addr[codes_per_addr >= 2].index
    multi_addr_codes = addrs_per_code[addrs_per_code >= 2].index

    df_code = _normalize_household_code(df[hh_col])
    excluded = df[addr_col].isin(multi_code_addrs) | (
        df_code.notna() & df_code.isin(multi_addr_codes)
    )
    if not excluded.any():
        return df

    print(f"  [juki] Excluded {int(excluded.sum()):,} records not forming "
          f"one household per address "
          f"(addresses: {len(multi_code_addrs):,}, "
          f"household codes: {len(multi_addr_codes):,})")
    return df[~excluded].copy()


def _to_num(series: pd.Series) -> pd.Series:
    """日付文字列/数値を YYYYMMDD float に変換する（不能は NaN）。

    受理形式の単一の真実は date_normalize.normalize_date_series（8桁/区切り/年月日/和暦）。
    事後バリ DTYPE_DATE も同じ関数で判定するため、本体と検査の受理集合が必ず一致する。
    """
    return normalize_date_series(series)


def filter_settled_before_cutoff(
    df: pd.DataFrame,
    cutoff: int,
    move_num_col: str = "_move_num",
) -> pd.DataFrame:
    """住定日 <= 基準日 のレコードにフィルタする。

    住定日が基準日より後の人は全てのカウントから除外する。
    """
    if cutoff >= 99_999_999:
        return df.copy()
    mask = df[move_num_col].notna() & (df[move_num_col] <= cutoff)
    return df[mask].copy()


def calculate_household_size(
    settled_df: pd.DataFrame,
    cutoff: int,
    addr_col: str = "normalized_address",
    date_num_col: str = "_date_num",
) -> pd.Series:
    """世帯人数を計算する（人数ベース）。

    Logic:
      1. (household_code, address) でグループ化
      2. 住定日 <= 基準日 のレコード数をベースカウント（settled_df は既にフィルタ済み）
      3. 異動日 <= 基準日 AND 異動事由 ∈ {転出, 死亡} の人を departed として引く
      4. address レベルに集約（世帯code 間で合算）
    """
    if len(settled_df) == 0:
        return pd.Series(dtype=int, name="household_size_juki_residence")

    temp = settled_df.copy()

    # departed: 異動事由 ∈ {転出, 死亡} AND 異動日 <= cutoff
    reasons = temp["reason_transfer"].astype(str)
    departure_pattern = "|".join(_DEPARTURE_REASONS)
    has_departure_reason = reasons.str.contains(
        departure_pattern, na=False, regex=True
    )
    if cutoff < 99_999_999:
        has_departed_date = temp[date_num_col].notna() & (
            temp[date_num_col] <= cutoff
        )
    else:
        has_departed_date = temp[date_num_col].notna()
    temp["_is_departed"] = has_departure_reason & has_departed_date

    # (household_code, address) でグループ化（household_code があれば）
    has_hh = (
        "household_code" in temp.columns and temp["household_code"].notna().any()
    )
    group_cols = ["household_code", addr_col] if has_hh else [addr_col]

    base_count = temp.groupby(group_cols).size()
    departed_count = temp.groupby(group_cols)["_is_departed"].sum()
    hh_size = (base_count - departed_count).clip(lower=0).astype(int)

    # (household_code, addr) → addr に集約
    if has_hh:
        hh_size = hh_size.groupby(addr_col).sum()

    return hh_size.rename("household_size_juki_residence")


def calculate_event_counts(
    settled_df: pd.DataFrame,
    cutoff: int,
    addr_col: str = "normalized_address",
    date_num_col: str = "_date_num",
) -> pd.DataFrame:
    """イベント種別ごとのカウントを集約する。

    全カウントは住定日 <= 基準日のレコードのみ対象（settled_df は既にフィルタ済み）。
    死亡・転出・消除は追加で異動日 <= 基準日を条件とする。
    転出カウントは「転出」のみ（「転居」は含めない）。ADR-0016参照。
    """
    if len(settled_df) == 0:
        return pd.DataFrame(
            columns=[
                "num_deaths_juki_residence",
                "num_inmigrants_juki_residence",
                "num_outmigrants_relocations_juki_residence",
                "num_cancellations_juki_residence",
            ],
            dtype=int,
        )

    temp = settled_df.copy()
    reasons = temp["reason_transfer"].astype(str)

    # 死亡・転出・消除は異動日 <= cutoff を追加条件とする
    if cutoff < 99_999_999:
        before_cutoff = temp[date_num_col].notna() & (temp[date_num_col] <= cutoff)
    else:
        before_cutoff = pd.Series(True, index=temp.index)

    temp["_is_death"] = (
        reasons.str.contains("死亡", na=False) & before_cutoff
    ).astype(int)

    # 転入: 住定日 <= cutoff で十分（settled_df で既にフィルタ済み）
    temp["_is_inmig"] = reasons.str.contains("転入|出生", na=False).astype(int)

    # 転出のみカウント（「転居」は含めない。ADR-0016）
    temp["_is_outmig"] = (
        reasons.str.contains("転出", na=False) & before_cutoff
    ).astype(int)

    # 「消除」は死亡消除・転出消除も拾う。本列は表示・出力専用でモデルは読まないため
    # 影響は表示値に限る。has_cancellation_event（features/juki.py）は「職権消除」で
    # 照合しており、語が一致しない。
    temp["_is_cancel"] = (
        reasons.str.contains("消除", na=False) & before_cutoff
    ).astype(int)

    return temp.groupby(addr_col).agg(
        num_deaths_juki_residence=("_is_death", "sum"),
        num_inmigrants_juki_residence=("_is_inmig", "sum"),
        num_outmigrants_relocations_juki_residence=("_is_outmig", "sum"),
        num_cancellations_juki_residence=("_is_cancel", "sum"),
    )


def calculate_age_stats(
    active_df: pd.DataFrame,
    ref_year: int,
    addr_col: str = "normalized_address",
) -> pd.DataFrame:
    """active residents（住定済み ∩ 未転出/未死亡）の年齢統計を集約する。"""
    if len(active_df) == 0:
        return pd.DataFrame(
            columns=[
                "max_age_juki_residence",
                "over_65_count_juki_residence",
                "under_15_count_juki_residence",
            ],
            dtype=float,
        )

    temp = active_df.copy()
    # 生年月日は日付（網羅表: 生年月日=日付形式・和暦/西暦）。正準正規化で YYYYMMDD float 化し、
    # 上位4桁を年として取る。
    temp["_birth_year"] = (
        _to_num(temp["birth_date"])
        .floordiv(10000)
        .astype("Int64")
    )
    valid = temp[
        (temp["_birth_year"] > 1900) & temp["_birth_year"].notna()
    ].copy()
    valid["_age"] = ref_year - valid["_birth_year"].astype(int)
    valid = valid[(valid["_age"] >= 0) & (valid["_age"] <= 120)].copy()

    if len(valid) == 0:
        return pd.DataFrame(
            columns=[
                "max_age_juki_residence",
                "over_65_count_juki_residence",
                "under_15_count_juki_residence",
            ],
            dtype=float,
        )

    return valid.groupby(addr_col).agg(
        max_age_juki_residence=("_age", "max"),
        over_65_count_juki_residence=("_age", lambda x: int((x >= 65).sum())),
        under_15_count_juki_residence=("_age", lambda x: int((x <= 15).sum())),
    )


def _get_active_residents(
    settled_df: pd.DataFrame,
    cutoff: int,
    date_num_col: str = "_date_num",
) -> pd.DataFrame:
    """住定済み ∩ 未転出/未死亡 のレコードを返す。

    Active = 住定日 <= cutoff AND NOT (異動事由 ∈ {転出, 死亡} AND 異動日 <= cutoff)
    """
    reasons = settled_df["reason_transfer"].astype(str)
    departure_pattern = "|".join(_DEPARTURE_REASONS)
    has_departure_reason = reasons.str.contains(
        departure_pattern, na=False, regex=True
    )
    if cutoff < 99_999_999:
        has_departed_date = settled_df[date_num_col].notna() & (
            settled_df[date_num_col] <= cutoff
        )
    else:
        has_departed_date = settled_df[date_num_col].notna()
    is_departed = has_departure_reason & has_departed_date
    return settled_df[~is_departed].copy()


def aggregate_juki(
    juki_df: pd.DataFrame,
    standard_date: pd.Timestamp | None = None,
) -> pd.DataFrame:
    """Aggregate per-person juki records into one row per unique address.

    snapshot形式のみ対応（ADR-0016）。デデュプなし・転出のみカウント。

    Logic:
      0. 1 住所 1 世帯のレコードに限定
      1. 住定日 <= 基準日 でフィルタ
      2. household_size = settled_count - departed_count per (household_code, addr)
      3. event counts（住定日 <= 基準日 のレコードのみ）
      4. age stats from active residents（住定済み ∩ 未転出/未死亡）

    Output columns per address:
      juki_residence_flag = 1
      household_size_juki_residence  ← 世帯人数 (settled - departed)
      max_age_juki_residence         ← oldest active resident's age
    """
    ref_year = standard_date.year if standard_date is not None else _REF_YEAR
    cutoff = (
        int(standard_date.strftime("%Y%m%d")) if standard_date is not None
        else 99_999_999
    )

    df = juki_df.copy()
    addr_col = "normalized_address"

    # ── 数値日付変換 ──────────────────────────────────────────────
    df["_date_num"] = _to_num(df["date_transfer"])  # 異動日
    df["_move_num"] = _to_num(df["move_date"])       # 住定日

    # ── 1 住所 1 世帯のレコードに限定 ──────────────────────────────
    # 判定は基準日時点の在住者で行う。基準日より後に住定した人と、転出・死亡済みの人は
    # 基準日時点の世帯として数えない。
    settled = filter_settled_before_cutoff(df, cutoff, "_move_num")
    kept = filter_single_household_addresses(
        df, addr_col, judged_df=_get_active_residents(settled, cutoff)
    )
    if len(kept) != len(df):
        df = kept
        settled = filter_settled_before_cutoff(df, cutoff, "_move_num")

    # ── 住定日 <= 基準日 の除外件数 ────────────────────────────────
    n_excluded = len(df) - len(settled)
    if n_excluded > 0:
        print(f"  [juki] Excluded {n_excluded:,} records with 住定日 > {cutoff} "
              f"(future settlement)")

    # ── 世帯人数 ──────────────────────────────────────────────────
    hh_size_s = calculate_household_size(settled, cutoff, addr_col)

    # ── イベントカウント ──────────────────────────────────────────
    event_counts = calculate_event_counts(
        settled, cutoff, addr_col
    )

    # ── 年齢統計（active residents のみ）──────────────────────────
    active = _get_active_residents(settled, cutoff)
    age_agg = calculate_age_stats(active, ref_year, addr_col)

    # ── 居住期間（active residents の最古の住定日からの日数）───────
    if "move_date" in df.columns and standard_date is not None:
        active_with_move = active.copy()
        active_with_move["_move_num_dur"] = _to_num(active_with_move["move_date"])
        valid_moves = active_with_move[
            active_with_move["_move_num_dur"].notna()
            & (active_with_move["_move_num_dur"] > 0)
            & (active_with_move["_move_num_dur"] <= cutoff)
        ]
        oldest_move = valid_moves.groupby(addr_col)["_move_num_dur"].min()

        def _to_days(num_date: float) -> float:
            try:
                dt = pd.to_datetime(str(int(num_date)), format="%Y%m%d")
                return float((standard_date - dt).days)
            except Exception:
                return np.nan

        res_dur = oldest_move.map(_to_days).rename("residence_duration_juki_residence")
    else:
        res_dur = pd.Series(dtype=float, name="residence_duration_juki_residence")

    # ── 結合 ──────────────────────────────────────────────────────
    combined = (
        hh_size_s.to_frame()
        .join(event_counts, how="left")
        .join(age_agg, how="left")
        .join(res_dur, how="left")
    )
    combined["juki_residence_flag"] = 1
    # 集計対象が0件のとき、空の Series 由来で index 名が失われる
    combined.index.name = addr_col

    # ── Pivot: 最新N件のイベントをカラム展開 ──────────────────────
    if cutoff < 99_999_999:
        df_pivot = df[df["_date_num"].isna() | (df["_date_num"] <= cutoff)].copy()
        n_future_events = len(df) - len(df_pivot)
        if n_future_events > 0:
            print(f"  [juki] Excluded {n_future_events:,} future events from pivot "
                  f"(date_transfer > {cutoff})")
    else:
        df_pivot = df

    pivot_rows = []
    for addr, grp in df_pivot.groupby(addr_col, sort=False):
        top = grp.head(N_TRANSFER_SLOTS)
        row: dict = {"normalized_address": addr}
        for i, (_, ev) in enumerate(top.iterrows(), 1):
            row[f"reason_transfer_{i}_juki_residence"] = ev.get("reason_transfer")
            row[f"date_transfer_{i}_juki_residence"] = ev.get("date_transfer")
            row[f"birth_date_{i}_juki_residence"] = ev.get("birth_date")
            row[f"move_date_{i}_juki_residence"] = ev.get("move_date")
        pivot_rows.append(row)

    # 全レコードが対象外なら pivot_rows は空になり、列が作られないため明示する
    pivot_df = pd.DataFrame(
        pivot_rows, columns=None if pivot_rows else ["normalized_address"]
    ).set_index("normalized_address")

    agg = combined.join(pivot_df, how="left")
    print(f"  [juki] Aggregated {len(agg):,} unique addresses")
    return agg


def match_juki_to_water(df_water: pd.DataFrame, juki_agg: pd.DataFrame) -> pd.DataFrame:
    """Left-join juki aggregate to water meter DataFrame by normalized_address."""
    result = df_water.merge(
        juki_agg.reset_index(),
        on="normalized_address",
        how="left",
    )
    result["juki_residence_flag"] = result["juki_residence_flag"].fillna(0).astype(int)

    n_matched = (result["juki_residence_flag"] == 1).sum()
    n_total   = len(result)
    print(f"  [juki] Match rate: {n_matched:,} / {n_total:,} ({n_matched/n_total:.1%})")
    return result
