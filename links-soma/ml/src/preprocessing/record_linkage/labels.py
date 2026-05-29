"""Vacancy label assignment from municipality survey data.

Loads akiya_survey files, normalizes their addresses, and joins to the
water meter DataFrame by exact normalized address match.

PU Learning convention:
  is_vacant = 1  → confirmed vacant (Positive)
  is_vacant = 0  → unlabeled (not confirmed, may or may not be vacant)
"""

from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from src.preprocessing.address_utils import CleanData


def _strip_city_prefix(series: pd.Series, prefix: str) -> pd.Series:
    """Remove leading prefecture/city prefix from addresses before normalizing.

    e.g. "愛知県豊田市トヨタ町15" → "トヨタ町15"
    This helps match akiya_survey addresses (which include full prefecture)
    to water meter addresses (which are typically city-relative).
    """
    return series.str.replace(f"^{prefix}", "", regex=True)


def load_labels_toyota(city_cfg: dict, data_dir: Path) -> pd.DataFrame:
    """Load 豊田市 akiya_r5.csv vacancy labels.

    Applies the filters specified in the 豊田市 survey requirements:
      - 契約状態 == "撤去済": exclude (meter already removed — not a vacancy candidate)
      - 建物種別 != "戸建て": exclude (only detached houses are in scope)
      - 管理状態 == "管理": exclude (actively managed buildings are out of scope)

    Ref: CLAUDE.md 豊田市 ②クレンジング処理済の空き家調査結果
    """
    lcfg = city_cfg["labels"]
    df = pd.read_csv(data_dir / lcfg["file"], low_memory=False, dtype=str)
    n_before = len(df)

    # Filter 1: 契約状態=撤去済 を除外
    if "契約状態" in df.columns:
        mask_keiyaku = df["契約状態"].str.strip() != "撤去済"
        df = df[mask_keiyaku]
        print(f"  [labels/toyota] 契約状態=撤去済 除外: {n_before - len(df):,} records removed")

    # Filter 2: 建物種別=戸建て のみ残す
    n = len(df)
    if "建物種別" in df.columns:
        mask_tatemono = df["建物種別"].str.strip() == "戸建て"
        df = df[mask_tatemono]
        print(f"  [labels/toyota] 建物種別!=戸建て 除外: {n - len(df):,} records removed")

    # Filter 3: 管理状態=管理 を除外
    n = len(df)
    if "管理状態" in df.columns:
        mask_kanri = df["管理状態"].isna() | (df["管理状態"].str.strip() == "")
        df = df[mask_kanri]
        print(f"  [labels/toyota] 管理状態=管理 除外: {n - len(df):,} records removed")

    print(f"  [labels/toyota] After filters: {len(df):,} / {n_before:,} records kept")

    df["_raw_address"] = df[lcfg["address_col"]]
    df["vacant_type"]   = lcfg["vacant_type_val"]
    df["vacant_source"] = lcfg["vacant_source_val"]
    df["vacant_year"]   = df.get("調査年度", pd.Series("令和5年", index=df.index))
    return df[["_raw_address", "vacant_type", "vacant_source", "vacant_year"]].copy()


def load_labels_okazaki(city_cfg: dict, data_dir: Path) -> pd.DataFrame:
    """Load 岡崎市 akiya_h28 + akiya_r3 with file-specific filters.

    akiya_h28.csv:
      空家等分類 == "空家等"              → 384 confirmed vacant
      (空家等候補 rows have 利用状況 == "未確認", not usable as positives)

    akiya_r3.csv:
      空家等分類 == "空家等候補"
      AND 意向回答 == "利用していない"     → 399 confirmed vacant
      (Note: CSV was re-exported from Excel with the 2-row merged-header fixed.
       意向回答 was all-NaN in the old incorrect CSV conversion.)
    """
    lcfg  = city_cfg["labels"]
    frames = []
    source_years = [("岡崎市_H28", "平成28年"), ("岡崎市_R3", "令和3年")]
    for (src, yr), fpath in zip(source_years, lcfg["files"]):
        p = data_dir / fpath
        if not p.exists():
            continue
        df = pd.read_csv(p, low_memory=False, dtype=str)
        bunrui = df.get("空家等分類", pd.Series(dtype=str)).str.strip()

        if "r3" in str(fpath).lower():
            # r3: candidate + confirmed not-in-use
            ikoh = df.get("意向回答", pd.Series(dtype=str)).str.strip()
            mask = (bunrui == "空家等候補") & (ikoh == "利用していない")
        else:
            # h28: directly confirmed vacant
            mask = bunrui == "空家等"

        df = df[mask]
        print(f"  [labels/okazaki] {p.name}: {mask.sum()} confirmed vacant records")

        df["_raw_address"] = df[lcfg["address_col"]]
        df["vacant_type"]   = lcfg["vacant_type_val"]
        df["vacant_source"] = src
        df["vacant_year"]   = yr
        frames.append(df[["_raw_address", "vacant_type", "vacant_source", "vacant_year"]])
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def _build_shimonoseki_address(df: pd.DataFrame) -> pd.Series:
    """Construct a normalized-ready address from akiya_survey.csv component columns.

    akiya_survey.csv stores the address split across:
      町名, 丁目_大字, 番, 号_番地

    The pre-built 住所 column simply concatenates the digits without address
    particles (e.g. "下関市本町125" instead of "下関市本町1丁目2番5号"), which
    fails to match water meter addresses after normalization.

    Output format:
      {町名}{丁目_大字}丁目{番}番{号_番地}号   (when 丁目_大字 is present)
      {町名}{番}番{号_番地}号                  (when 丁目_大字 is absent)

    After CleanData.normalize_series this produces the same string as the
    water meter format "町名N丁目M－K" → "町名N-M-K".
    """
    def _clean(series: pd.Series) -> pd.Series:
        """Strip whitespace and replace NaN / 'nan' strings with empty string."""
        return series.fillna("").astype(str).str.strip().replace("nan", "")

    machi  = _clean(df["町名"])
    chome  = _clean(df["丁目_大字"])
    ban    = _clean(df["番"])
    go     = _clean(df["号_番地"])

    chome_part = chome.apply(lambda v: f"{v}丁目" if v else "")
    ban_part   = ban.apply(lambda v: f"{v}番" if v else "")
    go_part    = go.apply(lambda v: f"{v}号" if v else "")

    return "下関市" + machi + chome_part + ban_part + go_part


def load_labels_shimonoseki(city_cfg: dict, data_dir: Path) -> pd.DataFrame:
    """Load 下関市 akiya_survey + tokutei_akiya.

    akiya_survey.csv: address reconstructed from component columns
      (町名, 丁目_大字, 番, 号_番地) because the pre-built 住所 column drops
      address particles, making it unmatchable after normalization.

    tokutei_akiya.csv: address read directly from 住所 column
      (already in proper Japanese address format).
    """
    lcfg   = city_cfg["labels"]
    frames = []
    sources = [("下関市_空き家調査", "空き家"), ("下関市_特定空家", "特定空家")]
    for (src, vtype), fpath in zip(sources, lcfg.get("files", [])):
        p = data_dir / fpath
        if not p.exists():
            continue
        df = pd.read_csv(p, low_memory=False, dtype=str)

        # akiya_survey.csv has component columns; tokutei_akiya.csv has a proper 住所
        if all(c in df.columns for c in ["町名", "丁目_大字", "番", "号_番地"]):
            df["_raw_address"] = _build_shimonoseki_address(df)
        else:
            df["_raw_address"] = df[lcfg["address_col"]]

        df["vacant_type"]   = vtype
        df["vacant_source"] = src
        df["vacant_year"]   = df.get("調査年度", df.get("認定年度", pd.Series("", index=df.index)))
        frames.append(df[["_raw_address", "vacant_type", "vacant_source", "vacant_year"]])
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def load_labels_kumagaya(city_cfg: dict, data_dir: Path) -> pd.DataFrame:
    """Load 熊谷市 akiya.csv using the full-form 'address' column."""
    lcfg = city_cfg["labels"]
    df = pd.read_csv(data_dir / lcfg["file"], low_memory=False, dtype=str)
    # Use full-form address column (with prefecture prefix) for better matching
    addr_col = lcfg.get("address_col", "address")
    df["_raw_address"] = df[addr_col].fillna(df.get("住所", pd.Series("", index=df.index)))
    df["vacant_type"]   = lcfg["vacant_type_val"]
    df["vacant_source"] = lcfg["vacant_source_val"]
    df["vacant_year"]   = "令和4年"
    return df[["_raw_address", "vacant_type", "vacant_source", "vacant_year"]].copy()


def load_labels_toyohashi(city_cfg: dict, data_dir: Path) -> pd.DataFrame:
    """Load 豊橋市 akiya.csv."""
    lcfg = city_cfg["labels"]
    df = pd.read_csv(data_dir / lcfg["file"], low_memory=False, dtype=str)
    df["_raw_address"] = df[lcfg["address_col"]]
    df["vacant_type"]   = lcfg["vacant_type_val"]
    df["vacant_source"] = lcfg["vacant_source_val"]
    df["vacant_year"]   = "令和7年"
    return df[["_raw_address", "vacant_type", "vacant_source", "vacant_year"]].copy()


def _load_labels_generic(labels_cfg: dict, data_dir: Path) -> pd.DataFrame:
    """汎用ラベルローダー。都市固有ローダーがない場合のFE経由フォールバック。

    labels_cfg に file と address_col があればCSVを読み込み、
    全レコードを空き家ラベルとして扱う。
    """
    fpath = data_dir / labels_cfg["file"]
    if not fpath.exists():
        print(f"  [labels/generic] File not found: {fpath}")
        return pd.DataFrame()
    df = pd.read_csv(fpath, low_memory=False, dtype=str)
    addr_col = labels_cfg.get("address_col", "住所")
    if addr_col not in df.columns:
        print(f"  [labels/generic] Address column {addr_col!r} not found in {fpath.name}")
        return pd.DataFrame()
    df["_raw_address"] = df[addr_col]
    df["vacant_type"] = labels_cfg.get("vacant_type_val", "空き家")
    df["vacant_source"] = labels_cfg.get("vacant_source_val", "")
    df["vacant_year"] = ""
    print(f"  [labels/generic] Loaded {len(df):,} records from {fpath.name}")
    return df[["_raw_address", "vacant_type", "vacant_source", "vacant_year"]].copy()


_LABEL_LOADERS = {
    "豊田市": load_labels_toyota,
    "岡崎市": load_labels_okazaki,
    "下関市": load_labels_shimonoseki,
    "熊谷市": load_labels_kumagaya,
    "豊橋市": load_labels_toyohashi,
}


def assign_labels(city: str, city_cfg: dict, data_dir: Path, df: pd.DataFrame) -> pd.DataFrame:
    """Load vacancy labels for a city and join to df by normalized address.

    Adds columns: is_vacant, vacant_type, vacant_source, vacant_year.

    Address matching strategy:
      1. Normalize label addresses.
      2. Strip city/prefecture prefix from label addresses (survey files
         typically include full address like "愛知県豊田市〇〇" while water
         meter addresses are city-relative "〇〇").
      3. Exact match on normalized_address.
      4. If match rate < 30%, also try without stripping the prefix and
         report the better rate.
    """
    loader = _LABEL_LOADERS.get(city)
    if loader is None:
        # 都市固有ローダーなし — FE経由の汎用ラベル付与を試みる
        labels_cfg = city_cfg.get("labels")
        if labels_cfg and labels_cfg.get("file"):
            label_df = _load_labels_generic(labels_cfg, data_dir)
        else:
            print(f"  [labels] No loader for {city!r} and no labels config -- is_vacant set to 0")
            df["is_vacant"]     = 0
            df["vacant_type"]   = ""
            df["vacant_source"] = ""
            df["vacant_year"]   = ""
            return df
    else:
        label_df = loader(city_cfg, data_dir)
    if label_df.empty:
        print(f"  [labels] No label files found -- is_vacant set to 0")
        df["is_vacant"]     = 0
        df["vacant_type"]   = ""
        df["vacant_source"] = ""
        df["vacant_year"]   = ""
        return df

    print(f"  [labels] Loaded {len(label_df):,} label records")

    prefix = city_cfg.get("address_prefix", "")

    # Try two normalization strategies and pick the one with higher match rate
    def _build_index(strip: bool) -> pd.DataFrame:
        ldf = label_df.copy()
        raw = ldf["_raw_address"].fillna("")
        if strip and prefix:
            raw = _strip_city_prefix(raw, prefix)
        ldf["normalized_address"] = CleanData.normalize_series(raw, municipality=city_cfg.get("municipality"))
        ldf = ldf[ldf["normalized_address"].str.len() > 0]
        ldf = ldf.drop_duplicates("normalized_address")
        return ldf.set_index("normalized_address")

    water_addrs = set(df["normalized_address"].dropna())

    idx_strip  = _build_index(strip=True)
    idx_nostrip = _build_index(strip=False)

    rate_strip   = len(set(idx_strip.index)   & water_addrs) / max(1, len(idx_strip))
    rate_nostrip = len(set(idx_nostrip.index) & water_addrs) / max(1, len(idx_nostrip))
    print(f"  [labels] Match rate (strip prefix):   {rate_strip:.1%}")
    print(f"  [labels] Match rate (no strip):        {rate_nostrip:.1%}")

    idx = idx_strip if rate_strip >= rate_nostrip else idx_nostrip

    # Join
    df["is_vacant"]     = df["normalized_address"].isin(idx.index).astype(int)
    df["vacant_type"]   = df["normalized_address"].map(idx["vacant_type"]).fillna("")
    df["vacant_source"] = df["normalized_address"].map(idx["vacant_source"]).fillna("")
    df["vacant_year"]   = df["normalized_address"].map(idx["vacant_year"]).fillna("")

    # F-1: Address precision flag — identifies label records where the address
    # lacks banchi/go-level detail (e.g. "大岩町大穴" without a house number).
    # These records cannot be uniquely matched to a single building, causing
    # potential mis-assignment of water/juki data from nearby buildings.
    # Flag values: 0 = sufficient precision (banchi or higher), 1 = low precision.
    # Applied only to is_vacant=1 rows (label addresses); all others get 0.
    def _addr_precision(addr: str) -> int:
        if not isinstance(addr, str) or addr.strip() == "":
            return 1
        if re.search(r"\d+-\d+", addr):      # "1-7-7", "52-1" (banchi-go)
            return 0
        if re.search(r"\d+番", addr):         # "N番" / "N番地"
            return 0
        return 1

    df["address_precision_flag"] = 0
    vacant_mask = df["is_vacant"] == 1
    if vacant_mask.sum() > 0:
        df.loc[vacant_mask, "address_precision_flag"] = (
            df.loc[vacant_mask, "normalized_address"]
            .fillna("")
            .apply(_addr_precision)
        )
        n_low = (df.loc[vacant_mask, "address_precision_flag"] == 1).sum()
        if n_low > 0:
            print(f"  [labels] address_precision_flag=1 (low precision): "
                  f"{n_low:,} / {vacant_mask.sum():,} vacant records")

    n_pos = df["is_vacant"].sum()
    n_tot = len(df)
    print(f"  [labels] is_vacant=1: {n_pos:,} / {n_tot:,} ({n_pos/n_tot:.2%})")
    return df
