"""
# E014 テキストマッチング機能
* 任意のアセットに対しテキストマッチングによるインデキシング処理を行う機能。この機能には特定のワードをキーとした結合、除外、確率計算等が含まれる。
* テキストマッチングには完全一致と部分一致による結合方式を持つ。部分一致ではテキストマッチング度合いを示す類似率を算出する。ユーザーは部分一致において類似度の閾値を指定し、閾値以上の類似率のデータを結合する。

閾値以下の類似度の住所は"対応住所なし"として出力される.
入力は、住所を含むCSVファイル2つと、N-gramのサイズ、類似度の閾値を指定する.
出力は、2つのCSVファイルを住所をもとにマッチングした結果を含むCSVファイル.
"""

import json
import sys
from typing import List, Tuple, Optional
import io
import os
import re
import chardet
import pandas as pd
import polars as pl
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from scipy.sparse import csr_matrix
import numpy as np
import warnings
from datetime import datetime
import traceback
import gc

warnings.filterwarnings("ignore")
current_dir = os.path.dirname(os.path.abspath(__file__))
async_tasks_path = os.path.join(current_dir, "..", "async_tasks")
if async_tasks_path not in sys.path:
    sys.path.append(async_tasks_path)

try:
    from utils import *
    from constants import *
    from E012 import CleanData, KanjiConverter

except ImportError:
    sys.path.remove(async_tasks_path)
    sys.path.append(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
    )
    from async_tasks.utils import *
    from async_tasks.constants import *
    from src.E001_DataMatching.E012 import CleanData, KanjiConverter


OUTPUT_PATH = "matched_data.csv"
ERROR_CODE = None
ERROR_MSG = None


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


def read_data(path: str, **kwargs) -> pd.DataFrame:
    """
    CSVファイルを読み込む

    Parameters
    ----------
    path : str
        読み込むファイルのパス
    **kwargs : dict
        pandas.read_csv に渡す追加のキーワード引数

    Returns
    -------
    pd.DataFrame
        読み込まれたデータフレーム、エラー時はNone
    """
    try:
        # ファイルの拡張子を取得し、小文字に変換
        file_extension = os.path.splitext(path)[1].lower()

        # CSVファイル以外の場合はエラーを発生させる
        if file_extension != ".csv":
            set_error(ERROR_00026, file_extension)
            raise ValueError(
                f"CSVファイル以外は対応していません: {file_extension}"
            )

        # 複数のエンコーディングを試行
        encodings = ["utf-8-sig"]
        for encoding in encodings:
            try:
                # 各エンコーディングでファイルの読み込みを試みる
                return read_large_csv(path, encoding=encoding)
            except UnicodeDecodeError:
                # デコードエラーが発生した場合、次のエンコーディングを試す
                continue

        # 自動でエンコーディングを検出し、再度読み込みを試みる
        detected_encoding = detect_encoding(path)
        if detected_encoding:
            return read_large_csv(path, encoding=encoding)
        set_error(ERROR_00027, path)
        # 適切なエンコーディングが見つからない場合、エラーを発生させる
        raise ValueError(
            f"適切なエンコーディングが見つかりませんでした: {path}"
        )
    except Exception as e:
        # 何らかの例外が発生した場合、エラーメッセージを表示してNoneを返す
        if ERROR_CODE is None:
            set_error(ERROR_00011, path)
            raise Exception(
                "CSV形式（UTF-8 BOM付き）のファイルを入力してください。"
            )
        raise Exception(e)


def read_large_csv(path: str, encoding: str = 'utf-8-sig') -> pd.DataFrame:
    """
    Read large CSV with memory optimization
    """
    # Step 1: Read sample
    try:
        sample = pd.read_csv(
            path,
            encoding=encoding,
            engine='pyarrow'
        ).head(1000)
    except Exception:
        try:
            sample = pd.read_csv(
                path,
                encoding=encoding,
                nrows=1000,
                engine='c'
            )
        except Exception:
            sample = pd.read_csv(
                    path,
                    encoding=encoding,
                    nrows=100
                )

    # Step 2: Optimize dtypes
    dtypes = {}

    for col in sample.columns:
        try:
            col_data = sample[col]
            # Check if it's DataFrame (duplicate names)
            if isinstance(col_data, pd.DataFrame):
                # Use first occurrence
                col_type = col_data.iloc[:, 0].dtype
            else:
                col_type = col_data.dtype
        except Exception:
            continue

        if col_type == 'object':
            dtypes[col] = 'string'

        elif col_type == 'float64':
            # YYYYMMDD 形式の8桁日付整数値（例: 20121001）は
            # float32（有効桁数約7桁）に落とすと精度ロスで値が変質する
            # （20121001 → 20121000）。日付カラムを保護するためfloat64を維持
            dtypes[col] = 'float64'

        elif col_type == 'int64':
            non_null = sample[col].dropna()
            if len(non_null) > 0:
                try:
                    pd.to_numeric(non_null, errors='raise', downcast='integer')
                    col_min = sample[col].min()
                    col_max = sample[col].max()

                    if col_min >= 0:
                        if col_max < 255:
                            dtypes[col] = 'uint8'
                        elif col_max < 65535:
                            dtypes[col] = 'uint16'
                        else:
                            dtypes[col] = 'uint32'
                    else:
                        if col_min > -128 and col_max < 127:
                            dtypes[col] = 'int8'
                        elif col_min > -32768 and col_max < 32767:
                            dtypes[col] = 'int16'
                        else:
                            dtypes[col] = 'int32'
                except (ValueError, TypeError):
                    pass

    del sample
    gc.collect()

    # Step 3: Read and concat in batches
    result_chunks = []
    batch_size = 20
    chunk_list = []

    for chunk in pd.read_csv(
        path,
        encoding=encoding,
        chunksize=5000,
        dtype=dtypes,
        engine='c'
    ):
        chunk_list.append(chunk)

        # Concat when batch is full
        if len(chunk_list) >= batch_size:
            batch_result = pd.concat(chunk_list, ignore_index=True)
            result_chunks.append(batch_result)

            # Release memory immediately
            del chunk_list, batch_result
            gc.collect()
            chunk_list = []

    # Concat remaining chunks
    if chunk_list:
        batch_result = pd.concat(chunk_list, ignore_index=True)
        result_chunks.append(batch_result)
        del chunk_list, batch_result
        gc.collect()

    # Step 4: Final concat
    if result_chunks:
        df = pd.concat(result_chunks, ignore_index=True)
        del result_chunks
        gc.collect()
        return df
    else:
        return pd.DataFrame()


def get_column_names(csv_file: str) -> List[str]:
    """
    CSVファイルの列名を取得する

    Parameters
    ----------
    csv_file : str
        CSVファイルのパス

    Returns
    -------
    List[str]
        列名のリスト、エラー時は空のリスト
    """
    try:
        # CSVファイルを読み込む
        df = read_data(csv_file)
        # 列名のリストを返す
        return df.columns.tolist()
    except Exception as e:
        # エラーが発生した場合、メッセージを表示して空のリストを返す
        return []


def normalize_text(text):
    """
    テキストを正規化する（空白文字の除去）

    Parameters
    ----------
    text : str
        正規化するテキスト

    Returns
    -------
    str
        正規化されたテキスト
    """
    if pd.isna(text) or text is None:
        return text

    # 文字列に変換
    text = str(text)

    # 先頭末尾の空白文字を除去
    text = text.strip()

    # 連続する空白文字を単一の空白に置換
    text = re.sub(r"\s+", " ", text)

    return text


def add_flags_frame(df: pd.DataFrame) -> pd.DataFrame:
    """
    フラグを追加する
    """
    F_COLS = [
        "suido_usage_f1",
        "suido_usage_f2",
        "suido_usage_f3",
        "suido_usage_f4",
        "suido_usage_f5",
        "suido_usage_f6",
    ]

    for c in F_COLS:
        if c not in df.columns:
            raise ValueError(f"必要な列が見つかりません: {c}")
    vals = df[F_COLS].apply(pd.to_numeric, errors="coerce").to_numpy()

    # 連続2か月ゼロ
    zero = vals == 0
    consecutive_2 = (
        (zero[:, 0] & zero[:, 1])
        | (zero[:, 1] & zero[:, 2])
        | (zero[:, 2] & zero[:, 3])
        | (zero[:, 3] & zero[:, 4])
        | (zero[:, 4] & zero[:, 5])
    ).astype(int)

    all_null = np.isnan(vals).all(axis=1)
    consecutive_2 = consecutive_2.astype(object)
    consecutive_2[~all_null] = consecutive_2[~all_null].astype(int)  # 1/0 に変換
    consecutive_2[all_null] = ""

    f5, f6 = vals[:, 4], vals[:, 5]
    with np.errstate(divide="ignore", invalid="ignore"):
        rate = (f6 - f5) / f5

    rate[(f5 == 0) & (f6 == 0)] = 0.0  # Both zero → 0%
    rate[(f5 == 0) & (f6 > 0)] = 1.0   # From 0 to positive → 100%
    rate[(f5 == 0) & (f6 < 0)] = 0.0   # Invalid data → 0%

    df = df.copy()
    df["flag_zero_usage_over4consecutivemonths"] = consecutive_2
    df["change_rate_waterusage_over_last4months"] = rate
    return df


def usage_building_flag(
    input_path: str, output_path: str, job_id: str, db_path: str, task_id: str | None, task_id_summarization: int = None, result_summarization: str = None,
):
    if db_path:
        connect_sqllite(db_path)
    if job_id:
        create_or_update_job(job_id, "82")
        task_id = create_or_update_job_task(
            job_id,
            progress_percent="60",
            preprocess_type="e015",
            error_code=None,
            error_msg=None,
            result=None,
            id=task_id,
        )

    try:
        df_pl = pl.read_csv(
            input_path, encoding="utf-8-sig", infer_schema_length=0
        )
    except Exception:
        df = read_data(input_path)
        object_cols = df.select_dtypes(include=['object']).columns

        # Vectorized conversion: fillna then convert to string
        if len(object_cols) > 0:
            df[object_cols] = (
                df[object_cols].fillna('').astype(str)
            )
        df_pl = pl.from_pandas(df)
        del df

    # ----------------------------------------
    # 建物種別の有無に応じてフラグを付与するだけのロジック
    # ----------------------------------------
    # 「不明／欠損」を「判定不可」とする
    df_pl = df_pl.with_columns(
        pl.when(
            pl.col("usage_building_type_determination").is_null() | (pl.col("usage_building_type_determination") == "不明")
        )
        .then(pl.lit(1))
        .otherwise(pl.lit(0))
        .alias("buildingtype_determination_not_possible_flag")
    )

    if task_id_summarization:
        # Check if result_summarization is string, then load it
        if isinstance(result_summarization, str):
            result_summarization = json.loads(result_summarization)
        elif not isinstance(result_summarization, dict):
            result_summarization = {}

        # Calculate record combinations total (all records)
        record_combinations_total = len(df_pl)
        
        # Calculate record combinations statistics
        # Get flag columns
        flag_cols = {
            'suido_residence_flag': 'has_water_supply',
            'juki_residence_flag': 'has_juki_registry',
            'touki_residence_flag': 'has_touki_registry'
        }

        # Create flags dict for checking existence in dataframe
        existing_flags = {}
        for flag_col in flag_cols.keys():
            if flag_col in df_pl.columns:
                existing_flags[flag_col] = flag_cols[flag_col]

        # Calculate estimation target total count
        # (records with at least one flag = 1)
        if existing_flags:
            # Convert flag columns to numeric type before comparison
            # to handle cases where flags might be strings
            df_pl_numeric = df_pl.with_columns([
                pl.col(flag_col).cast(pl.Int64, strict=False)
                for flag_col in existing_flags.keys()
            ])

            condition = None
            for flag_col in existing_flags.keys():
                if condition is None:
                    condition = pl.col(flag_col) == 1
                else:
                    condition = condition | (pl.col(flag_col) == 1)
            estimation_target_total_count = df_pl_numeric.filter(
                condition
            ).height

            # Group by all flag columns and count
            group_cols = list(existing_flags.keys())
            combinations_df = df_pl_numeric.group_by(group_cols).agg(
                pl.count().alias('count')
            ).sort(group_cols)

            # Convert to pandas for easier iteration
            combinations_pd = combinations_df.to_pandas()

            record_combinations = []
            for _, row in combinations_pd.iterrows():
                combination = {}
                for flag_col, field_name in existing_flags.items():
                    # Convert to int for comparison (handle both int and string)
                    flag_value = int(row[flag_col]) if pd.notna(row[flag_col]) else 0
                    combination[field_name] = bool(flag_value == 1)
                combination['count'] = int(row['count'])
                if record_combinations_total > 0:
                    percentage = (
                        row['count'] / record_combinations_total * 100
                    )
                else:
                    percentage = 0.0
                combination['percentage'] = round(percentage, 2)
                record_combinations.append(combination)
        else:
            estimation_target_total_count = 0
            record_combinations = []

        # Update result_summarization with new fields
        result_summarization['estimation_target_total_count'] = (
            estimation_target_total_count
        )
        result_summarization['record_combinations'] = (
            record_combinations
        )
        result_summarization['record_combinations_total'] = (
            record_combinations_total
        )

        # Check if geometry_plateau column exists
        # Convert to string and check if it contains "Polygon" or "MultiPolygon"
        if 'geometry_plateau' in df_pl.columns:
            geom_str = df_pl['geometry_plateau'].cast(pl.Utf8)
            
            # Count records with null geometry_plateau
            excluded_from_display_count = df_pl.filter(
                pl.col('geometry_plateau').is_null()
            ).height
            
            is_polygon = (
                geom_str.str.contains('POLYGON', literal=False) |
                geom_str.str.contains('MULTIPOLYGON', literal=False)
            ).fill_null(False)
            is_point = (
                geom_str.str.contains('POINT', literal=False)
            ).fill_null(False)
        else:
            # geometry_plateau がない場合、ジオコーディング座標で判定
            is_polygon = pl.Series(
                [False] * len(df_pl),
                dtype=pl.Boolean
            )
            if (
                'latitude_geocoding_cleaned' in df_pl.columns
                and 'longitude_geocoding_cleaned' in df_pl.columns
            ):
                has_lat = (
                    pl.col('latitude_geocoding_cleaned').is_not_null()
                    & (pl.col('latitude_geocoding_cleaned') != '')
                )
                has_lon = (
                    pl.col('longitude_geocoding_cleaned').is_not_null()
                    & (pl.col('longitude_geocoding_cleaned') != '')
                )
                is_point = df_pl.select(
                    (has_lat & has_lon).alias('v')
                )['v']
                excluded_from_display_count = len(df_pl) - is_point.sum()
            else:
                is_point = pl.Series(
                    [False] * len(df_pl),
                    dtype=pl.Boolean
                )
                excluded_from_display_count = len(df_pl)

        # building_polygon_display: has Polygon/MultiPolygon geometry
        building_polygon_display_count = is_polygon.sum()

        # point_display: has Point geometry
        point_display_count = is_point.sum()

        # Total includes excluded records
        building_polygon_breakdown_total = estimation_target_total_count

        # Calculate percentages
        if building_polygon_breakdown_total > 0:
            building_polygon_display_pct = round(
                building_polygon_display_count / building_polygon_breakdown_total * 100, 2
            )
            point_display_pct = round(
                point_display_count / building_polygon_breakdown_total * 100, 2
            )
            excluded_from_display_pct = round(
                excluded_from_display_count / building_polygon_breakdown_total * 100, 2
            )
        else:
            building_polygon_display_pct = 0.0
            point_display_pct = 0.0
            excluded_from_display_pct = 0.0

        # Update result_summarization with new fields
        result_summarization['building_polygon_breakdown'] = {
            'with_polygon': {
                'percentage': building_polygon_display_pct,
                'count': int(building_polygon_display_count)
            },
            'without_polygon': {
                'percentage': point_display_pct,
                'count': int(point_display_count)
            },
            'excluded_from_display': {
                'percentage': excluded_from_display_pct,
                'count': int(excluded_from_display_count)
            }
        }
        result_summarization['building_polygon_breakdown_total'] = (
            building_polygon_breakdown_total
        )

        _, result_summarization_updated = create_or_update_summarization_job_task(
            job_id,
            "30",
            "preprocess_summary",
            json.dumps(result_summarization),
            id=task_id_summarization,
            is_finish=True,
        )

    if job_id:
        create_or_update_job(job_id, "95")
        create_or_update_job_task(
            job_id,
            progress_percent="100",
            preprocess_type="e015",
            error_code=None,
            error_msg=None,
            result=None,
            id=task_id,
            is_finish=True,
        )

    save_csv(df_pl.to_pandas(), output_path)


def translate_column_name(
    input_path: str,
    output_path: str,
    keep_original_suffixes: Optional[tuple] = None,
    keep_suffix_intact: Optional[tuple] = None,
):
    """
    Translate known columns to Japanese. Columns whose names end with any of
    keep_original_suffixes are kept as-is (no translation), for optional_data_source
    and vacant_house outputs.
    """
    try:
        df_pl = pl.read_csv(
            input_path, encoding="utf-8-sig", infer_schema_length=0
        )
    except Exception:
        # Fallback to pandas if Polars fails
        df = read_data(input_path, index_col=False)
        object_cols = df.select_dtypes(include=['object']).columns

        # Vectorized conversion: fillna then convert to string
        if len(object_cols) > 0:
            df[object_cols] = (
                df[object_cols].fillna('').astype(str)
            )
        df_pl = pl.from_pandas(df)
        del df

    cols = df_pl.columns
    if "geometry_plateau" in cols:
        if "geometry" not in cols or df_pl["geometry"].is_null().all():
            df_pl = df_pl.with_columns(
                pl.col("geometry_plateau").alias("geometry")
            )

    # Include translated columns + columns that keep original names (optional_data_source / vacant_house)
    available_columns = [
        col for col in TRANSLATE_COLUMNS_IF001 if col in df_pl.columns
    ]
    if keep_original_suffixes:
        for col in df_pl.columns:
            if col in available_columns:
                continue
            if any(col.endswith(s) for s in keep_original_suffixes):
                available_columns.append(col)
    if keep_suffix_intact:
        for col in df_pl.columns:
            if col in available_columns:
                continue
            if any(col.endswith(s) for s in keep_suffix_intact):
                available_columns.append(col)
    df_pl = df_pl.select(available_columns)

    # Rename only columns that have a translation; others keep original name
    rename_map = {
        col: TRANSLATE_COLUMNS_IF001[col]
        for col in df_pl.columns
        if col in TRANSLATE_COLUMNS_IF001
    }
    if rename_map:
        df_pl = df_pl.rename(rename_map)

    # Export: strip long optional suffixes (_optional_data_source_cleaned, _vacant_house_cleaned);
    # if duplicate names after strip, use _1, _2, ...
    if keep_original_suffixes:
        col_list = df_pl.columns
        base_names = []
        for col in col_list:
            base = col
            for s in keep_original_suffixes:
                if col.endswith(s):
                    base = col[: -len(s)].rstrip("_") or col
                    break
            base_names.append((col, base))

        # Resolve duplicates: same base -> base_1, base_2, ...
        from collections import defaultdict
        base_to_indices = defaultdict(list)
        for i, (_, base) in enumerate(base_names):
            base_to_indices[base].append(i)
        final_name_by_idx = {}
        for base, indices in base_to_indices.items():
            if len(indices) == 1:
                final_name_by_idx[indices[0]] = base
            else:
                for k, idx in enumerate(indices):
                    final_name_by_idx[idx] = f"{base}_{k + 1}"
        rename_export = {
            base_names[i][0]: final_name_by_idx[i] for i in range(len(base_names))
        }
        if rename_export:
            df_pl = df_pl.rename(rename_export)

    df = df_pl.to_pandas()

    save_csv(df, output_path)


def convert_8digit_float_cols(df: pd.DataFrame) -> pd.DataFrame:
    """
    20170818.0 のような float 表現をすべて int (20170818) に正規化する。
    対象は「8桁の数字の形に変換可能なセル」すべて。
    """
    for col in df.columns:
        ser = df[col].fillna("").astype(str).astype(object).str.strip()

        # float化→整数化を試みる
        ser2 = ser.str.replace(".0$", "", regex=True)

        # 8桁数字のみ変換対象
        mask = ser2.str.match(r"^\d{8}$")

        if mask.any():
            df.loc[mask, col] = ser2.loc[mask]

    return df


def hensu_150(input_csv: str, output_csv: str, base_date_str: str):
    try:
        df = read_data(input_csv)
        # add_flags_frame / calc_jutei_age_water を除去:
        # 新パイプライン(aggregate_usage + add_water_features)が同等の特徴量を
        # 正しく計算済みであり、これらは旧式の再計算で値を上書きしていた
        df = convert_8digit_float_cols(df)
        df = add_structure_and_reason_flags(df, base_date_str)

        output_path = save_csv(df, output_csv)
        return output_path
    except Exception as e:
        traceback.print_exc()
        print(e)
        raise Exception(e)


def parse_yyyymmdd(value: str) -> Optional[datetime]:
    """YYYYMMDD / YYYYMMDD.0 / YYYY/MM/DD / YYYY-MM-DD などを許容"""
    if pd.isna(value):
        return None
    s = str(value).strip()
    if not s:
        return None

    # 末尾の .0 を削る（20220101.0 → 20220101）
    if s.endswith(".0"):
        s = s[:-2]

    # 純粋な8桁数字 YYYYMMDD
    if s.isdigit() and len(s) == 8:
        try:
            return datetime.strptime(s, "%Y%m%d")
        except ValueError:
            return None

    # スラッシュ・ハイフン形式も試す
    for fmt in ("%Y/%m/%d", "%Y-%m-%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass

    return None


def parse_base_date(base_date_str: str) -> pd.Timestamp:
    base_date_str = str(base_date_str).strip()
    if re.fullmatch(r"\d{8}", base_date_str):
        dt = pd.to_datetime(base_date_str, format="%Y%m%d", errors="coerce")
    else:
        dt = pd.to_datetime(base_date_str, errors="coerce")
    if pd.isna(dt):
        raise ValueError(
            f"基準日 '{base_date_str}' を日付として解釈できません。"
        )
    return dt


def _parse_events_json(value) -> list:
    """events_json_touki_residence の1セルを events リストに復元する。

    CSV 経由の二重クォート（"" → "）を補正する。壊れていれば空リスト。
    """
    try:
        if pd.isna(value):
            return []
    except (TypeError, ValueError):
        pass
    if not value or (isinstance(value, str) and not value.strip()):
        return []
    if isinstance(value, list):
        return value
    if not isinstance(value, str):
        return []
    try:
        events = json.loads(value.replace('""', '"'))
    except (json.JSONDecodeError, TypeError):
        return []
    return events if isinstance(events, list) else []


def add_registration_duration_features(
    df: pd.DataFrame, base_date: pd.Timestamp
) -> pd.DataFrame:
    """登記イベントから案Eの経過年数3指標（満年数）を付与する。

    - building_age_years       築年数 = 基準日 − 最古登記日付
    - years_since_inheritance  相続後経過年数 = 基準日 − 直近の相続日
    - years_since_extension    増築後経過年数 = 基準日 − 直近の増築日

    採用ルール（issue #1777 の設計判断）:
    - 相続・増築が複数ある場合は直近（最新）の発生日を採用
    - 築年数は最古の登記日付を起点
    - 基準日を超える未来日のイベントは除外
    該当イベントが無い指標は空文字。
    """
    oldest: dict = {}
    inheritance: dict = {}
    extension: dict = {}

    if "events_json_touki_residence" in df.columns:
        for row in df.itertuples():
            idx = row.Index
            events = _parse_events_json(
                getattr(row, "events_json_touki_residence", "")
            )
            for event in events:
                if not isinstance(event, dict):
                    continue
                reason = str(event.get("reason") or "").strip()
                parsed = parse_yyyymmdd(event.get("date"))
                if parsed is None:
                    continue
                event_date = pd.Timestamp(parsed)
                if event_date > base_date:
                    continue
                if idx not in oldest or event_date < oldest[idx]:
                    oldest[idx] = event_date
                if "相続" in reason and (
                    idx not in inheritance or event_date > inheritance[idx]
                ):
                    inheritance[idx] = event_date
                if "増築" in reason and (
                    idx not in extension or event_date > extension[idx]
                ):
                    extension[idx] = event_date

    def _years_since(picked: dict) -> pd.Series:
        col = pd.Series([""] * len(df), index=df.index, dtype=object)
        for idx, event_date in picked.items():
            years = int((base_date - event_date).days // 365.25)
            col.loc[idx] = str(years)
        return col

    df["building_age_years"] = _years_since(oldest)
    df["years_since_inheritance"] = _years_since(inheritance)
    df["years_since_extension"] = _years_since(extension)
    return df


def add_structure_and_reason_flags(
    df: pd.DataFrame, base_date_str: str
) -> pd.DataFrame:

    base_date = parse_base_date(base_date_str)

    # 0. 案E: 事由別の経過年数（築年数 / 相続後経過年数 / 増築後経過年数）
    df = add_registration_duration_features(df, base_date)
    # ==========================
    # 1. 登記構造 → 構造フラグ
    # ==========================
    # Parse structure from JSON (first event's structure)
    structure_col = pd.Series([""] * len(df), index=df.index)
    if "events_json_touki_residence" in df.columns:
        # Use itertuples for better performance
        for row in df.itertuples():
            idx = row.Index
            events_json = getattr(row, "events_json_touki_residence", "")
            # Check for None, pd.NA, empty string (avoid boolean conversion of NA)
            try:
                if pd.isna(events_json):
                    continue
            except (TypeError, ValueError):
                pass
            if events_json and (not isinstance(events_json, str) or events_json.strip()):
                try:
                    # Handle double-quoted JSON from CSV
                    if isinstance(events_json, str):
                        events_json_clean = events_json.replace('""', '"')
                        events = json.loads(events_json_clean)
                    else:
                        events = events_json
                    if isinstance(events, list) and len(events) > 0:
                        structure_col.loc[idx] = str(events[0].get("structure", "")).strip()
                except (json.JSONDecodeError, TypeError):
                    pass
    
    # Fallback to old column if exists (for backward compatibility)
    if "structure_1_touki_residence" in df.columns:
        mask_missing = structure_col == ""
        structure_col.loc[mask_missing] = (
            df.loc[mask_missing, "structure_1_touki_residence"]
            .fillna("").astype(str).astype(object).str.strip()
        )

    mask_cb = structure_col.str.startswith("コンクリートブロック")
    mask_brick = structure_col.str.startswith(
        "煉瓦"
    ) | structure_col.str.startswith("レンガ")
    mask_rc = structure_col.str.startswith(
        "鉄筋コンクリート"
    ) | structure_col.str.startswith("RC造")
    mask_steel = (
        structure_col.str.startswith("鉄骨")
        | structure_col.str.startswith("軽量鉄骨")
        | structure_col.str.startswith("S造")
    )
    mask_wood = structure_col.str.startswith("木")
    mask_soil = structure_col.str.startswith("土")

    mask_any_structure = structure_col.str.contains(r"[一-龥ぁ-ゟァ-ヿ]")
    mask_other = mask_any_structure & ~(
        mask_cb | mask_brick | mask_rc | mask_steel | mask_wood | mask_soil
    )

    for col in [
        "flag_concreteblock",
        "flag_brick",
        "flag_reinforcedconcreteconstruction",
        "flag_steelframe",
        "flag_wood",
        "flag_earthen",
        "flag_otherstructures",
    ]:
        df[col] = ""

    df.loc[mask_cb, "flag_concreteblock"] = "1"
    df.loc[mask_brick, "flag_brick"] = "1"
    df.loc[mask_rc, "flag_reinforcedconcreteconstruction"] = "1"
    df.loc[mask_steel, "flag_steelframe"] = "1"
    df.loc[mask_wood, "flag_wood"] = "1"
    df.loc[mask_soil, "flag_earthen"] = "1"
    df.loc[mask_other, "flag_otherstructures"] = "1"

    return df


def calc_jutei_age_water(df: pd.DataFrame):
    # ==================================================
    # 3) 計量水量_* から 最大 / 平均 / 合計 使用水量
    # ==================================================
    usage_cols = [c for c in df.columns if c.startswith("suido_usage_")]

    # 初期化（列がなくても動くようにしておく）
    df["max_water_usage"] = ""
    df["avg_water_usage"] = ""
    df["average_waterusage_person"] = ""

    if not usage_cols:
        print(
            "計量水量_ で始まるカラムが見つかりません（使用水量集計はスキップ）"
        )
    else:
        print("対象となる計量水量カラム:", usage_cols)

        usage_df = pd.DataFrame(index=df.index)
        for col in usage_cols:
            # 数値に変換（カンマ除去を想定、数字以外は NaN）
            s = df[col].fillna("").astype(str).astype(object).str.replace(",", "", regex=False)
            usage_df[col] = pd.to_numeric(s, errors="coerce")

        # 行ごとに、少なくとも1つ有効な数値があるか
        has_any_value = usage_df.notna().any(axis=1)

        # 最大
        max_usage = usage_df.max(axis=1, skipna=True)
        df["max_water_usage"] = max_usage.where(has_any_value, "").astype(object)
        # 平均
        mean_usage = usage_df.mean(axis=1, skipna=True)
        df["avg_water_usage"] = mean_usage.where(has_any_value, "").astype(object)

        # 一人当たり平均検針水量 / 一人当たり検針水量
        household_col = "household_size_juki_residence"
        if household_col in df.columns:
            hh_raw = (
                df[household_col].fillna("").astype(str).astype(object).str.replace(",", "", regex=False)
            )
            hh = pd.to_numeric(hh_raw, errors="coerce")

            valid = has_any_value & hh.gt(0) & mean_usage.notna()
            per_capita = (mean_usage / hh).where(valid)

            df["average_waterusage_person"] = per_capita.where(
                per_capita.notna(), ""
            ).astype(object)
        else:
            print(
                "異動反映後世帯人数 カラムが見つからないため、一人当たり平均使用水量は作成しません。"
            )
            df["average_waterusage_person"] = ""

    return df


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
    # 絶対パスに変換
    abs_path = os.path.abspath(path)

    # 試行するエンコーディングのリスト
    encodings = ["utf-8-sig"]
    for encoding in encodings:
        try:
            # 各エンコーディングでCSVファイルとして保存を試みる
            df.to_csv(abs_path, encoding=encoding, index=False)
            return abs_path
        except Exception as e:
            set_error(ERROR_00012, abs_path, encoding)

    return None


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
