"""
# E013 住居単位データ作成機能
* 水道使用量（水道栓単位）、住民基本台帳（個人単位）等のデータを住居単位のデータへ再集計する機能
"""

# Standard library imports
import json
import os
import sys
import traceback
import re
import warnings
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional
from concurrent.futures import ProcessPoolExecutor
import multiprocessing as mp
from multiprocessing import cpu_count

# Third-party imports
import chardet
import numpy as np
import pandas as pd
import polars as pl
from dateutil.relativedelta import relativedelta
from sklearn.preprocessing import LabelEncoder

warnings.filterwarnings("ignore")


def setup_environment():
    """Setup environment for PyInstaller (Windows and Mac)"""
    # Check if running from PyInstaller
    if getattr(sys, 'frozen', False):
        bundle_dir = sys._MEIPASS

        # Set for Fiona/GDAL
        os.environ['GDAL_DATA'] = os.path.join(bundle_dir, 'gdal_data')
        os.environ['PROJ_LIB'] = os.path.join(bundle_dir, 'proj_data')

        if sys.platform == 'darwin':
            lib_path = os.path.join(bundle_dir, '.dylibs')
            if os.path.exists(lib_path):
                os.environ['DYLD_LIBRARY_PATH'] = lib_path


# Setup environment before importing modules that use Fiona/GDAL
setup_environment()


def _run_processor(args):
    """
    Wrapper function to run a processor in a separate process.
    Must be at module level to be pickleable.
    """
    setup_environment()  # Setup env in child process
    (processor_class, input_paths, output_paths,
     reference_date, search_period) = args
    processor_class(
        input_paths, output_paths, reference_date, search_period
    ).process()


current_dir = os.path.dirname(os.path.abspath(__file__))
async_tasks_path = os.path.join(current_dir, "..", "async_tasks")
if async_tasks_path not in sys.path:
    sys.path.append(async_tasks_path)

try:
    from utils import *
    from constants import *
except ImportError:
    sys.path.remove(async_tasks_path)
    sys.path.append(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
    )
    from async_tasks.utils import *
    from async_tasks.constants import *

COLUMNS = {
    "suido_use": {
        "water_supply_number": "water_supply_number",
        "meter_reading_date": "meter_reading_date",
        "suido_usage": "suido_usage",
    },
    "suido_status": {
        "water_supply_number": "water_supply_number",
        "suido_address": "normalized_address",
        "usage_start_date": "usage_start_date",
        "usage_end_date": "usage_end_date",
    },
    "juki": {
        "household_code": "household_code",
        "juki_address": "normalized_address",
        "birth_date": "birth_date",
        "move_date": "move_date",
        "reason_transfer": "reason_transfer",
        "date_transfer": "date_transfer",
    },
    "tatemono": {
        "tatemono_address": "normalized_address",
        "structure": "structure",
        "registration_reason": "registration_reason",
    },
}

ERROR_CODE = None
ERROR_MSG = None

_DATE_PATTERNS = {
    # Most common formats first
    'yyyymmdd_8digit': re.compile(r'^(\d{4})(\d{2})(\d{2})$'),  # Fast pre-check
    'western_slash': re.compile(r'^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$'),
    'western_ymd': re.compile(r'^(\d{4})年(\d{1,2})月(\d{1,2})日$'),

    # Era formats (less common, check last)
    'era_1char_dot': re.compile(r'^([RHSTrhst])(\d{1,3})[./-](\d{1,2})[./-](\d{1,2})$'),
    'era_2char_dot': re.compile(r'^(令和|平成|昭和|大正)(\d{1,3})[./-](\d{1,2})[./-](\d{1,2})$'),
    'era_1char_ymd': re.compile(r'^([RHSTrhst])(\d{1,3})年(\d{1,2})月(\d{1,2})日$'),
    'era_2char_ymd': re.compile(r'^(令和|平成|昭和|大正)(\d{1,3})年(\d{1,2})月(\d{1,2})日$'),
}

# Patterns with suffix capture (for format_date_keep_suffix)
_DATE_PATTERNS_WITH_SUFFIX = {
    'yyyymmdd_8digit': re.compile(r'^(\d{4})(\d{2})(\d{2})(.*)$'),
    'western_slash': re.compile(r'^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(.*)$'),
    'western_ymd': re.compile(r'^(\d{4})年(\d{1,2})月(\d{1,2})日(.*)$'),
    'era_1char_dot': re.compile(r'^([RHSTrhst])(\d{1,3})[./-](\d{1,2})[./-](\d{1,2})(.*)$'),
    'era_2char_dot': re.compile(r'^(令和|平成|昭和|大正)(\d{1,3})[./-](\d{1,2})[./-](\d{1,2})(.*)$'),
    'era_1char_ymd': re.compile(r'^([RHSTrhst])(\d{1,3})年(\d{1,2})月(\d{1,2})日(.*)$'),
    'era_2char_ymd': re.compile(r'^(令和|平成|昭和|大正)(\d{1,3})年(\d{1,2})月(\d{1,2})日(.*)$'),
}

# Era mapping
_ERA_MAP = {
    'R': 2018, 'r': 2018, '令和': 2018,
    'H': 1988, 'h': 1988, '平成': 1988,
    'S': 1925, 's': 1925, '昭和': 1925,
    'T': 1911, 't': 1911, '大正': 1911,
}

# Valid range (quick bounds check)
_MIN_YEAR = 1868
_MAX_YEAR = 2100


class DataProcessor:
    def __init__(
        self, input_paths, output_paths, reference_date, search_period
    ):
        # 入力ファイルのパスを設定
        self.INPUT_PATHS = input_paths
        # 出力ファイルのパスを設定
        self.OUTPUT_PATHS = output_paths
        # 空き家予測の基準日
        try:
            self.reference_date = datetime.strptime(
                str(reference_date), "%Y-%m-%d"
            )
        except:
            self.reference_date = datetime.strptime(
                str(reference_date), "%Y/%m/%d"
            )
        # 検索期間
        self.SEARCH_PERIOD = int(search_period)

    @staticmethod
    def detect_encoding(file_path):
        """
        ファイルのエンコーディングを検出する

        Parameters
        ----------
        file_path : str
            検出対象のファイルパス

        Returns
        -------
        encoding : str
            検出されたエンコーディング
        """
        # ファイルの内容を読み込む
        with open(file_path, "rb") as file:
            raw_data = file.read(100)
        # エンコーディングを検出して返す
        result = chardet.detect(raw_data)
        return result["encoding"]

    @staticmethod
    def read_data(path, **kwargs):
        """
        CSVファイルまたはテキストファイルを読み込む
        Parameters
        ----------
        path : str
            読み込むファイルのパス
        **kwargs : dict
            pandas.read_csv に渡す追加のキーワード引数
        Returns
        -------
        df : pandas.DataFrame
            読み込まれたデータフレーム、エラー時はNone
        """
        try:
            # ファイルの拡張子を取得し、小文字に変換
            file_extension = os.path.splitext(path)[1].lower()

            if file_extension not in [".csv", ".txt"]:
                set_error(ERROR_00006)
                raise ValueError(
                    f"CSVファイルまたはテキストファイル以外は対応していません: {file_extension}"
                )

            # 複数のエンコーディングを試行
            encodings = ["utf-8-sig"]
            for encoding in encodings:
                try:
                    # 各エンコーディングでファイルの読み込みを試みる
                    return pd.read_csv(
                        path, encoding=encoding, **kwargs, low_memory=False
                    )
                except UnicodeDecodeError:
                    # デコードエラーが発生した場合、次のエンコーディングを試す
                    continue

            # 自動でエンコーディングを検出し、再度読み込みを試みる
            detected_encoding = DataProcessor.detect_encoding(path)
            if detected_encoding:
                return pd.read_csv(path, encoding=detected_encoding, **kwargs)

            # 適切なエンコーディングが見つからない場合、エラーを発生させる
            set_error(ERROR_00008)
            raise ValueError(
                f"適切なエンコーディングが見つかりませんでした: {path}"
            )
        except Exception as e:
            # 何らかの例外が発生した場合、エラーメッセージを表示してNoneを返す
            if ERROR_CODE is None:
                set_error(ERROR_00007)
                raise Exception(
                    "CSV形式（UTF-8 BOM付き）のファイルを入力してください。"
                )
            raise Exception(e)

    @staticmethod
    def save_csv(df, path):
        """
        データフレームをCSVファイルとして保存する

        Parameters
        ----------
        df : pandas.DataFrame
            保存するデータフレーム
        path : str
            保存先のファイルパス
        """
        # 試行するエンコーディングのリスト
        encodings = ["utf-8-sig"]
        for encoding in encodings:
            try:
                # 各エンコーディングでCSVファイルとして保存を試みる
                df.to_csv(path, encoding=encoding, index=False)
                return
            except Exception as e:
                set_error(ERROR_00009, path, encoding)

    @staticmethod
    def drop_duplicates(df, subset, keep="first"):
        """
        データフレームから重複行を削除する
        Parameters
        ----------
        df : pandas.DataFrame
            重複を削除するデータフレーム
        subset : list
            重複を推定するカラムのリスト
        keep : str, optional
            残す行を指定（'first', 'last', False）
        Returns
        -------
        pandas.DataFrame
            重複が削除されたデータフレーム
        """
        return df.drop_duplicates(subset=subset, keep=keep)

    def process(self):
        raise NotImplementedError("Subclasses must implement this method")


class SuidoProcessor(DataProcessor):

    def build_period_mapping(self, base_date):
        """
        基準日の「当月」は含めず、
        その前月から過去12か月を2か月ごとにまとめるマッピングを作成。

        例: 基準日=2024-03-15 の場合
        対象月 = 2024-02, 01, 2023-12, 11, ... （計12ヶ月）
        → [2,1], [12,11], [10,9], [8,7], [6,5], [4,3] のように2ヶ月ごとに区切る
        """
        base_month = base_date.month

        # 基準月の前月から 12 ヶ月分の月番号のリストを作成
        months_back = []
        # 基準が1月なら前月は12月
        cur = 12 if base_month == 1 else base_month - 1
        for _ in range(12):
            months_back.append(cur)
            cur = 12 if cur == 1 else cur - 1

        # 2か月ごとに区切って period_label を作成
        period_mapping = {}
        for i in range(0, 12, 2):
            m1, m2 = months_back[i], months_back[i + 1]
            # ラベルは昇順にして "02_03" のようにする
            m_min, m_max = sorted([m1, m2])
            label = f"{m_min:02d}_{m_max:02d}"
            period_mapping[m1] = label
            period_mapping[m2] = label

        return period_mapping

    def dedup_suido2(self, df, col_date, col_suido, output_dir):
        try:
            base_date = datetime.strptime(
                self.reference_date.strftime("%Y%m%d"), "%Y%m%d"
            )
        except ValueError:
            raise ValueError(
                "基準日は YYYYMMDD 形式で指定してください（例: 20220401）"
            )

        # 基準月からマイナス2か月ごとの period マッピングを作成
        period_mapping = self.build_period_mapping(base_date)

        # 検針日カラムをdatetimeに変換
        df["_meter_reading_date_dt"] = pd.to_datetime(
            df[col_date], format="%Y%m%d", errors="coerce"
        )

        # 月を抽出
        df["month"] = df["_meter_reading_date_dt"].dt.month

        # period 列を付与
        df_pl = pl.from_pandas(df[["month"]])
        df_pl = df_pl.with_columns(
            pl.col("month")
            .cast(pl.Int64, strict=False)  # strict=False: invalid -> null
            .replace_strict(period_mapping, default="unknown")
            .alias("period")
        )
        df["period"] = df_pl["period"].to_pandas()

        # 出力前に日付をyyyymmdd形式に戻す（元のまま保持）
        df[col_date] = df["_meter_reading_date_dt"].dt.strftime("%Y%m%d")

        # 区間ごとに重複解消＋CSV出力
        period_counts = 0
        for period_label, group in df.groupby("period"):
            if period_label == "unknown":
                # 検針日が欠損など、period 判定できないものはスキップ
                continue

            # 区間ごとの重複解消
            deduped = self.dedup_by_suido_and_date(
                group,
                col_suido=col_suido,
                col_date=col_date,
                keep="latest",
            )

            output_path = os.path.join(output_dir, f"s_{period_label}.csv")
            deduped.to_csv(output_path, index=False, encoding="utf-8-sig")
            period_counts += 1

    def dedup_by_suido_and_date(
        self, df_period, col_suido="water_supply_number", col_date="meter_reading_date", keep="latest"
    ):
        """
        区間ごとの DataFrame に対して、
        - 水道番号（col_suido）ごとに検針日（col_date）で代表行を1件にまとめる
        - 「結合件数」列にその水道番号の件数を付与
        """
        if df_period.empty:
            return df_period.copy()

        df = df_period.copy()

        # 型調整
        df[col_suido] = df[col_suido].astype("string")
        df["_date_int"] = pd.to_numeric(df[col_date], errors="coerce").astype(
            "Int64"
        )
        df["_date_dt"] = pd.to_datetime(
            df["_date_int"].astype("string"), format="%Y%m%d", errors="coerce"
        )

        group_keys = [col_suido]

        # 代表行の選択
        if keep == "latest":
            # 最新検針日を残す（検針日降順で並べて先頭を取る）
            df_rep = (
                df.sort_values(
                    group_keys + ["_date_dt"], ascending=[True, False]
                )
                .groupby(group_keys, as_index=False)
                .head(1)
            )
        else:
            # 先頭行を残す
            df_rep = df.drop_duplicates(subset=group_keys, keep="first")

        # 件数カウント
        cnt = df.groupby(group_keys).size()

        # 出力整形
        out = df_rep.set_index(group_keys).copy()
        out[col_date] = self.int_to_str_zfill(out["_date_int"], 8)
        out["combined_count"] = cnt

        # 一時列を削除
        out.drop(
            columns=[c for c in out.columns if c.startswith("_")],
            inplace=True,
            errors="ignore",
        )

        out = out.reset_index()

        return out

    def int_to_str_zfill(self, s_int, width):
        """Int64 系の列をゼロパディングした文字列に変換"""
        return s_int.astype("Int64").astype("string").str.zfill(width)

    def to_norm_yyyymmdd(self, s) -> Optional[int]:
        """
        日付を比較可能な整数(YYYYMMDD)に正規化。
        - 8桁数字ならそのまま
        - 'YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY.MM.DD' 等の区切り除去
        - それ以外は pandas で解釈、不可なら None
        """
        if pd.isna(s):
            return None
        # Handle float type (e.g., 20200101.0)
        if isinstance(s, float):
            s = int(s)
        t = str(s).strip()
        if not t:
            return None
        if t.isdigit() and len(t) == 8:
            return int(t)
        for ch in "-/._ ":
            t = t.replace(ch, "")
        if t.isdigit() and len(t) == 8:
            return int(t)
        try:
            dt = pd.to_datetime(s, errors="coerce")
            if pd.isna(dt):
                return None
            return int(dt.strftime("%Y%m%d"))
        except Exception:
            return None

    def to_numeric(self, series: pd.Series) -> pd.Series:
        """
        数値列（文字列）を数値に。カンマや全角空白は除去。解釈不能は0。
        """
        s = (
            series.fillna("")
            .astype(str)
            .str.replace(",", "", regex=False)
            .str.strip()
        )
        return pd.to_numeric(s, errors="coerce").fillna(0)

    # ------------------ CSV2 側 集約（重複あり対応） ------------------

    def prepare_csv2_agg_with_sum(
        self,
        df2: pd.DataFrame,
        key_col_csv2: str,
        kenshin_col: str,
        keiryo_col: str,
        count_col: str,
    ) -> pd.DataFrame:
        """
        CSV2 を 水栓ID で集約。
        - 最新検針日: 正規化YYYYMMDDの最大（Noneは-1扱い）
        - 計量水量: 合計
        - 結合件数: 合計（列が無ければ各行=1 として合計）
        返り値: [key, 検針日, 計量水量, 結合件数] の1行/キーのDF
        """
        if key_col_csv2 not in df2.columns:
            raise KeyError(f"CSV2: キー列がありません -> {key_col_csv2}")
        for col in (kenshin_col, keiryo_col):
            if col not in df2.columns:
                raise KeyError(f"CSV2: 必須列がありません -> {col}")

        df2 = df2.copy()

        # 日付の正規化
        df2["_norm_kenshin"] = df2[kenshin_col].map(self.to_norm_yyyymmdd)
        df2["_norm_kenshin_fill"] = df2["_norm_kenshin"].fillna(-1)

        # 計量水量（数値）に変換
        keiryo_num = self.to_numeric(df2[keiryo_col])
        df2["_keiryo_num"] = keiryo_num

        # 結合件数（なければ1）
        if count_col in df2.columns:
            df2["_cnt_num"] = self.to_numeric(df2[count_col])
            # 解釈不能で0になったものは1に補正（“件数”として自然に）
            df2.loc[df2["_cnt_num"] <= 0, "_cnt_num"] = 1
        else:
            df2["_cnt_num"] = 1

        # 合計値（計量水量・件数）を groupby 集計
        sums = df2.groupby(key_col_csv2, dropna=False, as_index=False).agg(
            _keiryo_sum=("_keiryo_num", "sum"),
            _cnt_sum=("_cnt_num", "sum"),
            _norm_max=("_norm_kenshin_fill", "max"),
        )

        # 最新検針日の“元の文字列”を取得（同率複数あれば最後行）
        df2_sorted = df2.sort_values(
            [key_col_csv2, "_norm_kenshin_fill", kenshin_col]
        )
        latest_rows = df2_sorted.groupby(
            key_col_csv2, dropna=False, as_index=False
        ).tail(1)
        latest = latest_rows[[key_col_csv2, kenshin_col]]

        # マージして完成
        out = sums.merge(latest, on=key_col_csv2, how="left")

        # 列名整理：外側でサフィックス付けるのでここでは元名を維持
        out = out.rename(
            columns={
                "_keiryo_sum": keiryo_col,
                "_cnt_sum": count_col,
            }
        )
        # _norm_max は以降使わないので削除
        if "_norm_max" in out.columns:
            out = out.drop(columns=["_norm_max"])

        return out

    def extract_aqueduct_closedate(
        self, series: pd.Series, base_date: pd.Timestamp | None = None
    ) -> pd.Series:
        """
        水道閉栓から特定の日まで、何日たっているかを計算する関数

        Parameters
        ----------
        df : pandas.Series
            水道閉栓日カラム
        base_date : pd.Timestamp
            基準日 ex)pd.to_datetime('2025-02-02')

        Returns
        -------
        pandas.Series
            経過日のカラム
        """

        def from_float_to_datetime(series: pd.Series) -> pd.Series:
            datetime_series = pd.to_datetime(
                series.astype(str).str.split(".").str[0],
                format="%Y%m%d",
                errors="coerce",
            )
            return datetime_series

        if base_date is None:
            base_date = pd.Timestamp.now()
        datetime_series = from_float_to_datetime(series)
        year = (base_date - datetime_series).dt.days // 365
        return year

    def merge_all(
        self,
        csv1_path: Path,
        csv2_paths: List[Path],
        out_path: Path,
        key_csv1: str,
        key_csv2: str,
        kenshin_col: str,
        keiryo_col: str,
        count_col: str,
    ):
        # CSV1 読み込み
        df1 = self.read_data(csv1_path,dtype={"usage_end_date": "string"})
        if key_csv1 not in df1.columns:
            raise KeyError(f"Suido status にキー列がありません -> {key_csv1}")
        try:
            df1["usage_end_date"] = df1["usage_end_date"].map(format_date_as_yyyymmdd)
        except Exception:
            pass
        merged = df1.copy()

        # 各 CSV2 を集約 -> 左結合
        for i, p in enumerate(csv2_paths, start=1):
            df2 = self.read_data(p)
            try:
                # 検針年月日
                df2[kenshin_col] = df2[kenshin_col].map(format_date_as_yyyymmdd)
            except Exception:
                pass
            # 集約（重複あり → 合計 & 最新日）
            agg2 = self.prepare_csv2_agg_with_sum(
                df2,
                key_col_csv2=key_csv2,
                kenshin_col=kenshin_col,
                keiryo_col=keiryo_col,
                count_col=count_col,
            )

            # サフィックス付けてリネーム
            suffix = f"_f{i}"
            rename_map = {
                kenshin_col: f"{kenshin_col}{suffix}",
                keiryo_col: f"{keiryo_col}{suffix}",
                count_col: f"{count_col}{suffix}",
            }
            agg2 = agg2.rename(columns=rename_map)

            # 左: CSV1.key_csv1 / 右: CSV2.key_csv2
            keep_cols = [key_csv2] + list(rename_map.values())
            try:
                merged = merged.merge(
                    agg2[keep_cols],
                    how="left",
                    left_on=key_csv1,
                    right_on=key_csv2,
                )
                # 水道閉栓から特定の日まで、何日たっているかを計算
                merged["years_water_closure"] = self.extract_aqueduct_closedate(
                    merged["usage_end_date"]
                )
            except Exception as e:
                traceback.print_exc()
                print(e)

        return merged

    def add_heisen_flag(
        self, df: pd.DataFrame, heisen_col: str, base_date: str
    ) -> pd.DataFrame:
        """
        CSV1 に閉栓フラグ列を追加する。
        - 閉栓日が NULL（空欄） → 0
        - 閉栓日が基準日より前 → 1（閉栓済）
        - 閉栓日が基準日以降 → 0（未来閉栓 or 開栓中扱い）
        """
        base_norm = self.to_norm_yyyymmdd(base_date)
        if base_norm is None:
            raise ValueError(f"基準日(base-date)の形式が不正です: {base_date}")

        # 閉栓日の正規化
        df["_norm_heisen"] = df[heisen_col].map(self.to_norm_yyyymmdd)

        # フラグ判定関数
        # 空欄（None / "" / NaN）→ 0, 基準日以降 → 0, 基準日より前 → 1
        norm_col = df["_norm_heisen"]
        df["water_disconnection_flag"] = np.where(
            norm_col.isna() | (norm_col == ""),
            0,
            np.where(norm_col >= base_norm, 0, 1)
        )

        # 作業列削除
        df = df.drop(columns=["_norm_heisen"])
        return df

    def merge_suido(
        self,
        csv1_path,
        csv2_paths,
        output_path,
        key_csv1,
        key_csv2,
        kenshin_col,
        keiryo_col,
        count_col,
        usage_end_date,
    ):
        merged = self.merge_all(
            csv1_path=csv1_path,
            csv2_paths=csv2_paths,
            out_path=output_path,
            key_csv1=key_csv1,
            key_csv2=key_csv2,
            kenshin_col=kenshin_col,
            keiryo_col=keiryo_col,
            count_col=count_col,
        )

        base_date = self.reference_date.strftime("%Y%m%d")

        merged = self.add_heisen_flag(
            merged, heisen_col=usage_end_date, base_date=base_date
        )
        return merged

    def parse_base_date(self, base_date_str: str) -> str:
        """
        BASE_DATE を yyyymmdd の文字列に統一する。

        対応形式:
        - yyyymmdd
        - yyyy-mm-dd
        - yyyy/mm/dd

        戻り値:
        - "yyyyMMdd" 形式の文字列
        """
        s = base_date_str.replace("/", "").replace("-", "").strip()
        if len(s) != 8 or not s.isdigit():
            raise ValueError(
                "BASE_DATE は yyyymmdd 形式（例: 20250101）で指定してください。"
            )
        return s  # ← Timestamp ではなく単なる文字列

    def compute_total_usage(
        self,
        df: pd.DataFrame,
        usage_cols_prefix: str = "suido_usage_",
        num_usage_cols: int = 6,
        total_use_col: str = "total_water_usage",
    ) -> pd.DataFrame:
        """
        計量水量_* カラム(デフォルト: 計量水量_1〜計量水量_6)から
        合計使用水量カラムを作成（上書き）する。

        - 数値以外は NaN として無視
        - 全部 NaN の場合は 合計使用水量 も NaN
        """
        df = df.copy()

        # 対象カラムをリストアップ
        usage_cols = []
        for i in range(1, num_usage_cols + 1):
            col = f"{usage_cols_prefix}{i}"
            if col in df.columns:
                usage_cols.append(col)

        if not usage_cols:
            # 対象カラムが1つも無い場合は、そのまま返す
            print(
                "警告: 計量水量_* カラムが見つからなかったため、合計使用水量は計算していません。"
            )
            return df

        # 数値に変換
        for col in usage_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

        # 行方向に合計を計算（全て NaN の場合は NaN のまま）
        df[total_use_col] = df[usage_cols].sum(axis=1, min_count=1)

        return df

    def normalize_date_as_yyyymmdd(self, s) -> str | None:
        """
        任意の値 s（主に日付文字列）を yyyymmdd 形式の文字列に正規化する。

        対応形式:
        - yyyy/mm/dd
        - yyyy-mm-dd
        - yyyymmdd

        変換できないもの、空文字、NaN は None を返す。
        """
        if pd.isna(s):
            return None
        # Handle float type (e.g., 20200101.0)
        if isinstance(s, float):
            s = int(s)
        s = str(s).strip()
        if not s:
            return None

        # スラッシュ・ハイフンを除去して 8 桁数字に統一
        s2 = s.replace("/", "").replace("-", "")
        if len(s2) != 8 or not s2.isdigit():
            return None

        return s2  # 例: "20250101"

    def dedup_by_normalized_address(
        self,
        df: pd.DataFrame,
        base_date: str,  # 文字列 yyyymmdd
        addr_col: str = "normalized_address",
        close_col: str = "usage_end_date",
        total_use_col: str = "total_water_usage",
    ) -> pd.DataFrame:
        """
        正規化住所ごとに重複削除を行う。

        ルール：
        1) 同住所で閉栓日がNULLの行が2件以上→その中で合計使用水量が最大の1件だけ残す
        2) 同住所で開栓中（閉栓日がNULL or 基準日より未来）がちょうど1件→その1件だけ残す
        3) 同住所で全て閉栓済み（閉栓日がNULLでなく、かつ基準日以前）→
        基準日に最も近い過去の閉栓日のレコード1件だけ残す

        ※ 日付比較はすべて "yyyymmdd" 形式の文字列で行う。
        ゼロパディングされているため、文字列比較で時間順と同じ結果になる。
        """

        df = df.copy()

        # 閉栓日を yyyymmdd 文字列に正規化（変換不可は None）
        df["_closed"] = df[close_col].apply(self.normalize_date_as_yyyymmdd)

        # 合計使用水量は数値に
        df[total_use_col] = pd.to_numeric(df[total_use_col], errors="coerce")

        def pick_record(g: pd.DataFrame) -> pd.DataFrame:
            # 1件だけならそのまま残す
            if len(g) == 1:
                return g

            closed = g["_closed"]  # yyyymmdd or None

            # 開栓状態の判定
            is_null = closed.isna()  # 閉栓日が NULL（未閉栓）
            is_future = closed.notna() & (closed > base_date)  # 基準日より未来
            is_open_now = is_null | is_future  # 基準日時点で開栓中とみなす

            n_null = is_null.sum()
            n_open_now = is_open_now.sum()

            # --- 1) 閉栓日NULLが2件以上 ---
            if n_null >= 2:
                # NULL（開栓中）の中から合計使用水量が最大のレコードだけ残す
                sub = g[is_null].copy()
                # total が NaN だと idxmax できないので fillna
                idx = (sub[total_use_col].fillna(-1)).idxmax()
                return g.loc[[idx]]

            # --- 2) 開栓中（NULL or future）がちょうど1件 ---
            if n_open_now == 1:
                return g[is_open_now]

            # --- 3) 全て閉栓済み（基準日時点で開栓中がゼロ） ---
            if n_open_now == 0:
                # 基準日以前の閉栓日の中で、最も基準日に近い（＝最大の）レコード
                closed_past = closed.notna() & (closed <= base_date)
                if closed_past.any():
                    # 文字列比較で最大 → 日付として最も新しい
                    idx = closed[closed_past].idxmax()
                    return g.loc[[idx]]

            # --- フォールバック：念のため先頭だけ残す ---
            return g.iloc[[0]]

        # 正規化住所ごとにグループ化して1住所1レコードに
        result = (
            df.groupby(addr_col, group_keys=False)
            .apply(pick_record)
            .reset_index(drop=True)
        )

        return result

    def process(self):

        try:

            cols_status = COLUMNS["suido_status"]
            cols_use = COLUMNS["suido_use"]
            col_suido = cols_use["water_supply_number"]
            col_date = cols_use["meter_reading_date"]

            output_dir = self.OUTPUT_PATHS["suido"].replace(
                "suido_residence.csv", "suido_use_period"
            )
            os.makedirs(output_dir, exist_ok=True)

            df_suido_use = self.read_data(
                self.INPUT_PATHS["suido_use"], dtype=str
            )
            df_suido_use[col_date] = df_suido_use[col_date].map(
                format_date_as_yyyymmdd
            )
            # 030_suido (suido use)
            self.dedup_suido2(df_suido_use, col_date, col_suido, output_dir)

            csv_paths = [
                os.path.join(output_dir, file_name)
                for file_name in os.listdir(output_dir)
                if file_name.lower().endswith(".csv")
            ]

            # 040_suido_merge
            merged = self.merge_suido(
                self.INPUT_PATHS["suido_status"],
                csv_paths,
                self.OUTPUT_PATHS["suido"],
                cols_status["water_supply_number"],
                cols_use["water_supply_number"],
                cols_use["meter_reading_date"],
                cols_use["suido_usage"],
                "combined_count",
                cols_status["usage_end_date"],
            )

            # 060_suido_tyofuku
            # 基準日を yyyymmdd 文字列に統一
            base_date_str = self.parse_base_date(
                self.reference_date.strftime("%Y%m%d")
            )
            # まず計量水量_* から合計使用水量を計算
            df_in = self.compute_total_usage(
                merged,
                usage_cols_prefix="suido_usage_f",
                num_usage_cols=6,
                total_use_col="total_water_usage",
            )

            # その後、重複削除ロジックを適用
            df_out = self.dedup_by_normalized_address(
                df_in,
                base_date=base_date_str,
                addr_col="normalized_address",
                close_col="usage_end_date",
                total_use_col="total_water_usage",
            )

            # 内部用カラム _closed は出力前に削除
            if "_closed" in df_out.columns:
                df_out = df_out.drop(columns=["_closed"])

            df_out.to_csv(
                self.OUTPUT_PATHS["suido"], index=False, encoding="utf-8-sig"
            )

        except Exception as e:
            if ERROR_CODE is None:
                set_error(ERROR_00038)
                raise Exception(
                    f"An error occurred during the processing of the suido data:",
                    {e},
                )

            raise Exception(e)


def _compute_row_logic(
    row: pd.Series,
    person_indices: List[int],
    base_date: pd.Timestamp,
    parse_date_func,
    calc_age_func,
    format_ymd_func,
) -> pd.Series:
    # ①-2,3,4 用: 現住者候補
    current_reside_dates: List[pd.Timestamp] = []
    current_birth_dates: List[pd.Timestamp] = []
    current_ages: List[int] = []

    # ②-1 用: 異動事由・異動日からカウント
    death_count = 0
    tenyu_count = 0  # 転入数
    tenshutsu_count = 0  # 転出数
    shokken_count = 0  # 職権消除数

    for i in person_indices:
        reason = str(row.get(f"reason_transfer_{i}", "") or "")
        move_date_str = row.get(f"date_transfer_{i}", "")
        birth_str = row.get(f"birth_date_{i}", "")
        reside_str = row.get(f"move_date_{i}", "")

        move_date = parse_date_func(move_date_str)
        birth_date = parse_date_func(birth_str)
        reside_date = parse_date_func(reside_str)

        # フラグ判定
        has_future_move = move_date is not None and move_date > base_date
        has_ng_reason = any(
            k in reason for k in ("死亡", "転出", "転居", "消除")
        )

        # --- ① 現住者候補の抽出ロジック ---
        if has_future_move or (not has_ng_reason):
            # ★ 最古住定日の候補は「住定日_i」のみ（未来日は除外）
            if reside_date is not None and reside_date <= base_date:
                current_reside_dates.append(reside_date)

            # ★ 年齢計算対象
            if birth_date is not None:
                current_birth_dates.append(birth_date)
                current_ages.append(calc_age_func(birth_date, base_date))

        # --- ② 異動カウント (異動日が基準日「以前」のみカウント) ---
        if move_date is not None and move_date <= base_date:
            if "死亡" in reason:
                death_count += 1
            if ("転入" in reason) or ("出生" in reason):
                tenyu_count += 1
            if "転出" in reason:
                tenshutsu_count += 1
            if "消除" in reason:
                shokken_count += 1

    # --- ①-2 最古住定日 & 住定期間(日) ---
    if current_reside_dates:
        oldest_reside = min(current_reside_dates)
        # row["最古住定日"] = format_ymd_func(oldest_reside)
        # ※ 基準日より未来の住定日でもそのまま計算（マイナスになり得る）
        row["residence_duration"] = (base_date - oldest_reside).days
    else:
        # row["最古住定日"] = ""
        row["residence_duration"] = ""

    # --- ①-3 最高齢生年月日 & 最大年齢 ---
    if current_birth_dates:
        oldest_birth = min(current_birth_dates)
        # row["最高齢生年月日"] = format_ymd_func(oldest_birth)
        row["max_age"] = calc_age_func(oldest_birth, base_date)
    else:
        # row["最高齢生年月日"] = ""
        row["max_age"] = ""

    # --- ①-4 15歳以下人数 & 65歳以上人数 ---
    if current_ages:
        row["under_15_count"] = sum(1 for a in current_ages if a <= 15)
        row["over_65_count"] = sum(1 for a in current_ages if a >= 65)
    else:
        row["under_15_count"] = 0
        row["over_65_count"] = 0

    # --- ②-1 異動人数 ---
    row["num_deaths"] = death_count
    row["num_inmigrants"] = tenyu_count
    row["num_outmigrants_relocations"] = tenshutsu_count
    row["num_cancellations"] = shokken_count

    # --- ②-2 異動反映後世帯人数 = 人数 - (死亡人数 + 転出数 + 職権消除数) ---
    total_ninzu = row.get("household_size", "")
    try:
        if total_ninzu is None or str(total_ninzu).strip() == "":
            row["num_householdsize_after_changes"] = ""
        else:
            # "1.0" なども想定して float → int
            n = int(float(str(total_ninzu)))
            row["num_householdsize_after_changes"] = n - (
                death_count + tenshutsu_count + shokken_count
            )
    except ValueError:
        # 数値変換できなければ空欄にしておく
        row["num_householdsize_after_changes"] = ""

    return row


# Helper function for multiprocessing
def _process_chunk_compute_row(args):
    # Setup environment in each child process for PyInstaller
    setup_environment()

    (
        chunk_df, person_indices, base_date,
        parse_date_func, calc_age_func, format_ymd_func
    ) = args

    results = []
    for idx, row in chunk_df.iterrows():
        result_row = _compute_row_logic(
            row.copy(),
            person_indices,
            base_date,
            parse_date_func,
            calc_age_func,
            format_ymd_func,
        )
        results.append(result_row)

    return pd.DataFrame(results)


class JukiProcessor(DataProcessor):

    def _parse_yyyymmdd(self, s):
        """
        yyyymmdd（整数/文字列）想定。欠損は NaN -> -inf として扱い、最新選定から除外されやすくする。
        """
        if pd.isna(s):
            return float("-inf")
        try:
            s = str(int(s))  # "20200101" or 20200101 → "20200101"
            if len(s) == 8:
                return int(s)
            # 例: yyyymm しかない等の変形は末尾"01"補完
            if len(s) == 6:
                return int(s + "01")
            return int(s)
        except Exception:
            return float("-inf")

    def juki_setai(self, df, cols):
        """
        世帯単位でデータを集約する
        """
        from collections import Counter

        person_key_cols = ["household_code", "birth_date", "move_date"]
        address_col = "normalized_address"
        move_reason_col = cols["reason_transfer"]
        move_date_col = cols["date_transfer"]
        setai_col = cols["household_code"]

        # 住所（世帯内最頻値）
        def pick_household_address(g):
            if address_col and address_col in g.columns:
                vals = [
                    v for v in g[address_col] if pd.notna(v) and str(v) != ""
                ]
                if not vals:
                    return None
                cnt = Counter(vals).most_common()
                return cnt[0][0] if cnt else None
            return None

        # ▼▼ 追加：最新異動事由 と 最新異動日 の両方を保持 ▼▼
        if move_reason_col and move_reason_col in df.columns:
            df["_move_date_key_"] = (
                df[move_date_col].map(self._parse_yyyymmdd)
                if move_date_col in df.columns
                else 0
            )

            idx_latest = (
                df.groupby(person_key_cols)["_move_date_key_"].idxmax()
                if move_date_col in df.columns
                else df.groupby(person_key_cols).head(1).index
            )

            latest_info = (
                df.loc[
                    idx_latest,
                    person_key_cols + [move_reason_col, move_date_col],
                ]
                .drop_duplicates(person_key_cols)
                .set_index(person_key_cols)
            )

            # dict で両方とれるようにする
            latest_reason_map = (
                latest_info[move_reason_col].to_dict()
                if move_reason_col
                else {}
            )
            latest_date_map = (
                latest_info[move_date_col].to_dict() if move_date_col else {}
            )
        else:
            latest_reason_map = {}
            latest_date_map = {}

        output_rows = []
        for household_id, g in df.groupby(setai_col):
            row = {setai_col: household_id}

            # 世帯住所（最頻値）
            household_address = pick_household_address(g)
            if household_address is not None:
                row["normalized_address"] = household_address

            # 人物のレコードを世帯内でユニーク化（同一個人の重複行があることを想定）
            people = g.drop_duplicates(subset=person_key_cols).reset_index(
                drop=True
            )

            # 人数（任意で追加）
            row["household_size"] = len(people)

            for i, rec in people.iterrows():
                idx = i + 1
                row[f"birth_date_{idx}"] = rec["birth_date"]
                row[f"move_date_{idx}"] = rec["move_date"]

                # 最新・異動事由
                key = tuple(rec[k] for k in person_key_cols)
                # 最新異動事由
                if key in latest_reason_map:
                    row[f"reason_transfer_{idx}"] = latest_reason_map[key]

                # ★★★ ここに "最新異動日" を横持ち ★★★
                if key in latest_date_map:
                    row[f"date_transfer_{idx}"] = latest_date_map[key]

            output_rows.append(row)

        result = pd.DataFrame(output_rows)

        # --- 数値カラムを int 化（欠損は空欄 ""） ---
        skip_cols = ["reason_transfer", "juki_address", "normalized_address"]
        for col in result.columns:
            # 異動事由は文字列 → 変換しない
            if col in skip_cols:
                continue
            try:
                result[col] = result[col].apply(
                    lambda x: (
                        int(float(x))
                        if pd.notna(x) and str(x).strip() != ""
                        else ""
                    )
                )
            except Exception:
                # 住所など変換できない列はスキップ
                pass
        return result

    def parse_date(self, s) -> Optional[pd.Timestamp]:
        """
        文字列 s を日付に変換して pd.Timestamp を返す。
        - 8桁の数字 (yyyymmdd) を優先して解釈
        - それ以外は pandas.to_datetime に任せる
        - 解釈できなければ None
        """
        if s is None:
            return None

        # Handle float type
        if isinstance(s, float):
            if pd.isna(s):
                return None
            s = int(s)  # 20200101.0 -> 20200101
        s = str(s).strip()
        if s == "" or s.lower() in ("nan", "nat", "none"):
            return None

        # 数字だけ抜き出し（例: "2022-04-01" → "20220401"）
        digits = re.sub(r"\D", "", s)
        if len(digits) == 8:
            try:
                y = int(digits[0:4])
                m = int(digits[4:6])
                d = int(digits[6:8])
                return pd.Timestamp(datetime(y, m, d))
            except Exception:
                pass

        # その他の形式は pandas にお任せ
        try:
            dt = pd.to_datetime(s, errors="coerce")
            if pd.isna(dt):
                return None
            return dt
        except Exception:
            return None

    def format_ymd(self, dt: Optional[pd.Timestamp]) -> str:
        """
        pd.Timestamp を "YYYY/MM/DD" 形式の文字列に変換。
        None の場合は空文字。
        """
        if dt is None:
            return ""
        return dt.strftime("%Y/%m/%d")

    def calc_age(
        self, birth: Optional[pd.Timestamp], base: Optional[pd.Timestamp]
    ) -> int:
        """
        基準日 base 時点での年齢（満年齢）を計算。
        計算できない場合は 0 を返す。
        """
        if birth is None or base is None:
            return 0
        years = base.year - birth.year
        # 誕生日がまだ来ていなければ1年引く
        if (base.month, base.day) < (birth.month, birth.day):
            years -= 1
        return max(years, 0)

    # --------- 行単位の計算ロジック ---------
    def compute_row(
        self,
        row: pd.Series,
        person_indices: List[int],
        base_date: pd.Timestamp,
    ) -> pd.Series:
        """
        1世帯（1行）に対して、指示された各値を計算して row に追加して返す。
        元のカラム（生年月日_i, 住定日_i, 異動日_i）は一切書き換えない。
        """
        return _compute_row_logic(
            row,
            person_indices,
            base_date,
            self.parse_date,
            self.calc_age,
            self.format_ymd,
        )

    def juki_aggregate(self, df):
        base_date = self.reference_date

        # --- 対象となる「人数 i」の index 抽出 ---
        # 生年月日_1, 生年月日_2, ... の番号部分を拾う
        person_indices: List[int] = []
        for col in df.columns:
            m = re.match(r"birth_date_(\d+)$", col)
            if m:
                person_indices.append(int(m.group(1)))
        person_indices = sorted(set(person_indices))

        if not person_indices:
            raise ValueError(
                "生年月日_* カラムが見つかりません。人ごとのカラム名を確認してください。"
            )

        # Use approximately 1/2 of available CPU cores
        total_cores = cpu_count()
        num_workers = max(1, total_cores // 2)

        # Split DataFrame into chunks based on number of workers
        rows_per_chunk = max(100, len(df) // num_workers)
        chunks = [
            df.iloc[i:i + rows_per_chunk].copy()
            for i in range(0, len(df), rows_per_chunk)
        ]

        # Prepare arguments for each chunk
        parse_date_func = self.parse_date
        calc_age_func = self.calc_age
        format_ymd_func = self.format_ymd

        args_list = [
            (
                chunk, person_indices, base_date,
                parse_date_func, calc_age_func, format_ymd_func
            )
            for chunk in chunks
        ]

        try:
            with ProcessPoolExecutor(
                max_workers=num_workers,
                mp_context=mp.get_context('spawn')
            ) as executor:
                results = list(
                    executor.map(_process_chunk_compute_row, args_list)
                )
            # Combine results
            df = pd.concat(results, ignore_index=True)
        except Exception as e:
            # Fallback to sequential processing if multiprocessing fails
            print(f"Multiprocessing failed: {e}, fallback to sequential")
            df = df.apply(
                lambda row: self.compute_row(row, person_indices, base_date),
                axis=1,
            )

        return df

    def to_norm_yyyymmdd(self, x):
        """
        日付文字列から数字だけを取り出し、8桁(YYYYMMDD)ならそのまま返す。
        それ以外は None。
        例: '2022/04/01' -> '20220401', 'R4.4.1' のような複雑なものは別途対応が必要。
        """
        if pd.isna(x):
            return None
        s = str(x)
        digits = "".join(ch for ch in s if ch.isdigit())
        if len(digits) == 8:
            return digits
        return None

    def filter_by_address_and_household(
        self,
        df,
        col_addr="normalized_address",
        col_household="household_code",
        col_people="num_householdsize_after_changes",
        base_date=None,
        idoubi_prefix="date_transfer_",
    ):
        """
        正規化住所が同じレコードのうち、
        ・世帯番号が異なる（複数存在）グループで
        ・かつ「異動反映後世帯人数 >= 1」のレコードがちょうど1件だけ
        の場合、その1件だけ残し、それ以外を削除する。

        ・「異動反映後世帯人数 >= 1」のレコードが 2 件以上ある場合は、その住所グループを全削除。
        ・「異動反映後世帯人数 >= 1」が 0 件の場合は、
            異動日_* カラムのうち、基準日から見て最も新しい日付を持つレコードを 1 行だけ残す。
            （有効な日付がない場合は先頭行を残す）

        base_date:
            基準日 (例: '20220401' や '2022/04/01')
            None の場合は基準日によるフィルタリングを行わず、単純に最大日付をとる。
        idoubi_prefix:
            異動日カラムのプレフィックス（デフォルト: '異動日' → '異動日_1', '異動日_2', ... を想定）
        """

        df = df.copy()

        # 基準日の正規化
        base_norm = (
            self.to_norm_yyyymmdd(base_date) if base_date is not None else None
        )

        # 異動反映後世帯人数を数値に変換（変換できないものは NaN）
        df[col_people] = pd.to_numeric(df[col_people], errors="coerce")

        def process_group(g: pd.DataFrame) -> pd.DataFrame:
            # 1件しかない ⇒ そのまま残す
            if len(g) == 1:
                return g

            # 世帯番号が複数なければフィルタ条件は適用しない
            if g[col_household].nunique() <= 1:
                return g

            # 異動反映後世帯人数 >= 1 のレコードをカウント
            mask_valid = g[col_people].fillna(0) >= 1
            cnt_valid = mask_valid.sum()

            # ===== ケース1：>=1 が 1件だけ ⇒ その1件だけ残す =====
            if cnt_valid == 1:
                return g[mask_valid]

            # ===== ケース2：>=1 が 2件以上 ⇒ グループ全削除 =====
            if cnt_valid >= 2:
                return g.iloc[0:0]  # 空のDFを返す

            # ===== ケース3：>=1 が 0件 ⇒ 異動日_* のうち基準日から見て最新レコードを1件残す =====
            # 対象となる異動日カラム一覧（例: '異動日_1', '異動日_2', ...）
            idou_cols = [c for c in g.columns if c.startswith(idoubi_prefix)]

            # 異動日カラムが存在しない場合は、従来どおり先頭行を残す
            if not idou_cols:
                return g.iloc[[0]]

            # 各行について「基準日以前の最新異動日(YYYYMMDD int)」を計算
            # 有効な日付が1つも無い行は -1 を返す
            def latest_idou_for_row(row):
                best = -1
                for c in idou_cols:
                    d_norm = self.to_norm_yyyymmdd(row.get(c))
                    if d_norm is None:
                        continue
                    # 基準日が指定されているときは「基準日以前」に限定
                    if base_norm is not None and d_norm > base_norm:
                        continue
                    try:
                        val = int(d_norm)  # '20220401' → 20220401
                    except ValueError:
                        continue
                    if val > best:
                        best = val
                return best

            g = g.copy()
            g["_latest_idou"] = g.apply(latest_idou_for_row, axis=1)

            # 有効な異動日が一つも無い場合 → 先頭行を残す
            if g["_latest_idou"].max() < 0:
                g = g.drop(columns=["_latest_idou"])
                return g.iloc[[0]]

            # _latest_idou が最大の行を代表行として選択
            idx = g["_latest_idou"].idxmax()
            row = g.loc[[idx]].drop(columns=["_latest_idou"])

            return row

        # 正規化住所ごとに処理
        result = df.groupby(col_addr, group_keys=False).apply(process_group)

        return result

    def process(self):

        try:
            # データの読み込み
            df = self.read_data(self.INPUT_PATHS["juki"])

            try:
                df["birth_date"] = df["birth_date"].map(format_date_as_yyyymmdd)
                df["move_date"] = df["move_date"].map(format_date_as_yyyymmdd)
                df["date_transfer"] = df["date_transfer"].map(format_date_as_yyyymmdd)
            except Exception:
                pass

            if df is None:
                return

            # 基準日以降の誕生と移動者を除外
            cols = COLUMNS["juki"]
            # 010_juki
            result = self.juki_setai(df, cols)

            # 020_jukihensu
            result = self.juki_aggregate(result)

            # 050_juki_tyofuku
            result = self.filter_by_address_and_household(
                result, "normalized_address", "household_code", "num_householdsize_after_changes", self.reference_date, "date_transfer_"
            )

            # 出力カラムの選択
            result["reference_date"] = self.reference_date
            # 出力
            self.save_csv(result, self.OUTPUT_PATHS["juki"])
        except Exception:
            if ERROR_CODE is None:
                set_error(ERROR_00028)
            raise Exception(
                "住居単位データ作成プロセスにおいて、住民基本台帳データの処理においてエラーが発生しました。"
            )


# 固定資産課税台帳、登記簿データの住所単位の集計
class TatemonoProcessor(DataProcessor):

    def extract_touki_info(
        self,
        series: pd.Series,
        search_word: str,
        base_date: datetime = pd.to_datetime("today"),
    ) -> pd.Series:
        """
        相続日や増築日などを抽出して、指定日(指定しなければ今日)までの経過日を計算する関数

        Parameters
        ----------
        df : pandas.Series
            登記内容カラム
        search_word : string
            抽出したいイベント
            例) '相続'、'増築'
        base_date : datetime, optional
            基準日。指定しなければ今日の日付を使用。
            例) pd.to_datetime('2023-10-01')
        Returns
        -------
        pandas.Series
            抽出結果Series
        """

    def split_touki_column(
        self, df: pd.DataFrame, touki_col: str
    ) -> pd.DataFrame:
        """
        登記事由列（yyyymmdd + 理由）を
        ・登記日
        ・登記事由_内容
        に分割して DataFrame に追加する。
        """
        if touki_col not in df.columns:
            raise ValueError(
                f"指定した登記事由カラムが見つかりません: {touki_col}"
            )

        try:
            df[touki_col] = df[touki_col].map(format_date_keep_suffix)
        except Exception:
            pass

        # 正規表現で先頭8桁を日付、それ以降を理由として分割
        extracted = (
            df[touki_col]
            .astype(str)
            .str.extract(r"^(?P<registration_date_yyyymmdd>\d{8})(?P<registration_reason_content>.*)$")
        )

        # 失敗した行は NaN になるので、そのまま結合（NaN のまま）
        df = df.copy()
        df["extracted_registration_date"] = extracted["registration_date_yyyymmdd"]
        df["extracted_registration_reason"] = extracted["registration_reason_content"].where(
            extracted["registration_reason_content"].notna(), None
        )

        return df

    def wide_by_normalized_address(
        self, df: pd.DataFrame, key_col: str
    ) -> pd.DataFrame:
        """
        正規化住所（key_col）をキーにしてレコードをJSON形式で集約する。
        - 必要な3列のみをJSON化: extracted_registration_reason, 
          extracted_registration_date, structure
        - その他の列は最初の値を保持する
        - 同じ住所内での順序は元の行順のまま（上から 1,2,3...）
        - 結果は `events_json` カラムにJSON文字列として保存される
        """
        if key_col not in df.columns:
            raise ValueError(f"キー列が見つかりません: {key_col}")

        df = df.copy()

        # 必要な列のみを選択
        cols = [key_col]
        target_cols = [
            "extracted_registration_reason",
            "extracted_registration_date",
            "structure"
        ]
        for c in target_cols:
            if c in df.columns:
                cols.append(c)
        
        df2 = df[cols].copy()

        # グループ化してJSON配列を作る（順序は元の順）
        def make_list(g):
            records = []
            # Use itertuples for better performance than iterrows
            for r in g.itertuples(index=False):
                # Get values, handling NaN/None
                def clean_value(val):
                    """Convert NaN/None/empty to None"""
                    if val is None:
                        return None
                    try:
                        # Check for pandas NaN
                        if pd.isna(val):
                            return None
                    except (TypeError, ValueError):
                        pass
                    # Check for empty string
                    val_str = str(val).strip()
                    if val_str == "" or val_str.lower() in ("nan", "none", "null"):
                        return None
                    return val_str if isinstance(val, str) else val
                
                records.append({
                    "reason": clean_value(getattr(r, "extracted_registration_reason", None)),
                    "date": clean_value(getattr(r, "extracted_registration_date", None)),
                    "structure": clean_value(getattr(r, "structure", None)),
                })
            return json.dumps(records, ensure_ascii=False)

        summary = df2.groupby(key_col, sort=False).apply(make_list).reset_index()
        summary.columns = [key_col, "events_json"]

        # 住所表に最低限の要約（件数）を追加
        def safe_count(s):
            try:
                return len(json.loads(s) if s else [])
            except (json.JSONDecodeError, TypeError):
                return 0
        
        summary["events_count"] = summary["events_json"].apply(safe_count)

        # その他の列（最初の値を保持）
        other_cols = [
            col for col in df.columns 
            if col not in target_cols + [key_col]
        ]
        
        if other_cols:
            first_row_df = df.groupby(key_col).first()[other_cols].reset_index()
            result = summary.merge(first_row_df, on=key_col, how="left")
        else:
            result = summary

        # Move key_col to first position
        cols = [key_col] + [c for c in result.columns if c != key_col]
        result = result[cols]

        return result

    def process(self):
        """
        建物データを処理し、構造分類を追加して出力する

        この関数は建物データを読み込み、無効な日付を処理し、構造を分類し、
        重複を除去した後、指定された出力カラムのみを選択して結果を保存します。

        Parameters
        ----------
        None

        Returns
        -------
        None
            処理結果はCSVファイルとして保存されます
        """
        cols = COLUMNS["tatemono"]

        # データの読み込み
        df_tatemono = self.read_data(
            self.INPUT_PATHS["tatemono"],
        )
        if df_tatemono is None:
            return

        try:
            df_tatemono["registration_date"] = df_tatemono["registration_date"].map(format_date_as_yyyymmdd)
        except Exception:
            pass

        try:
            # 070_toki_tyofuku
            # 1) 登記事由列の分割
            df_tatemono = self.split_touki_column(
                df_tatemono, cols["registration_reason"]
            )

            # 2) 正規化住所で横持ち
            df_tatemono = self.wide_by_normalized_address(
                df_tatemono, cols["tatemono_address"]
            )

            df_tatemono["reference_date"] = self.reference_date
        except:
            if ERROR_CODE is None:
                set_error(ERROR_00029)
            raise Exception(
                "住居単位データ作成プロセスにおいて、登記データの処理においてエラーが発生しました。"
            )

        # 出力
        self.save_csv(df_tatemono, self.OUTPUT_PATHS["tatemono"])


# すべてのデータを処理する関数を作成
def process_all_data(
    suido_use_file,
    suido_status_file,
    juki_file,
    tatemono_file,
    reference_date,
    search_period,
    output_directory,
    job_id,
    db_path=None,
    logs_dir=None,
):
    """
    すべてのデータファイルを処理する
    Parameters
    ----------
    suido_use_file : file
        水道使用量データファイル
    suido_status_file : file
        水道状況データファイル
    juki_file : file
        住民基本台帳データファイル
    tatemono_file : file
        建物データファイル
    reference_date : int
        基準日（YYYYMMDD形式）
    search_period : int
        検索期間（年）
    Returns
    -------
    list
        処理済みファイルのパスリスト
    """
    task_id = None
    logger = None
    try:
        if db_path:
            connect_sqllite(db_path)
        progress_percent = 0

        if logs_dir:
            logger = get_rotating_logger(logs_dir, logger_name="E013")
        else:
            logs_dir = os.path.join(output_directory, "logs")
            logger = get_rotating_logger(logs_dir, logger_name="E013")
        if job_id:
            task_id = create_or_update_job_task(
                job_id,
                progress_percent=progress_percent,
                preprocess_type="e013",
                error_code=None,
                error_msg=None,
                result=None,
            )
        # 入力ファイルのパスを設定
        # 各ファイルオブジェクトから名前（パス）を取得し、辞書形式で保存
        input_paths = {}

        # 各データ処理クラスを実行
        processors = {}

        # 出力ファイルのパスを設定
        # 処理後のファイルの保存先パスを辞書形式で定義
        output_paths = {}
        if juki_file:
            input_paths["juki"] = juki_file
            output_paths["juki"] = f"{output_directory}/juki_residence.csv"
            processors["juki"] = JukiProcessor
        if suido_status_file:
            input_paths["suido_status"] = suido_status_file
        if suido_use_file:
            input_paths["suido_use"] = suido_use_file
            output_paths["suido"] = f"{output_directory}/suido_residence.csv"
            processors["suido"] = SuidoProcessor
        if tatemono_file:
            input_paths["tatemono"] = tatemono_file
            output_paths["tatemono"] = (
                f"{output_directory}/touki_residence.csv"
            )
            processors["tatemono"] = TatemonoProcessor

        if output_directory is None:
            output_directory = "./E013/outputs"

        os.makedirs(output_directory, exist_ok=True)

        # Separate JukiProcessor (has internal parallelism) from others
        juki_processor = processors.pop("juki", None)
        other_processors = list(processors.values())

        # Run JukiProcessor first (it has its own ProcessPoolExecutor)
        if juki_processor:
            if job_id:
                create_or_update_job_task(
                    job_id,
                    progress_percent=50,
                    preprocess_type="e013",
                    error_code=None,
                    error_msg=None,
                    result=None,
                    id=task_id,
                )
                create_or_update_job(job_id, 50)
            juki_processor(
                input_paths, output_paths, reference_date, search_period
            ).process()

        # Run other processors in parallel
        if other_processors:
            processor_args = [
                (processor_class, input_paths, output_paths,
                 reference_date, search_period)
                for processor_class in other_processors
            ]

            try:
                num_workers = max(1, cpu_count() // 3)
                with ProcessPoolExecutor(
                    max_workers=num_workers,
                    mp_context=mp.get_context('spawn')
                ) as executor:
                    futures = [
                        executor.submit(_run_processor, args)
                        for args in processor_args
                    ]

                    # Wait for all to complete
                    for future in futures:
                        future.result()

                # Update progress after all parallel tasks complete
                if job_id:
                    create_or_update_job_task(
                        job_id,
                        progress_percent=80,
                        preprocess_type="e013",
                        error_code=None,
                        error_msg=None,
                        result=None,
                        id=task_id,
                    )
                    create_or_update_job(job_id, 80)
            except Exception as e:
                if logger:
                    logger.warning("Parallel failed:\n%s", traceback.format_exc())
                progress_percent_job = 50
                progress_percent = 50
                for processor_class in other_processors:
                    processor_class(
                        input_paths, output_paths, reference_date, search_period
                    ).process()
                    if job_id:
                        progress_percent += 10
                        progress_percent_job += 1
                        create_or_update_job_task(
                            job_id,
                            progress_percent=progress_percent,
                            preprocess_type="e013",
                            error_code=None,
                            error_msg=None,
                            result=None,
                            id=task_id,
                        )
                        create_or_update_job(job_id, progress_percent_job)

        if job_id:
            create_or_update_job_task(
                job_id,
                progress_percent="100",
                preprocess_type="e013",
                error_code=None,
                error_msg=None,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )

        return [path for path in output_paths.values() if os.path.exists(path)]
    except Exception as e:
        if logger:
            logger.error("E013 failed:\n%s", traceback.format_exc())
        if task_id is not None:
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type="e013",
                error_code=ERROR_CODE,
                error_msg=ERROR_MSG,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
        if ERROR_CODE is None:
            set_error(ERROR_00010)
            raise Exception(
                "住居単位データ作成プロセスにおいて、水道データの処理においてエラーが発生しました。"
            )
        raise Exception(e)


def normalize_dates(
    df,
    column,
    formats=[
        "%Y/%m/%d",
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%d-%m-%Y",
        "%m/%d/%Y",
        "%m-%d-%Y",
        "%Y%m%d",
    ],
):
    # Initialize the temporary column with NaN values
    temp_column = f"{column}_normalized"
    df[temp_column] = np.nan

    df[column] = df[column].astype(str).str.split().str[0].str.rstrip(".0")
    # Try the provided formats on the invalid values
    for fmt in formats:
        mask = df[temp_column].isna() & df[column].notna()
        df.loc[mask, temp_column] = pd.to_datetime(
            df.loc[mask, column], format=fmt, errors="coerce"
        )

    # Remove the time portion and keep only the date
    df[column] = pd.to_datetime(df[temp_column], errors="coerce")

    return df.drop(f"{column}_normalized", axis=1)


def set_error(value, param_st1=None, param_st2=None):
    global ERROR_CODE
    global ERROR_MSG
    ERROR_CODE = value["code"]
    if param_st1 is not None and param_st2 is not None:
        ERROR_MSG = value["message"].format(
            param_st1=param_st1, param_st2=param_st2
        )
    elif param_st1 is not None:
        ERROR_MSG = value["message"].format(param_st1=param_st1)
    else:
        ERROR_MSG = value["message"]


def _format_ymd(year: int, month: int, day: int) -> Optional[str]:
    """
    Format and validate year/month/day into yyyymmdd string.
    """
    # Quick bounds check
    if not (_MIN_YEAR <= year <= _MAX_YEAR and 1 <= month <= 12 and 1 <= day <= 31):
        return None

    try:
        # Only validate with datetime
        datetime(year, month, day)
        return f"{year:04d}{month:02d}{day:02d}"
    except (ValueError, OverflowError):
        return None


def format_date_as_yyyymmdd(s) -> Optional[str]:
    """
    任意の値を yyyymmdd 形式に正規化

    チェック順序を出現頻度で最適化:
    1. yyyymmdd (8桁) - データベースで最も一般的
    2. yyyy/mm/dd, yyyy-mm-dd - 次に一般的
    3. yyyy年mm月dd日 - やや一般的
    4. 和暦形式 - 最も稀

    対応形式:
    - yyyymmdd
    - yyyy/mm/dd, yyyy-mm-dd (月日は1桁または2桁)
    - yyyy年mm月dd日
    - 和暦: R07.01.10, 令和07.01.10 など
    """
    # Early exit for null/empty
    if pd.isna(s):
        return None

    # Handle float type (e.g., 20200101.0)
    if isinstance(s, float):
        s = int(s)

    s = str(s).strip()
    if not s:
        return None

    # ========================================================================
    # CASE 1: Already yyyymmdd
    # ========================================================================
    if len(s) == 8 and s.isdigit():
        # Use regex to extract year/month/day for validation
        match = _DATE_PATTERNS['yyyymmdd_8digit'].match(s)
        if match:
            year, month, day = int(match[1]), int(match[2]), int(match[3])
            # Quick validation
            if _MIN_YEAR <= year <= _MAX_YEAR and 1 <= month <= 12 and 1 <= day <= 31:
                try:
                    datetime(year, month, day)
                    return s
                except ValueError:
                    pass
        return None

    # ========================================================================
    # CASE 2: Western slash/hyphen (VERY COMMON)
    # ========================================================================
    if '/' in s or '-' in s:
        match = _DATE_PATTERNS['western_slash'].match(s)
        if match:
            return _format_ymd(int(match[1]), int(match[2]), int(match[3]))

    # ========================================================================
    # CASE 3: Western 年月日
    # ========================================================================
    if '年' in s:
        # Try western first (more common than era)
        match = _DATE_PATTERNS['western_ymd'].match(s)
        if match:
            return _format_ymd(int(match[1]), int(match[2]), int(match[3]))

        # Era with 年月日
        # Check 1-char first (R/H/S/T more common than 令和/平成)
        match = _DATE_PATTERNS['era_1char_ymd'].match(s)
        if match:
            era_key = match[1].upper()
            if era_key in _ERA_MAP:
                year = _ERA_MAP[era_key] + int(match[2])
                return _format_ymd(year, int(match[3]), int(match[4]))

        # 2-char era 
        match = _DATE_PATTERNS['era_2char_ymd'].match(s)
        if match:
            era_key = match[1]
            if era_key in _ERA_MAP:
                year = _ERA_MAP[era_key] + int(match[2])
                return _format_ymd(year, int(match[3]), int(match[4]))

    # ========================================================================
    # CASE 4: Era with dots/slashes
    # ========================================================================
    # Only check if we see era indicators
    first_char = s[0].upper() if s else ''

    if first_char in 'RHST' or s[:2] in ('令和', '平成', '昭和', '大正'):
        # 1-char era
        match = _DATE_PATTERNS['era_1char_dot'].match(s)
        if match:
            era_key = match[1].upper()
            if era_key in _ERA_MAP:
                year = _ERA_MAP[era_key] + int(match[2])
                return _format_ymd(year, int(match[3]), int(match[4]))

        # 2-char era
        match = _DATE_PATTERNS['era_2char_dot'].match(s)
        if match:
            era_key = match[1]
            if era_key in _ERA_MAP:
                year = _ERA_MAP[era_key] + int(match[2])
                return _format_ymd(year, int(match[3]), int(match[4]))
    print("None", s)
    return None


def format_date_keep_suffix(s) -> str:
    """
    日付部分をyyyymmdd形式に変換し、後続のテキストを保持する

    変換可能な場合: 日付をyyyymmddに変換 + 後続テキストを保持
    変換不可能な場合: 元の文字列をそのまま返す

    例:
    - "平成15年11月30日新築" → "20031130新築"
    - "昭和42年8月4日新築" → "19670804新築"
    - "抵当権設定" → "抵当権設定" (変換不可)
    """
    try:
        if pd.isna(s):
            return s

        original = str(s).strip()
        if not original:
            return original

        # ========================================================================
        # CASE 1: yyyymmdd (8 digits) + suffix
        # ========================================================================
        if len(original) >= 8 and original[:8].isdigit():
            match = _DATE_PATTERNS_WITH_SUFFIX['yyyymmdd_8digit'].match(original)
            if match:
                year, month, day = int(match[1]), int(match[2]), int(match[3])
                suffix = match[4]
                if _MIN_YEAR <= year <= _MAX_YEAR and 1 <= month <= 12 and 1 <= day <= 31:
                    try:
                        datetime(year, month, day)
                        return f"{year:04d}{month:02d}{day:02d}{suffix}"
                    except ValueError:
                        pass

        # ========================================================================
        # CASE 2: Western slash/hyphen + suffix
        # ========================================================================
        if '/' in original or '-' in original:
            match = _DATE_PATTERNS_WITH_SUFFIX['western_slash'].match(original)
            if match:
                formatted = _format_ymd(int(match[1]), int(match[2]), int(match[3]))
                if formatted:
                    return formatted + match[4]

        # ========================================================================
        # CASE 3: 年月日 formats + suffix
        # ========================================================================
        if '年' in original:
            # Western yyyy年mm月dd日
            match = _DATE_PATTERNS_WITH_SUFFIX['western_ymd'].match(original)
            if match:
                formatted = _format_ymd(int(match[1]), int(match[2]), int(match[3]))
                if formatted:
                    return formatted + match[4]

            # Era 1-char (R/H/S/T)
            match = _DATE_PATTERNS_WITH_SUFFIX['era_1char_ymd'].match(original)
            if match:
                era_key = match[1].upper()
                if era_key in _ERA_MAP:
                    year = _ERA_MAP[era_key] + int(match[2])
                    formatted = _format_ymd(year, int(match[3]), int(match[4]))
                    if formatted:
                        return formatted + match[5]

            # Era 2-char (令和/平成/昭和/大正)
            match = _DATE_PATTERNS_WITH_SUFFIX['era_2char_ymd'].match(original)
            if match:
                era_key = match[1]
                if era_key in _ERA_MAP:
                    year = _ERA_MAP[era_key] + int(match[2])
                    formatted = _format_ymd(year, int(match[3]), int(match[4]))
                    if formatted:
                        return formatted + match[5]

        # ========================================================================
        # CASE 4: Era with dots/slashes + suffix
        # ========================================================================
        first_char = original[0].upper() if original else ''

        if first_char in 'RHST' or original[:2] in ('令和', '平成', '昭和', '大正'):
            # 1-char era
            match = _DATE_PATTERNS_WITH_SUFFIX['era_1char_dot'].match(original)
            if match:
                era_key = match[1].upper()
                if era_key in _ERA_MAP:
                    year = _ERA_MAP[era_key] + int(match[2])
                    formatted = _format_ymd(year, int(match[3]), int(match[4]))
                    if formatted:
                        return formatted + match[5]

            # 2-char era
            match = _DATE_PATTERNS_WITH_SUFFIX['era_2char_dot'].match(original)
            if match:
                era_key = match[1]
                if era_key in _ERA_MAP:
                    year = _ERA_MAP[era_key] + int(match[2])
                    formatted = _format_ymd(year, int(match[3]), int(match[4]))
                    if formatted:
                        return formatted + match[5]

        # 変換不可能な場合は元の文字列を返す
        return original
    except:
        return s
