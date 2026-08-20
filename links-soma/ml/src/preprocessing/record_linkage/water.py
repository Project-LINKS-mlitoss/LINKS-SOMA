"""Water meter data loading and usage aggregation.

Step 1: Load 1_水道開閉栓状況.csv → normalize address, derive disconnection flag.
Step 2: Load 2_水道使用量.csv → join to status, create f1..f6 and aggregates.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from src.preprocessing.address_utils import CleanData
from src.preprocessing.date_normalize import normalize_date_series
from src.preprocessing.import_validation import (
    JoinKeyTypeMismatchError,
    ensure_required_columns,
    read_csv_checked,
)


# ── Date helpers ──────────────────────────────────────────────────────────────


def _normalize_date_series(series: pd.Series) -> pd.Series:
    """日付列を YYYYMMDD float へ正規化する（不能は NaN）。

    受理形式の単一の真実は date_normalize.normalize_date_series（8桁/区切り/年月日/和暦）。
    事後バリ DTYPE_DATE も同じ関数で判定するため、本体と検査の受理集合が必ず一致する。
    """
    return normalize_date_series(series)


# ── Constants ─────────────────────────────────────────────────────────────────

N_USAGE_PERIODS = 6   # number of reading-period slots (f1=oldest, f6=newest)

USAGE_PERIOD_MONTHS = 2  # 1区間の長さ。6区間で基準日から遡って1年分になる

# Canonical output column names
USAGE_F_COLS = [f"suido_usage_f{i}" for i in range(1, N_USAGE_PERIODS + 1)]
DATE_F_COLS  = [f"meter_reading_date_f{i}" for i in range(1, N_USAGE_PERIODS + 1)]


def usage_window_start(standard_date: pd.Timestamp) -> pd.Timestamp:
    """使用量の集計窓の下限を返す。窓は [下限, 基準日] の閉区間。

    上限を基準日そのものに置くため、月末が基準日でも直近の検針を落とさない。
    下限は usage_period_bounds の f1 区間の始まりと一致する。
    """
    return (
        standard_date
        - pd.DateOffset(months=USAGE_PERIOD_MONTHS * N_USAGE_PERIODS)
        + pd.Timedelta(days=1)
    )


def usage_period_bounds(standard_date: pd.Timestamp) -> list[tuple[int, int]]:
    """f1..f6 の各区間を YYYYMMDD の閉区間 [始まり, 終わり] で返す。

    基準日を終端に 2ヶ月ずつ遡って6区間に割る。f6 が基準日直前の2ヶ月、
    f1 が11・12ヶ月前。列名（検針水量（推定月の11・12ヶ月前）〜（1・2ヶ月前））が
    示す期間そのもの。区間は隙間なく連続し、合わせて集計窓を覆う。
    """
    bounds = []
    for i in range(1, N_USAGE_PERIODS + 1):
        months_back = USAGE_PERIOD_MONTHS * (N_USAGE_PERIODS - i)
        end = standard_date - pd.DateOffset(months=months_back)
        start = (
            standard_date
            - pd.DateOffset(months=months_back + USAGE_PERIOD_MONTHS)
            + pd.Timedelta(days=1)
        )
        bounds.append((int(start.strftime("%Y%m%d")), int(end.strftime("%Y%m%d"))))
    return bounds


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

    df = read_csv_checked(path, low_memory=False)
    # Rename to canonical names
    df = df.rename(columns=src_col)
    # 必須カラム未指定(E-101): 以降の無条件アクセス前に検査して明示停止する
    ensure_required_columns(df.columns, "suido_status")
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
) -> tuple[pd.DataFrame, str]:
    """Load 2_水道使用量.csv, attach to status, and compute f1..f6 + aggregates.

    Args:
        city_cfg: City configuration dict.
        data_dir: Path to city data directory.
        df_status: DataFrame from load_water_status().

    Returns:
        (df_status augmented with usage columns, coverage status).
        coverage status:
          - "no_files": 使用量ファイルが未指定（欠損ではない。警告しない）。
          - "deficit":  ファイルはあるが集計窓に検針が1件も無い（完全欠損 E-0020）。
          - "ok":       使用量特徴量を付与できた。

    集計対象は [usage_window_start(standard_date), standard_date] の検針のみ。
    各検針は検針年月日から usage_period_bounds の区間へ入る（f6 が基準日直前の2ヶ月、
    f1 が11・12ヶ月前）。窓の外の検針は使わないため、窓に検針が無い水道番号は
    使用量列が全て NaN になり、使用量データは紐付かない。
    """
    use_cfg  = city_cfg["suido_use"]
    use_cols = use_cfg["columns"]
    src_col  = {v: k for k, v in use_cols.items()}

    # Load usage file(s)
    frames = []
    for fname in use_cfg["files"]:
        p = data_dir / fname
        if p.exists():
            frames.append(read_csv_checked(p, low_memory=False))
        else:
            print(f"  [usage] Warning: {p} not found, skipping")
    if not frames:
        print("  [usage] No usage files found -- skipping")
        return df_status, "no_files"

    use_df = pd.concat(frames, ignore_index=True)
    use_df = use_df.rename(columns=src_col)
    # 必須カラム未指定(E-101): 直後の列抽出が KeyError になる前に明示停止する
    ensure_required_columns(use_df.columns, "suido_use")
    use_df = use_df[["water_supply_number", "meter_reading_date", "suido_usage"]].copy()
    use_df["suido_usage"] = pd.to_numeric(use_df["suido_usage"], errors="coerce")
    # 検針日は日付（網羅表: 水道検針年月日=日付形式）。正準正規化で和暦/区切り/年月日も救済する。
    use_df["meter_reading_date"] = normalize_date_series(use_df["meter_reading_date"])

    # ── Filter to the reference window: readings within one year up to 基準日 ──
    if standard_date is not None:
        window_start = usage_window_start(standard_date)
        lower = int(window_start.strftime("%Y%m%d"))
        cutoff = int(standard_date.strftime("%Y%m%d"))
        n_before = len(use_df)
        use_df = use_df[
            (use_df["meter_reading_date"] >= lower)
            & (use_df["meter_reading_date"] <= cutoff)
        ]
        n_after = len(use_df)
        pct = n_after / max(1, n_before)
        if n_after == 0:
            print(f"  [usage] [!] WARNING: 0 readings in {window_start.date()} - "
                  f"{standard_date.date()} (all {n_before:,} readings fall outside "
                  f"the reference window). Usage features will be NaN.")
        else:
            print(f"  [usage] Filtered to {window_start.date()} - {standard_date.date()}: "
                  f"{n_after:,} / {n_before:,} readings kept ({pct:.0%})")

    if len(use_df) > 0:
        print(f"  [usage] {len(use_df):,} readings | "
              f"meters: {use_df['water_supply_number'].nunique():,} | "
              f"date range: {int(use_df['meter_reading_date'].min())} - "
              f"{int(use_df['meter_reading_date'].max())}")
    else:
        print(f"  [usage] 0 readings after filtering -- usage features will be NaN")
        # 完全欠損（E-0020）: ファイルはあるが集計窓に検針が1件も無い。使用量特徴量は全件 NaN。
        return df_status, "deficit"

    # ── 各検針を検針年月日から f1..f6 の区間へ入れる ──────────────────────────
    # 詰め順ではなく実年月で決める。列名（検針水量（推定月の11・12ヶ月前）〜
    # （1・2ヶ月前））が示す期間と中身を一致させるため。検針が無い区間は NaN。
    if standard_date is not None:
        period = pd.Series(np.nan, index=use_df.index)
        for i, (lo, hi) in enumerate(usage_period_bounds(standard_date), 1):
            in_period = (use_df["meter_reading_date"] >= lo) & (use_df["meter_reading_date"] <= hi)
            period = period.mask(in_period, i)
    else:
        # 基準日が無いと区間の位置が決まらない。水道番号ごとに新しい順で最大6件を取り、
        # 最も新しい検針を f6 に置く。列名が示す期間との一致は保証されない。
        print("  [usage] [!] WARNING: 基準日が未指定のため、検針を新しい順に6件詰める。"
              "検針水量の各項目は列名が示す期間と一致しない。")
        rank = (use_df.sort_values(["water_supply_number", "meter_reading_date"])
                      .groupby("water_supply_number")["meter_reading_date"]
                      .rank(method="first", ascending=False))
        period = (N_USAGE_PERIODS + 1 - rank).where(rank <= N_USAGE_PERIODS)
    use_df = use_df.assign(_period=period)

    # 検針周期が1区間より短い自治体では1区間に複数の検針が入る。使用水量は合計して
    # 「その2ヶ月の使用量」に揃える（隔月検針の1件と同じ意味にする）。min_count=1 は
    # 全件 NaN の区間を 0 でなく NaN のままにするため：0 は「使用量ゼロ」という
    # 空き家の強い手掛かりであり、未検針と区別する必要がある。
    grouped = use_df.groupby(["water_supply_number", "_period"])
    agg = pd.DataFrame({
        "suido_usage": grouped["suido_usage"].sum(min_count=1),
        "meter_reading_date": grouped["meter_reading_date"].max(),
    }).reset_index()

    u_wide = agg.pivot(index="water_supply_number", columns="_period", values="suido_usage")
    d_wide = agg.pivot(index="water_supply_number", columns="_period", values="meter_reading_date")
    u_wide.columns = [f"suido_usage_f{int(c)}" for c in u_wide.columns]
    d_wide.columns = [f"meter_reading_date_f{int(c)}" for c in d_wide.columns]
    # 検針が無い区間の列は生成されない。以降の列アクセスが成立するよう確保する。
    usage_pivot = (
        pd.concat([u_wide, d_wide], axis=1)
        .reindex(columns=USAGE_F_COLS + DATE_F_COLS)
        .reset_index()
    )

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
    # 結合キーの型不一致(E-103): 水道番号の項目に別種の列（住所等）を割り当てると、片側だけが
    # 文字列になり pandas が ValueError を投げる。捕捉せずに抜けると不明エラーになるため、
    # 関与ファイルと結合キーを積んだ明示停止へ変換する。
    try:
        result = df_status.merge(usage_pivot, on="water_supply_number", how="left")
    except ValueError as exc:
        # pandas の MergeError も ValueError を継承するため、両側の型が実際に食い違うことを
        # 確かめてから変換する。同型どうしで起きた ValueError は型不一致ではないので、
        # 誤った案内（「同じ種類の値が入る列か確認」）を出さずそのまま投げ直す。
        left_dtype = df_status["water_supply_number"].dtype
        right_dtype = usage_pivot["water_supply_number"].dtype
        if left_dtype == right_dtype:
            raise
        raise JoinKeyTypeMismatchError(
            ["suido_status", "suido_use"], "water_supply_number"
        ) from exc

    # Meters with no usage data get NaN for all f columns
    n_with_usage = result[USAGE_F_COLS[0]].notna().sum()
    print(f"  [usage] Meters with usage data: {n_with_usage:,} / {len(result):,} "
          f"({n_with_usage/len(result):.1%})")
    # 部分欠損（一部メーターのみ使用量が付く）の警告閾値は未定（既知ギャップ・網羅表 R-020b）。
    return result, "ok"


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
