"""建物関連データの結合処理

ユーザーが名寄せウィザードStep 12で取り込んだCSVを、
normalized_addressで水道データにleft joinし、
住所カラム以外の全カラムに_odsサフィックスを付与する。
"""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

from src.preprocessing.address_utils import CleanData


ODS_SUFFIX = "_ods"


def merge_optional_data_source(
    df: pd.DataFrame,
    cfg: dict | None,
    data_dir: str | Path,
    municipality=None,
    stats: dict | None = None,
) -> pd.DataFrame:
    """追加用データを住所で結合する。

    Args:
        df: メインDataFrame（normalized_address列が必須）
        cfg: param_adapterから受け取った設定dict。Noneなら何もしない。
            {"file": "custom.csv", "columns": {"address": "所在地"}}
        data_dir: CSVファイルの配置ディレクトリ
        stats: 非Noneのとき結合率算出用の統計を書き込む。
            sub_rows=追加用データの一意住所数（分母）、matched=水道住所に一致した数（分子）。

    Returns:
        _odsサフィックス付きカラムが追加されたDataFrame（left join）
    """
    if cfg is None:
        return df

    file_path = os.path.join(str(data_dir), cfg["file"])
    addr_col = cfg["columns"]["address"]

    ods_df = pd.read_csv(file_path, dtype=str)
    ods_df["normalized_address"] = CleanData.normalize_series(ods_df[addr_col], municipality=municipality)

    # 住所カラムを除外し、残りに_odsサフィックスを付与
    value_cols = [c for c in ods_df.columns if c != addr_col and c != "normalized_address"]
    rename_map = {c: f"{c}{ODS_SUFFIX}" for c in value_cols}
    ods_df = ods_df.rename(columns=rename_map)

    keep_cols = ["normalized_address"] + list(rename_map.values())
    ods_df = ods_df[keep_cols]
    ods_df = ods_df.drop_duplicates(subset=["normalized_address"], keep="first")

    # 結合率統計: マッチ先（追加用データ側）の一意住所を分母にする
    if stats is not None:
        water_addrs = set(df["normalized_address"].dropna()) - {""}
        sub_addrs = ods_df.loc[ods_df["normalized_address"] != "", "normalized_address"]
        stats["sub_rows"] = int(len(sub_addrs))
        stats["matched"] = int(sub_addrs.isin(water_addrs).sum())

    return df.merge(ods_df, on="normalized_address", how="left")
