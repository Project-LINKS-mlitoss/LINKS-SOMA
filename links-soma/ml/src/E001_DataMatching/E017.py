import json
import sys
from pathlib import Path
from typing import Tuple
import io
import os
import re
import shutil
import chardet
import pandas as pd
import polars as pl
import warnings
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
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
    from async_tasks.utils import *
    from async_tasks.constants import *
    from src.E001_DataMatching.E012 import CleanData, KanjiConverter


ERROR_CODE = None
ERROR_MSG = None
FILE_NAME_JP = {
    "suido_status": "水道閉開栓状況",
    "juki": "住民基本台帳",
    "touki": "建物情報",
    "geocoding": "ジオコーディング済みデータ",
    "building_type_determination": "建物種別判定用データ",
}

# Mapping for target name in result
TARGET_NAME_MAP = {
    "juki": "resident_registry",
    "touki": "building_registry",
    "geocoding": "geocoding",
    "building_type_determination": "building_type_determination",
}


def get_versioned_folder(
    base_path: Path, folder_prefix: str = "E017", max_versions: int = 5
) -> Path:
    """
    Create a versioned folder with _1, _2, etc. suffix inside base_path.
    Maximum 5 versions allowed. If exceeded, delete oldest versions.

    Parameters
    ----------
    base_path : Path
        Parent folder where versioned folders will be created
    folder_prefix : str
        Prefix for versioned folders (default: "E017")
    max_versions : int
        Maximum number of versioned folders (default: 5)

    Returns
    -------
    Path
        The folder path to use (created)

    Example
    -------
    base_path = /path/to/output/uuid/
    Run 1: /path/to/output/E017_1/
    Run 2: /path/to/output/E017_2/
    ...
    Run 5: /path/to/output/E017_5/
    Run 6: /path/to/output/E017_6/ (delete E017_1)
    """
    parent = Path(base_path).parent
    parent.mkdir(parents=True, exist_ok=True)
    base_name = folder_prefix

    # Find all existing versioned folders (E017_1, E017_2, ...)
    pattern = re.compile(rf"^{re.escape(base_name)}_(\d+)$")
    existing_versions = []

    for item in parent.iterdir():
        if item.is_dir():
            match = pattern.match(item.name)
            if match:
                existing_versions.append(int(match.group(1)))

    # Determine next version number (start from 1)
    if not existing_versions:
        next_version = 1
    else:
        next_version = max(existing_versions) + 1

    # Create the new versioned folder
    new_folder = parent / f"{base_name}_{next_version}"
    new_folder.mkdir(parents=True, exist_ok=True)

    # Delete oldest if exceeding max_versions
    existing_versions.append(next_version)
    existing_versions.sort()

    while len(existing_versions) > max_versions:
        oldest = existing_versions.pop(0)
        oldest_path = parent / f"{base_name}_{oldest}"
        if oldest_path.exists():
            shutil.rmtree(oldest_path)

    return new_folder


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
            raise ValueError(f"CSVファイル以外は対応していません: {file_extension}")

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
        raise ValueError(f"適切なエンコーディングが見つかりませんでした: {path}")
    except Exception as e:
        # 何らかの例外が発生した場合、エラーメッセージを表示してNoneを返す
        if ERROR_CODE is None:
            set_error(ERROR_00011, path)
            raise Exception("CSV形式（UTF-8 BOM付き）のファイルを入力してください。")
        raise Exception(e)


def read_large_csv(path: str, encoding: str = "utf-8-sig") -> pd.DataFrame:
    """
    Read large CSV with memory optimization
    """
    # Step 1: Read sample
    try:
        sample = pd.read_csv(path, encoding=encoding, engine="pyarrow").head(1000)
    except Exception:
        try:
            sample = pd.read_csv(path, encoding=encoding, nrows=1000, engine="c")
        except Exception:
            sample = pd.read_csv(path, encoding=encoding, nrows=100)

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

        if col_type == "object":
            dtypes[col] = "string"

        elif col_type == "float64":
            # YYYYMMDD 形式の8桁日付整数値（例: 20121001）は
            # float32（有効桁数約7桁）に落とすと精度ロスで値が変質する
            dtypes[col] = "float64"

        elif col_type == "int64":
            non_null = sample[col].dropna()
            if len(non_null) > 0:
                try:
                    pd.to_numeric(non_null, errors="raise", downcast="integer")
                    col_min = sample[col].min()
                    col_max = sample[col].max()

                    if col_min >= 0:
                        if col_max < 255:
                            dtypes[col] = "uint8"
                        elif col_max < 65535:
                            dtypes[col] = "uint16"
                        else:
                            dtypes[col] = "uint32"
                    else:
                        if col_min > -128 and col_max < 127:
                            dtypes[col] = "int8"
                        elif col_min > -32768 and col_max < 32767:
                            dtypes[col] = "int16"
                        else:
                            dtypes[col] = "int32"
                except (ValueError, TypeError):
                    pass

    del sample
    gc.collect()

    # Step 3: Read and concat in batches
    result_chunks = []
    batch_size = 20
    chunk_list = []

    for chunk in pd.read_csv(
        path, encoding=encoding, chunksize=5000, dtype=dtypes, engine="c"
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


def lev_match(
    main_csv: io.BytesIO | str,
    input_source: list[str],
    output_path: str,
    job_id: str = None,
    db_path: str = None,
    logs_dir=None,
    output_directory: str = None,
    threshold: float = 0.8,
    max_number: int = 5,
    debug: bool = False,
) -> Tuple[str, str]:
    task_id = None
    logger = None
    address_column = "normalized_address"
    try:
        if logs_dir:
            logger = get_rotating_logger(logs_dir, logger_name="E017")
        else:
            logs_dir = os.path.join(output_path, "logs")
            logger = get_rotating_logger(logs_dir, logger_name="E017")

        output_E017 = get_versioned_folder(Path(output_directory))

        progress_percent_job = 50
        progress_percent = 45 / len(input_source)
        if db_path:
            connect_sqllite(db_path)
            progress_percent = progress_percent / 4
        if job_id:
            create_or_update_job(job_id, "51")

        output_dir = os.path.dirname(output_path)

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # メインデータを全て大字レベルに集約
        main_df = read_data(main_csv)
        object_cols_main = main_df.select_dtypes(include=["object"]).columns
        if len(object_cols_main) > 0:
            main_df[object_cols_main] = main_df[object_cols_main].fillna("").astype(str)
        main_pl = pl.from_pandas(main_df)
        del main_df
        gc.collect()

        main_addr_pl = main_pl.select([address_column]).filter(
            pl.col(address_column).is_not_null()
        )
        del main_pl
        gc.collect()

        main_pivot = pivot_address(main_addr_pl, address_column, set(), True, "address_oaza")
        del main_addr_pl
        gc.collect()

        if debug:
            save_csv(main_pivot.to_pandas(), f"{output_directory}/main_pivot.csv")

        # 水道データの大字住所セットを構築
        main_oaza_set = set(
            main_pivot.filter(
                pl.col("address_oaza").is_not_null() & (pl.col("address_oaza") != "")
            ).get_column("address_oaza").to_list()
        )

        for item in input_source:
            sub_csv = f"{output_directory}/{item}_cleaned.csv"
            sub_df = read_data(sub_csv)

            if job_id:
                progress_percent_job = progress_percent_job + progress_percent
                create_or_update_job(job_id, progress_percent_job)
                task_id = create_or_update_job_task(
                    job_id,
                    progress_percent="20",
                    preprocess_type="e017",
                    error_code=None,
                    error_msg=None,
                    result=None,
                )

            # サブデータを全て大字レベルに集約
            object_cols_sub = sub_df.select_dtypes(include=["object"]).columns
            if len(object_cols_sub) > 0:
                sub_df[object_cols_sub] = sub_df[object_cols_sub].fillna("").astype(str)
            sub_pl = pl.from_pandas(sub_df)
            del sub_df
            gc.collect()

            sub_addr_pl = sub_pl.select([address_column]).filter(
                pl.col(address_column).is_not_null()
            )
            del sub_pl
            gc.collect()

            sub_pivot = pivot_address(sub_addr_pl, address_column, set(), True, "address_oaza")
            del sub_addr_pl
            gc.collect()

            if debug:
                save_csv(sub_pivot.to_pandas(), f"{output_directory}/{item}_sub_pivot.csv")

            if job_id:
                create_or_update_job(job_id, progress_percent_job)
                create_or_update_job_task(
                    job_id,
                    progress_percent="40",
                    preprocess_type="e017",
                    error_code=None,
                    error_msg=None,
                    result=None,
                    id=task_id,
                )

            # サブデータにあって水道データにない大字住所を候補として抽出
            candidates_pivot = extract_candidates(sub_pivot, main_oaza_set)
            del sub_pivot
            gc.collect()

            if debug:
                save_csv(
                    candidates_pivot.to_pandas(),
                    f"{output_directory}/{item}_candidates_pivot.csv",
                )

            if job_id:
                create_or_update_job(job_id, progress_percent_job)
                create_or_update_job_task(
                    job_id,
                    progress_percent="60",
                    preprocess_type="e017",
                    error_code=None,
                    error_msg=None,
                    result=None,
                    id=task_id,
                )

            # 候補住所に対して水道データ大字住所から類似検索
            lev_match_result = addr_lev_match(
                candidates_pivot,
                main_pivot,
                threshold,
                address_column="address_oaza",
                count_col="normalized_address",
                block=0,
                topk=max_number,
                item=item,
            )

            if job_id:
                create_or_update_job(job_id, progress_percent_job)
                create_or_update_job_task(
                    job_id,
                    progress_percent="80",
                    preprocess_type="e017",
                    error_code=None,
                    error_msg=None,
                    result=None,
                    id=task_id,
                )

            result_path = output_E017 / f"{item}_lev_match.csv"

            # 類似検索結果を候補住所ごとにまとめる
            candidates_dict = {}
            if lev_match_result.height > 0:
                lev_match_df = lev_match_result.to_pandas()
                item_address_col = f"{item}_address"
                for source_addr, group in lev_match_df.groupby(item_address_col):
                    candidates = []
                    for _, row in group.iterrows():
                        if pd.notna(row["suido_address"]) and row["suido_address"].strip():
                            try:
                                suido_count = (
                                    int(row["suido_count"])
                                    if row["suido_count"] and str(row["suido_count"]).strip()
                                    else 0
                                )
                            except (ValueError, TypeError):
                                suido_count = 0
                            candidates.append(
                                {
                                    "address": row["suido_address"].strip(),
                                    "count": suido_count,
                                }
                            )
                    if candidates:
                        candidates_dict[source_addr] = candidates

            # 候補住所ごとの件数マップ
            source_count_map = {}
            for row in candidates_pivot.iter_rows(named=True):
                addr = row.get("address_oaza", "")
                count = row.get("normalized_address", 0)
                source_count_map[addr if addr else ""] = (
                    int(count) if count is not None else 0
                )

            # 候補住所一覧（全件）から未結合レコードを生成
            unmatched_records = []
            for source_addr in candidates_pivot.filter(
                pl.col("address_oaza").is_not_null()
            ).get_column("address_oaza").to_list():
                addr_key = source_addr if source_addr is not None else ""
                unmatched_records.append(
                    {
                        "sourceAddress": addr_key,
                        "sourceCount": source_count_map.get(addr_key, 0),
                        "candidates": candidates_dict.get(source_addr, []),
                    }
                )

            target_name = TARGET_NAME_MAP.get(item, item)
            res = {
                "taskResultType": "join_check",
                "target": target_name,
                "unmatchedRecords": unmatched_records,
            }

            if job_id:
                create_or_update_job_task(
                    job_id,
                    progress_percent="100",
                    preprocess_type="e017",
                    error_code=None,
                    error_msg=None,
                    result=json.dumps(res, ensure_ascii=False),
                    id=task_id,
                    is_finish=True,
                )

            if debug:
                save_csv(lev_match_result.to_pandas(), str(result_path))

            del candidates_pivot, lev_match_result
            gc.collect()

        del main_pivot
        gc.collect()

        return None
    except Exception as e:
        if logger:
            logger.error("E017 failed:\n%s", traceback.format_exc())
        if ERROR_CODE is None:
            set_error(ERROR_00050)
        if task_id:
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type="e017",
                error_code=ERROR_CODE,
                error_msg=ERROR_MSG,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
        raise Exception("住所の類似度マッチング処理中にエラーが発生しました。")


def extract_candidates(
    sub_pivot: pl.DataFrame,
    main_oaza_set: set,
    address_column: str = "address_oaza",
) -> pl.DataFrame:
    """サブデータにあって水道データにない大字住所を候補として抽出する。

    Parameters
    ----------
    sub_pivot : pl.DataFrame
        サブデータの大字レベル集約済みDataFrame
    main_oaza_set : set
        水道データの大字住所セット
    address_column : str
        大字住所カラム名
    """
    return sub_pivot.filter(
        pl.col(address_column).is_not_null()
        & (pl.col(address_column) != "")
        & ~pl.col(address_column).is_in(list(main_oaza_set))
    )


def addr_lev_match(
    left_pivot: pl.DataFrame,
    right_pivot: pl.DataFrame,
    threshold: float = 0.8,
    address_column: str = "address_oaza",
    count_col: str = "normalized_address",
    block: int = 0,
    topk: int = 5,
    item: str = 'suido',
) -> pl.DataFrame:
    """
    Perform Levenshtein-based address matching between two Polars DataFrames.

    Parameters
    ----------
    left_pivot : pl.DataFrame
        Left DataFrame with addresses to match
    right_pivot : pl.DataFrame
        Right DataFrame with candidate addresses
    threshold : float
        Minimum similarity score (0.1-0.99) to include in results.
        Only scores >= threshold and < 1.0 are included
        (perfect matches = 1.0 are excluded)
    address_column : str
        Column name containing addresses to compare
    count_col : str
        Column name for count values
    block : int
        If > 0, use prefix blocking with this many chars
    topk : int
        Maximum number of matches per left address

    Returns
    -------
    pl.DataFrame
        Match results with rank, similarity, addresses, and counts
    """
    # Convert to list of dicts for iteration (Polars way)
    left_rows = left_pivot.to_dicts()
    right_rows = right_pivot.to_dicts()

    # Prepare block index on right if enabled
    right_block = (
        build_block_index_polars(right_pivot, address_column, block)
        if block > 0
        else None
    )

    results = []
    topk = max(1, int(topk))

    for li, lrow in enumerate(left_rows):
        l_addr = lrow.get(address_column)
        l_str = "" if l_addr is None else str(l_addr).strip()

        # Determine candidate set on right
        if right_block is not None:
            key = l_str[:block]
            cand_indices = right_block.get(key, [])
            # fallback: if no candidates in block, compare against all
            if not cand_indices:
                cand_rows = right_rows
            else:
                cand_rows = [right_rows[i] for i in cand_indices]
        else:
            cand_rows = right_rows

        scored = []
        for ri, rrow in enumerate(cand_rows):
            r_addr = rrow.get(address_column)
            r_str = "" if r_addr is None else str(r_addr).strip()
            sim = normalized_similarity(l_str, r_str)
            # Only include similarity scores >= threshold and < 1.0
            # (exclude perfect matches = 1.0, only keep near-similar matches)
            if threshold <= sim < 1.0:
                scored.append((sim, ri, rrow))

        # sort by similarity desc
        scored.sort(key=lambda x: x[0], reverse=True)

        for rank, (sim, ri, rrow) in enumerate(scored[:topk], start=1):
            r_addr = rrow.get(address_column)
            l_count = lrow.get(count_col)
            r_count = rrow.get(count_col)

            rec = {
                "rank": rank,
                "similarity": round(float(sim), 6),
                f"{item}_address": l_str,
                "suido_address": "" if r_addr is None else str(r_addr).strip(),
                f"{item}_count": "" if l_count is None else str(l_count).strip(),
                "suido_count": "" if r_count is None else str(r_count).strip(),
            }
            results.append(rec)

    # Return as Polars DataFrame
    if results:
        return pl.DataFrame(results)
    else:
        # Return empty DataFrame with expected schema
        return pl.DataFrame(
            schema={
                "rank": pl.Int64,
                "similarity": pl.Float64,
                f"{item}_address": pl.Utf8,
                "suido_address": pl.Utf8,
                f"{item}_count": pl.Utf8,
                "suido_count": pl.Utf8,
            }
        )


def pivot_address(
    df: pl.DataFrame,
    addr_col: str,
    exclude_cols: set[str],
    pivot: bool = True,
    out_col: str = None,
):
    """
    Process address data and create pivot counts.

    Parameters
    ----------
    df : pl.DataFrame
        Polars DataFrame containing address data
    addr_col : str
        Column name for the source address
    exclude_cols : set[str]
        Columns to exclude from pivot
    pivot : bool
        Whether to create pivot output
    out_col : str, optional
        Column name for the transformed address output.
        If None, defaults to addr_col (overwrites original).
    """
    # Use addr_col as out_col if not specified
    if out_col is None:
        out_col = addr_col

    # Pattern for digits and hyphens (full-width and half-width)
    digit_hyphen_pattern = r"[0-9０-９\-－―ｰ]"

    # Strip whitespace from the source column
    col_stripped = pl.col(addr_col).str.strip_chars()

    # Find positions of markers ("大字", "字")
    pos_oaza = col_stripped.str.find("大字")
    pos_ji = col_stripped.str.find("字")

    # Find minimum valid position (handle null = not found)
    min_marker_pos = (
        pl.when(pos_oaza.is_null() & pos_ji.is_null())
        .then(None)
        .when(pos_oaza.is_null())
        .then(pos_ji)
        .when(pos_ji.is_null())
        .then(pos_oaza)
        .otherwise(pl.min_horizontal(pos_oaza, pos_ji))
    )

    has_marker = min_marker_pos.is_not_null()

    # Case 1: Marker found
    # prefix = s[:idx], tail = s[idx:] with digits/hyphens removed
    # Use fill_null(0) to avoid slice errors for rows without markers
    safe_pos = min_marker_pos.fill_null(0)
    prefix = col_stripped.str.slice(0, safe_pos)
    tail_cleaned = col_stripped.str.slice(safe_pos).str.replace_all(
        digit_hyphen_pattern, ""
    )
    result_with_marker = (prefix + tail_cleaned).str.strip_chars()

    # Case 2: No marker - extract everything before first digit/hyphen
    extracted = col_stripped.str.extract(r"^([^0-9０-９\-－―ｰ]*)", 1)
    result_no_marker = (
        pl.when(extracted.is_null()).then(col_stripped).otherwise(extracted)
    ).str.strip_chars()

    # Final result: null/empty → "", has_marker → result_with_marker, else → result_no_marker
    final_result = (
        pl.when(pl.col(addr_col).is_null() | (col_stripped.str.len_chars() == 0))
        .then(pl.lit(""))
        .when(has_marker)
        .then(result_with_marker)
        .otherwise(result_no_marker)
    )

    # Create new column out_col with transformed address
    df = df.with_columns(final_result.alias(out_col))

    # 明細：out_col 昇順でソートしてから保存
    df = df.sort(out_col, descending=False, nulls_last=True)

    if pivot:
        pivot_df = make_nonempty_pivot_counts(
            df, key_col=out_col, exclude_cols=exclude_cols
        )
        return pivot_df
        return df


def make_nonempty_pivot_counts(
    df: pl.DataFrame, key_col: str, exclude_cols: set[str]
) -> pl.DataFrame:
    """
    key_col（大字まで住所）ごとに、各カラムの「非NULL・非空文字」件数を数える。
    返却: key_col を先頭列に持つ集計テーブル

    Parameters
    ----------
    df : pl.DataFrame
        Polars DataFrame to aggregate
    key_col : str
        Column name to group by
    exclude_cols : set[str]
        Columns to exclude from counting

    Returns
    -------
    pl.DataFrame
        Aggregated counts per key_col
    """
    if key_col not in df.columns:
        raise ValueError(f"key_col not found: {key_col}")

    target_cols = [c for c in df.columns if c != key_col and c not in exclude_cols]

    if not target_cols:
        # No target columns, just return unique key_col values
        return df.select(pl.col(key_col)).unique().sort(key_col, nulls_last=True)

    # Replace empty/whitespace strings with null for string columns
    string_cols = [c for c in target_cols if df.schema.get(c) in (pl.Utf8, pl.String)]

    if string_cols:
        # Replace empty or whitespace-only strings with null
        df = df.with_columns(
            [
                pl.when(pl.col(c).str.strip_chars().eq(""))
                .then(None)
                .otherwise(pl.col(c))
                .alias(c)
                for c in string_cols
            ]
        )

    # Count non-null values per group for each target column
    # In Polars, .count() counts non-null values
    agg_exprs = [pl.col(c).count().alias(c) for c in target_cols]

    out = df.group_by(key_col).agg(agg_exprs)

    # Reorder columns: key_col first, then others
    cols = [key_col] + [c for c in out.columns if c != key_col]
    out = out.select(cols)

    # Sort by key_col ascending, nulls last
    out = out.sort(key_col, descending=False, nulls_last=True)

    return out


# -----------------------------
# Levenshtein distance (DP)
# -----------------------------
def levenshtein_distance(a: str, b: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    # Ensure a is shorter to reduce memory
    if len(a) > len(b):
        a, b = b, a

    prev = list(range(len(a) + 1))
    for i, cb in enumerate(b, start=1):
        curr = [i]
        for j, ca in enumerate(a, start=1):
            ins = curr[j - 1] + 1
            delete = prev[j] + 1
            sub = prev[j - 1] + (0 if ca == cb else 1)
            curr.append(min(ins, delete, sub))
        prev = curr
    return prev[-1]


def normalized_similarity(a: str, b: str) -> float:
    """
    Similarity in [0,1] derived from Levenshtein distance:
      sim = 1 - dist / max(len(a), len(b))
    """
    a = "" if a is None else str(a)
    b = "" if b is None else str(b)
    a = a.strip()
    b = b.strip()
    if not a and not b:
        return 1.0
    m = max(len(a), len(b))
    if m == 0:
        return 1.0
    d = levenshtein_distance(a, b)
    return 1.0 - (d / m)


def read_csv_str(path: Path, encoding: str | None) -> pd.DataFrame:
    """Read CSV as string columns (robust-ish)."""
    if encoding:
        return pd.read_csv(path, dtype="string", encoding=encoding)
    # try common encodings
    for enc in ["utf-8-sig", "cp932", "utf-8"]:
        try:
            return pd.read_csv(path, dtype="string", encoding=enc)
        except Exception:
            pass
    raise RuntimeError(f"CSV読み込みに失敗しました: {path}")


def build_block_index_polars(
    df: pl.DataFrame, address_column: str, block: int
) -> dict[str, list[int]]:
    """
    Build prefix-block index from Polars DataFrame.

    Parameters
    ----------
    df : pl.DataFrame
        DataFrame containing addresses
    address_column : str
        Column name with address values
    block : int
        Number of prefix characters to use as block key

    Returns
    -------
    dict[str, list[int]]
        Dictionary mapping prefix -> list of row indices
    """
    idx = {}
    values = df.get_column(address_column).to_list()
    for i, v in enumerate(values):
        s = "" if v is None else str(v).strip()
        k = s[:block] if block > 0 else ""
        idx.setdefault(k, []).append(i)
    return idx


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
        ERROR_MSG = value["message"].format(param_st1=param_st1, param_st2=param_st2)
    elif param_st1 is not None:
        ERROR_MSG = value["message"].format(param_st1=param_st1)
    else:
        ERROR_MSG = value["message"]
