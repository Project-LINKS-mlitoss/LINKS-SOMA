"""
# E022 空き家分類機能
判定用データをインプットとして建物単位で空き家を確率的に判定するための分類用機械学習アルゴリズム（トレーニング済み）を実行する機能。
"""

import argparse
import chardet
import gc
import json
import os
import shutil
import sys
import time
import traceback
import uuid
import zipfile
from typing import Optional
from pathlib import Path

import lightgbm as lgb
import pandas as pd

current_dir = os.path.dirname(os.path.abspath(__file__))
async_tasks_path = os.path.join(current_dir, "..", "async_tasks")
if async_tasks_path not in sys.path:
    sys.path.append(async_tasks_path)

try:
    from utils import (
        connect_sqllite,
        create_or_update_job,
        create_or_update_job_task,
        create_data_set_detail_buildings_or_area,
        get_rotating_logger,
    )
    from constants import (
        ERROR_20001,
        ERROR_20002,
        ERROR_20003,
        ERROR_20004,
        ERROR_20005,
        ERROR_20006,
        ERROR_20007,
        ERROR_20008,
        ERROR_FEATURE_TYPE_IF003,
        MAPPING_E022_TO_IF001,
        COLUMNS_TO_LEARN,
    )
    from src.preprocessing.import_validation import (
        find_non_numeric_feature_columns,
        feature_columns_all_absent,
    )
except ImportError:
    sys.path.remove(async_tasks_path)
    sys.path.append(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
    )
    from async_tasks.utils import (
        connect_sqllite,
        create_or_update_job,
        create_or_update_job_task,
        create_data_set_detail_buildings_or_area,
        get_rotating_logger,
    )
    from async_tasks.constants import (
        ERROR_20001,
        ERROR_20002,
        ERROR_20003,
        ERROR_20004,
        ERROR_20005,
        ERROR_20006,
        ERROR_20007,
        ERROR_20008,
        ERROR_FEATURE_TYPE_IF003,
        MAPPING_E022_TO_IF001,
        COLUMNS_TO_LEARN,
    )
    from preprocessing.import_validation import (
        find_non_numeric_feature_columns,
        feature_columns_all_absent,
    )


ERROR_CODE = None
ERROR_MSG = None


def detect_encoding(file_path: str) -> str:
    """
    Detects the encoding of a file.
    ファイルのエンコーディングを検出します。

    Parameters
    ----------
    file_path : str
        The path of the file to detect.
        検出対象のファイルパス。

    Returns
    -------
    encoding : str
        The detected encoding.
        検出されたエンコーディング。
    """
    try:
        # ファイルの内容を読み込む
        with open(file_path, "rb") as file:
            raw_data = file.read(100)
    except FileNotFoundError:
        raise FileNotFoundError(
            f"File not found: {file_path} / ファイルが見つかりません: {file_path}"
        )
    except IOError as e:
        raise IOError(
            f"Error reading file: {file_path}, {e} / ファイルの読み込み中にエラーが発生しました: {file_path}, {e}"
        )

    result = chardet.detect(raw_data)
    encoding = result["encoding"]
    if not encoding:
        raise ValueError(
            f"Could not detect encoding for file: {file_path} / ファイルのエンコーディングを検出できませんでした: {file_path}"
        )
    return encoding


def read_csv(path: str) -> pd.DataFrame:
    """
    Reads a CSV file.
    CSVファイルを読み込みます。

    Parameters
    ----------
    path : str
        The path of the file to read.
        読み込むファイルのパス。

    Returns
    -------
    pd.DataFrame
        The loaded DataFrame.
        読み込まれたデータフレーム。
    """
    if not os.path.exists(path):
        # R-054 入力ファイル不在(E-20003)
        set_error(ERROR_20003)
        raise FileNotFoundError(
            f"File not found: {path} / ファイルが見つかりません: {path}"
        )
    if not path.lower().endswith(".csv"):
        # R-052 ファイル形式非対応(E-20001)
        set_error(ERROR_20001)
        raise ValueError(
            f"Not a CSV file: {path} / CSVファイルではありません: {path}"
        )

    try:
        encode = detect_encoding(path)
        df = pd.read_csv(path, encoding=encode)
        if df.empty:
            print(
                f"Warning: The loaded CSV file is empty: {path} / 警告: 読み込まれたCSVファイルが空です: {path}"
            )
        return df
    except pd.errors.ParserError as e:
        # R-052 ファイル形式非対応・パース失敗(E-20001)。ParserError は ValueError の派生のため、
        # 文字コード判別不能(ValueError)より先に捕捉してファイル構造の問題として表面化する。
        set_error(ERROR_20001)
        raise IOError(
            f"Failed to parse CSV file: {path}. Error: {e} / CSVファイルの解析に失敗しました: {path}. エラー: {e}"
        )
    except (UnicodeDecodeError, ValueError) as e:
        # R-053 文字コード判別不能(E-20002)。detect_encoding が検出不能時に ValueError を送出する
        set_error(ERROR_20002)
        raise IOError(
            f"Failed to read CSV file (encoding): {path}. Error: {e} / CSVファイルの文字コード判別に失敗しました: {path}. エラー: {e}"
        )


def extract_zip(zip_file, extract_to):
    """
    zipファイルを解凍し、解凍されたファイルのパスを返す関数。

    Parameters:
    -----------
    zip_file : str
        zipファイルのパス。
    extract_to : str
        解凍先のディレクトリ。

    Returns:
    --------
    dict
        解凍された各ファイルのパス。
    """
    with zipfile.ZipFile(zip_file, 'r') as zip_ref:
        zip_ref.extractall(extract_to)
    return extract_to


def load_models(model_zip):
    """
    ZIPファイルからモデルを読み込む。
    新形式（joblib PU Bagging）と旧形式（LightGBM txt）の両方に対応。

    Parameters
    ----------
    model_zip : str
        モデルZIPファイルへのパス

    Returns
    -------
    dict or lgb.Booster
        新形式: {"models": [...], "feat_cols": [...], "recall_target": float, ...}
        旧形式: lgb.Booster
    """
    import joblib

    temp_dir = os.path.join(os.getcwd(), str(uuid.uuid4()))
    os.makedirs(temp_dir, exist_ok=True)
    extract_zip(model_zip, temp_dir)

    # 新形式: model.pkl (joblib)
    pkl_path = os.path.join(temp_dir, "model.pkl")
    if os.path.exists(pkl_path):
        artifact = joblib.load(pkl_path)
        _cleanup_temp(temp_dir)
        return artifact

    # 旧形式: .txt (LightGBM Booster)
    txt_files = [os.path.join(temp_dir, f) for f in os.listdir(temp_dir) if f.endswith(".txt")]
    if txt_files:
        with open(txt_files[0], "r", encoding="utf-8") as f:
            model_str = f.read()
        model = lgb.Booster(model_str=model_str)
        _cleanup_temp(temp_dir)
        return model

    _cleanup_temp(temp_dir)
    raise FileNotFoundError("モデルファイルが見つかりません（model.pkl または .txt）")


def _cleanup_temp(temp_dir):
    """一時ディレクトリを削除（リトライ付き）"""
    gc.collect()
    for _ in range(10):
        try:
            shutil.rmtree(temp_dir)
            break
        except PermissionError:
            time.sleep(0.5)


def get_needed_explanatory_columns_list(model) -> list:
    """
    学習に使用した説明変数カラム一覧を取得する。
    新形式（PU Bagging dict）と旧形式（Booster/LGBMClassifier）の両方に対応。

    Parameters
    ----------
    model : dict or lgb.Booster or lgb.LGBMClassifier
        訓練済みモデル。

    Returns
    -------
    list
        学習に使用したカラム名のリスト。
    """
    if isinstance(model, dict) and "feat_cols" in model:
        return model["feat_cols"]
    return model.feature_name()


def prepare_for_estimation(
    input_df: pd.DataFrame, explanatory_columns: list
) -> pd.DataFrame:
    """
    Preprocesses the data for estimation.
    予測用にデータを前処理します。

    Parameters
    ----------
    input_df : pd.DataFrame
        Input DataFrame.
        入力データフレーム。
    explanatory_columns : list
        List of column names used for training.
        学習に使用したカラム名のリスト。

    Returns
    -------
    pd.DataFrame
        DataFrame of explanatory variables.
        説明変数データフレーム。
    """
    df = input_df.copy()
    if df.empty:
        print("警告: 入力データフレームが空です。")
        return pd.DataFrame(columns=explanatory_columns)

    # 案1②全説明変数において変数ごとにisnullフラグをつける
    for col in COLUMNS_TO_LEARN:
        if col in df:
            df[f'{col}_isnull'] = df[col].isnull().astype(int)

    # カラムの過不足を確認
    missing_cols = [
        col for col in explanatory_columns if col not in df.columns
    ]
    if missing_cols:
        df[missing_cols] = float("nan")
        print(
            f"Warning: Missing columns in the input data: {missing_cols}→Filled with Null / 警告: 入力データに不足しているカラムがあります: {missing_cols}→NAで埋めました"
        )

    # 必要なカラムのみを選択し、順序を学習時と合わせる
    df = df[explanatory_columns]

    return df


def predict_akiya(
    input_df: pd.DataFrame,
    prepared_df: pd.DataFrame,
    model,
    thresh: float
) -> pd.DataFrame:
    """
    学習済みモデルを使用して空き家予測を行う。
    新形式（PU Bagging dict）と旧形式（Booster/LGBMClassifier）の両方に対応。

    Parameters
    ----------
    input_df : pd.DataFrame
        入力データフレーム。
    prepared_df : pd.DataFrame
        前処理されたデータフレーム。
    model : dict or lgb.Booster or lgb.LGBMClassifier
        学習済みモデル。
    thresh : float
        空き家と判定する確率の閾値。

    Returns
    -------
    pd.DataFrame
        予測結果を含むデータフレーム。
    """
    import numpy as np

    df = input_df.copy()
    prepared_df = prepared_df.copy()
    if df.empty:
        df["predicted_probability"] = pd.Series(dtype="float64")
        df["predicted_label"] = pd.Series(dtype="int")
        for threshold_percent in range(5, 96, 5):
            df[f"predicted_label_{threshold_percent:02d}"] = pd.Series(dtype="int")
        return df

    # 新形式: PU Bagging（dict with "models" key）
    if isinstance(model, dict) and "models" in model:
        if "medians" in model:
            # 学習時と同じNaN補完: median→0埋め + years_since_closure上限
            medians = pd.Series(model["medians"])
            ysc_cap = model.get("ysc_cap", 15.0)
            filled = prepared_df.fillna(medians).fillna(0)
            if "years_since_closure" in filled.columns:
                filled["years_since_closure"] = filled["years_since_closure"].clip(upper=ysc_cap)
            X = filled.to_numpy(dtype=float)
        else:
            # 旧モデル互換: mediansキーなければ従来動作
            X = np.nan_to_num(prepared_df.to_numpy(dtype=float), nan=0.0)
        y_pred_proba = np.mean(
            [m.predict_proba(X)[:, 1] for m in model["models"]], axis=0
        )
    elif isinstance(model, lgb.LGBMClassifier):
        y_pred_proba = model.predict_proba(prepared_df)[:, 1]
    else:  # Booster
        y_pred_proba = model.predict(prepared_df)

    df["predicted_probability"] = y_pred_proba
    df["predicted_label"] = (y_pred_proba > thresh).astype(int)

    # 5%から95%まで5%刻みで閾値を設定
    for threshold_percent in range(5, 96, 5):
        threshold_value = threshold_percent / 100.0
        df[f"predicted_label_{threshold_percent:02d}"] = (y_pred_proba > threshold_value).astype(int)

    return df


def save_csv_with_encoding_fallback(df: pd.DataFrame, path: str) -> str:
    """予測結果CSVを保存する。utf-8-sig を主とし、失敗時のみ cp932 を試す。

    FR004-007 R-056/057: 各エンコーディングでの保存失敗を E-20005（保存時エンコーディング失敗・
    開発者に相談）として記録し、全エンコーディングで保存できなければ E-20006（全保存失敗）を記録して
    送出する。成功した時点で直前に記録したエラーは解除する（最終的に保存できたため）。
    E032 等の後段は chardet で文字コードを検出して読むため cp932 フォールバックでも読める。
    """
    global ERROR_CODE, ERROR_MSG
    encodings = ["utf-8-sig", "cp932"]
    last_exc: Optional[Exception] = None
    for encoding in encodings:
        try:
            df.to_csv(path, index=False, encoding=encoding)
            ERROR_CODE = None
            ERROR_MSG = None
            return encoding
        except Exception as e:  # 文字コード/IOの保存失敗を1エンコーディング単位で記録
            last_exc = e
            # R-056 保存時エンコーディング失敗(E-20005)
            set_error(ERROR_20005, path, encoding)
    # R-057 全エンコーディングで保存失敗(E-20006)
    set_error(ERROR_20006, param_st1=path)
    raise IOError(
        f"Failed to save CSV in all encodings {encodings}: {path}. Error: {last_exc} / "
        f"いずれのエンコーディングでもCSVを保存できませんでした: {path}"
    )


def save_predictions(df: pd.DataFrame, output_dir: str):
    """
    Saves the prediction results to a CSV file.
    予測結果をCSVファイルに保存します。

    Parameters
    ----------
    df : pd.DataFrame
        DataFrame containing the prediction results.
        予測結果を含むデータフレーム。
    output_dir : str
        Path to the output directory.
        出力ディレクトリのパス。
    """
    if not os.path.exists(output_dir):
        try:
            os.makedirs(output_dir, exist_ok=True)
            print(
                f"Output directory created: {output_dir} / 出力ディレクトリを作成しました: {output_dir}"
            )
        except OSError as e:
            raise IOError(
                f"Failed to create output directory: {output_dir}. Error: {e} / 出力ディレクトリの作成に失敗しました: {output_dir}. エラー: {e}"
            )

    output_csv_path = os.path.join(output_dir, "predictions.csv")
    save_csv_with_encoding_fallback(df, output_csv_path)
    print(
        f"Prediction results saved to {output_csv_path}. / 予測結果が {output_csv_path} に保存されました。"
    )


def main(
    input_path: str,
    model_path: str,
    output_dir: str,
    file_path: str,
    thresh: float,
    job_id: str,
    db_path: str,
    process: float,
    data_set_result_id: int,
    logs_dir: Optional[str] = None,
):
    """
    Main function to execute the vacant house prediction process.
    空き家予測のプロセスを実行するメイン関数。

    Parameters
    ----------
    input_path : str
        Path to the input CSV file.
        入力CSVファイルへのパス。
    model_path : str
        Path to the trained model file.
        訓練済みモデルファイルへのパス。
    output_dir : str
        Path to the output directory.
        出力ディレクトリのパス。
    thresh : float
        Probability threshold for classifying as a vacant house.
        空き家と判定する確率の閾値。
    """
    task_id = None
    logger = None

    try:
        if logs_dir:
            logger = get_rotating_logger(logs_dir, logger_name="E022")
        else:
            logs_dir = os.path.join(output_dir, "logs")
            logger = get_rotating_logger(logs_dir, logger_name="E022")

        logger.info(f"[params] input_path={input_path}")
        logger.info(f"[params] model_path={model_path}")
        logger.info(f"[params] output_dir={output_dir}, thresh={thresh}, job_id={job_id}")

        sqlite_enabled = False
        if db_path:
            try:
                connect_sqllite(db_path)
                process = process / 4
                process_init = process
                sqlite_enabled = True
            except Exception as e:
                print(
                    f"SQLite接続に失敗しました: {e}. SQLiteを使用せずに続行します。"
                )
                if logger:
                    logger.warning("E022 - SQLite接続に失敗しました: %s", traceback.format_exc())
        if sqlite_enabled and job_id:
            task_id = create_or_update_job_task(
                job_id,
                progress_percent="0",
                preprocess_type=None,
                error_code=None,
                error_msg=None,
                result=json.dumps({}),
            )
            create_or_update_job(job_id, process)
            process += process_init
        # データの読み込み
        df = read_csv(input_path)
        if df.empty:
            raise Exception("入力データが空です。")
        if logger:
            logger.info(f"[load_data] Loaded CSV: {len(df):,} rows x {len(df.columns)} cols")
        # Remove rows where 水道番号 is null or empty
        if "水道番号" in df.columns:
            df = df[df["水道番号"].notna() & (df["水道番号"] != "")].reset_index(
                drop=True
            )
            if logger:
                logger.info(f"[load_data] After 水道番号 filter: {len(df):,} rows")

        # モデルの読み込み
        model = load_models(model_path)
        if logger:
            if isinstance(model, dict) and "models" in model:
                logger.info(f"[load_model] Format: PU Bagging dict (keys={list(model.keys())})")
                logger.info(f"[load_model] feat_cols: {model.get('feat_cols', [])}")
                logger.info(f"[load_model] n_bags={len(model.get('models', []))}, "
                             f"threshold={model.get('threshold', 'N/A')}, "
                             f"recall_target={model.get('recall_target', 'N/A')}")
            elif isinstance(model, lgb.LGBMClassifier):
                logger.info("[load_model] Format: LGBMClassifier")
            else:
                logger.info(f"[load_model] Format: Booster (type={type(model).__name__})")

        if sqlite_enabled and job_id:
            create_or_update_job_task(
                job_id,
                progress_percent="30",
                preprocess_type=None,
                error_code=None,
                error_msg=None,
                result=json.dumps({}),
                id=task_id,
            )
            create_or_update_job(job_id, process)
            process += process_init

        # カラム調整
        explanatory_values = get_needed_explanatory_columns_list(model)
        present_cols = [c for c in explanatory_values if c in df.columns]
        if logger:
            logger.info(f"[prepare] Requested explanatory columns: {len(explanatory_values)}")
            missing_cols = [c for c in explanatory_values if c not in df.columns]
            if missing_cols:
                logger.warning(f"[prepare] Missing columns (will be filled with NA): {missing_cols}")
            logger.info(f"[prepare] Present columns: {len(present_cols)}/{len(explanatory_values)}")

        # FR004-007 R-055: モデルの説明変数が入力に1つも無い(=別データセット)場合は致命停止(E-20004)。
        # 部分欠損は predict_akiya の median 補完で許容する設計なので、ゼロ一致のみをエラーにする。
        if feature_columns_all_absent(df.columns, explanatory_values):
            if logger:
                logger.error(
                    f"[validate_features] No model feature columns present in input. "
                    f"Required: {explanatory_values}"
                )
            set_error(ERROR_20004, param_st1="、".join(explanatory_values))
            raise ValueError(
                f"モデルの説明変数が入力に1つも存在しません: {explanatory_values}"
            )

        # FR004-007: 説明変数の型不一致(E-201)を predict_akiya の .to_numpy(dtype=float) が
        # 不透明にクラッシュする前に検出し、どの列が非数値か＋責任分界(自治体修正)を記録して停止する。
        bad_feature_cols = find_non_numeric_feature_columns(
            df, present_cols
        )
        if bad_feature_cols:
            if logger:
                logger.error(f"[validate_features] Non-numeric feature columns: {bad_feature_cols}")
            set_error(ERROR_FEATURE_TYPE_IF003, param_st1="、".join(bad_feature_cols))
            raise ValueError(
                f"説明変数に数値化できない値が含まれます: {bad_feature_cols}"
            )

        df_prepared = prepare_for_estimation(df, explanatory_values)

        if sqlite_enabled and job_id:
            create_or_update_job_task(
                job_id,
                progress_percent="60",
                preprocess_type=None,
                error_code=None,
                error_msg=None,
                result=json.dumps({}),
                id=task_id,
            )
            create_or_update_job(job_id, process)
            process += process_init

        # 予測の実行
        if logger:
            logger.info(f"[predict] Running prediction with threshold={thresh}")
        df_pred = predict_akiya(df, df_prepared, model, thresh)
        if logger:
            import numpy as _np
            scores = df_pred.get("predicted_probability")
            if scores is not None and len(scores) > 0:
                logger.info(f"[predict] Score distribution: min={scores.min():.4f}, max={scores.max():.4f}, "
                             f"mean={scores.mean():.4f}, median={scores.median():.4f}")
                logger.info(f"[predict] Score percentiles: 25%={scores.quantile(0.25):.4f}, "
                             f"75%={scores.quantile(0.75):.4f}, 90%={scores.quantile(0.90):.4f}, "
                             f"95%={scores.quantile(0.95):.4f}")
            labels = df_pred.get("predicted_label")
            if labels is not None:
                n_vacant = int(labels.sum())
                logger.info(f"[predict] Label distribution: vacant={n_vacant:,} / "
                             f"total={len(labels):,} ({n_vacant/max(1,len(labels)):.2%})")
        columns_to_drop = []
        for col in COLUMNS_TO_LEARN:
            if col in df:
                columns_to_drop.append(f'{col}_isnull')
        df_prepared = df_prepared.drop(columns=columns_to_drop, errors='ignore')

        if sqlite_enabled and job_id:
            create_or_update_job_task(
                job_id,
                progress_percent="60",
                preprocess_type=None,
                error_code=None,
                error_msg=None,
                result=json.dumps({}),
                id=task_id,
            )
            create_or_update_job(job_id, process)
            process += process_init
        if logger:
            logger.info(f"[output] Final dataframe: {len(df_pred):,} rows x {len(df_pred.columns)} cols")

        if sqlite_enabled and job_id:
            # Insert SQLite data
            insert_sqlite(df_pred, data_set_result_id)
            # E032が参照するCSVにreference_dateを含める
            # （insert_sqlite内でローカル変数に再バインドされるためdf_predには反映されない）
            if "reference_date" not in df_pred.columns:
                df_pred["reference_date"] = ""
            # 各エンコーディングでCSVファイルとして保存を試みる(R-056/057)
            os.makedirs(output_dir, exist_ok=True)
            save_csv_with_encoding_fallback(df_pred, file_path)
        else:
            # 予測結果の保存
            save_predictions(df_pred, output_dir)
        if sqlite_enabled and job_id:
            create_or_update_job_task(
                job_id,
                progress_percent="100",
                preprocess_type=None,
                error_code=None,
                error_msg=None,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
            create_or_update_job(job_id, process)
    except Exception as e:
        print(f"An error occurred: {e} / エラーが発生しました: {e}")
        if logger:
            logger.error("E022 failed:\n%s", traceback.format_exc())
        # 記録より先にフォールバック(E-20008)を立てる。順序が逆だと想定外の例外で
        # ERROR_MSG が None のまま記録され、画面が原因を示せなくなる。
        if ERROR_CODE is None:
            set_error(ERROR_20008)
        if task_id is not None:
            # どの名寄せ済みデータセットで失敗したかを先頭へ添える（推定は生CSVでなく登録済データを読む）
            error_msg = ERROR_MSG
            try:
                from utils import fetch_normalized_dataset_file_names
                from error_file_context import prepend_file_context, resolve_by_path
                error_msg = prepend_file_context(
                    ERROR_MSG,
                    resolve_by_path(input_path, fetch_normalized_dataset_file_names(), {}),
                )
            except Exception:
                error_msg = ERROR_MSG
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type=None,
                error_code=ERROR_CODE,
                error_msg=error_msg,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
        raise Exception(e)


def set_error(value: dict, param_st1: str = None, param_st2: str = None):
    """
    Sets the error code and message.
    エラーコードとメッセージを設定します。

    Parameters
    ----------
    value : dict
        The error code and message. / エラーコードとメッセージ。
    param_st1 : str
        The first parameter. / 最初のパラメータ。
    param_st2 : str
        The second parameter. / 第二のパラメータ。
    """
    global ERROR_CODE
    global ERROR_MSG
    ERROR_CODE = value["code"]
    if param_st1 is not None and param_st2 is not None:
        ERROR_MSG = value["message"].format(
            param_st1=param_st1,
            param_st2=param_st2,
        )
    elif param_st1 is not None:
        ERROR_MSG = value["message"].format(param_st1=param_st1)
    else:
        ERROR_MSG = value["message"]


ODS_SUFFIX = "_ods"


def collect_ods_to_json(df: pd.DataFrame) -> pd.DataFrame:
    """_odsサフィックスのカラムをoptional_data_source JSON文字列に変換する。

    _odsカラムが存在しなければそのまま返す。
    存在すれば_odsカラムを除去し、optional_data_sourceカラムを追加する。
    """
    ods_cols = sorted([c for c in df.columns if c.endswith(ODS_SUFFIX)])
    if not ods_cols:
        return df

    # カラム名からサフィックスを除いた表示名を事前計算
    ods_names = [col[: -len(ODS_SUFFIX)] for col in ods_cols]
    col_indices = [df.columns.get_loc(col) for col in ods_cols]

    # itertuples + 位置アクセスで行ごとのJSON文字列を生成（df.applyより高速）
    json_values = []
    for tup in df.itertuples(index=False, name=None):
        entries = [
            {"name": name, "value": None if pd.isna(tup[idx]) else tup[idx]}
            for name, idx in zip(ods_names, col_indices)
        ]
        json_values.append(json.dumps(entries, ensure_ascii=False))

    df = df.copy()
    df["optional_data_source"] = json_values
    df = df.drop(columns=ods_cols)
    return df


def insert_sqlite(input_data: pd.DataFrame, data_set_result_id: int):
    """
    指定されたデータをSQLiteデータベースに挿入し、同時にインポート可能な形式でファイルを出力する

    Parameters
    ----------
    input_data : pd.DataFrame
        SQLiteデータベースに挿入し、ファイル出力するデータを含むDataFrame
    data_set_result_id : int
        data_set_result_idを設定する
    """
    try:
        # カラム名のマッピング（日本語→英語）
        mapping_header = MAPPING_E022_TO_IF001
        # 重複防止: 英語列が既にある場合は日本語列を削除してから rename
        for jp_col, en_col in mapping_header.items():
            if jp_col in input_data.columns and en_col in input_data.columns:
                input_data = input_data.drop(columns=[jp_col], errors="ignore")

        # カラム名を変換（マッピングにあるものだけ）
        input_data = input_data.rename(columns=mapping_header)
        all_columns = input_data.columns.tolist()
        # 重複除去用: マッピング済み＋predicted_label_* のうち存在するもの
        mapped_columns = [
            col for col in mapping_header.values() if col in all_columns
        ]
        for threshold_percent in range(5, 96, 5):
            column_name = f"predicted_label_{threshold_percent:02d}"
            if column_name in all_columns:
                mapped_columns.append(column_name)
        # 全カラムを保持（マッピング外のカラムもDBに保存する）
        input_data = drop_duplicates(input_data, mapped_columns)

        # SQLiteにデータを挿入
        input_data["data_set_result_id"] = data_set_result_id
        if "reference_date" not in input_data.columns:
            input_data["reference_date"] = ""

        # Find the first valid reference_date that is not NaN, None, or empty
        reference_date_value = (
            input_data.loc[
                input_data["reference_date"].notna()
                & (input_data["reference_date"] != ""),
                "reference_date",
            ].iloc[0]
            if not input_data.loc[
                input_data["reference_date"].notna()
                & (input_data["reference_date"] != ""),
                "reference_date",
            ].empty
            else ""
        )

        # Replace NaN, None, and empty values with the found value
        # (or leave it empty if no valid value is found)
        input_data["reference_date"] = input_data["reference_date"].replace(
            [None, "", pd.NA], reference_date_value
        )

        # _odsカラムをoptional_data_source JSONに変換
        input_data = collect_ods_to_json(input_data)

        create_data_set_detail_buildings_or_area(input_data)

    except Exception as e:
        # エラー時の処理
        set_error(ERROR_20007)
        raise Exception(e)


def drop_duplicates(
    df: pd.DataFrame, subset: list, keep: str = "first"
) -> pd.DataFrame:
    """
    データフレームから重複行を削除する
    Parameters
    ----------
    df : pd.DataFrame
        重複を削除するデータフレーム
    subset : list
        重複を判定するカラムのリスト
    keep : str, optional
        残す行を指定（'first', 'last', False）
    Returns
    -------
    pd.DataFrame
        重複が削除されたデータフレーム
    """
    return df.drop_duplicates(subset=subset, keep=keep)


if __name__ == "__main__":

    parser = argparse.ArgumentParser(
        description="空き家予測を実行します。 / Execute vacant house prediction."
    )
    parser.add_argument(
        "--input_path",
        type=str,
        required=True,
        help="入力CSVファイルへのパス。 / Path to the input CSV file.",
    )
    parser.add_argument(
        "--model_path",
        type=str,
        required=True,
        help="訓練済みモデルファイルへのパス。 / Path to the trained model file.",
    )
    parser.add_argument(
        "--output_dir",
        type=str,
        required=True,
        help="出力ディレクトリへのパス。 / Path to the output directory.",
    )
    parser.add_argument(
        "--thresh",
        type=float,
        default=0.5,
        help="空き家と判定する確率の閾値。 / Probability threshold for classifying as a vacant house.",
    )

    args = parser.parse_args()

    main(
        input_path=args.input_path,
        model_path=args.model_path,
        output_dir=args.output_dir,
        thresh=args.thresh,
        job_id=None,
        db_path=None,
        process=0,
        data_set_result_id=0,
    )
