"""E021: 空き家推定モデル構築 (M6 Prior-Rebalanced PU Bagging)

実験リポジトリ（links-akiya-ml-experiments）で検証・確立したM6手法を
本番インターフェースに適合させた実装。

手法概要:
  - PU Learning (Positive-Unlabeled): 正例のみ信頼できるラベル問題に対応
  - Prior-Rebalanced Sampling: 学習データの正例比率をtarget_prior(2%)に調整
  - PU Bagging: N_BAGS個のバッグで学習し、予測を平均化
  - LightGBM: 各バッグの分類器

入力:
  - IF001が出力したCSV（名寄せ済みデータ + 空き家ラベル）
  - 説明変数リスト（FEから受け取り）

出力:
  - 学習済みモデル（joblib形式のZIPファイル）
  - 評価メトリクス（Precision@K, Lift@K, recall-threshold, feature importance）
"""

import json
import os
import sys
import zipfile
import traceback
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.model_selection import train_test_split

current_dir = os.path.dirname(os.path.abspath(__file__))
async_tasks_path = os.path.join(current_dir, "..", "async_tasks")
if async_tasks_path not in sys.path:
    sys.path.append(async_tasks_path)

try:
    from utils import (
        create_or_update_job,
        create_or_update_job_task,
        get_rotating_logger,
    )
    from constants import *
except ImportError:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
    from async_tasks.utils import (
        create_or_update_job,
        create_or_update_job_task,
        get_rotating_logger,
    )
    from async_tasks.constants import *

try:
    from src.preprocessing.import_validation import (
        FeatureTypeMismatchError,
        find_non_numeric_feature_columns,
    )
except ImportError:
    from preprocessing.import_validation import (
        FeatureTypeMismatchError,
        find_non_numeric_feature_columns,
    )


# ══════════════════════════════════════════════════════════════════════════════
# Constants
# ══════════════════════════════════════════════════════════════════════════════

RANDOM_SEED = 42
TARGET_PRIOR = 0.02       # 学習データの正例比率目標
N_BAGS = 30               # PU Bagging のバッグ数
YSC_CAP = 15.0            # F-7: years_since_closure の上限（循環バイアス軽減）

LABEL_COL = "is_vacant"   # 空き家フラグカラム名（旧: akiya_result_cleaned_flag）

# デフォルトのLightGBMパラメータ（実験で確立済み）
DEFAULT_LGB_PARAMS = dict(
    objective="binary",
    metric="binary_logloss",
    num_leaves=31,
    max_depth=5,
    learning_rate=0.05,
    n_estimators=200,
    min_child_samples=20,
    subsample=0.8,
    colsample_bytree=0.8,
    random_state=RANDOM_SEED,
    verbose=-1,
)

# 旧E021互換: 日本語カラム名 → 英語カラム名マッピング
# FEは日本語カラム名を送信するため、英語名に変換して使用
_JP_TO_EN_FEATURE_MAP = {
    # 住基系（直接集計）
    "世帯人数": "household_size_juki_residence",
    "15歳未満人数": "under_15_count_juki_residence",
    "65歳以上人数": "over_65_count_juki_residence",
    "最大年齢": "max_age_juki_residence",
    "住定期間": "residence_duration_juki_residence",
    "死亡人数": "num_deaths_juki_residence",
    "転入数": "num_inmigrants_juki_residence",
    "転出・転居数": "num_outmigrants_relocations_juki_residence",
    "住民データ有無フラグ": "juki_residence_flag",
    # 水道系
    "閉栓フラグ": "water_disconnection_flag",
    "平均検針水量": "avg_water_usage",
    "直近４ヶ月の使用量増減率": "change_rate_waterusage_over_last4months",
    "年間最大検針水量": "max_water_usage",
    "年間合計検針水量": "total_water_usage",
    "閉栓後年数": "years_since_closure",
    "一人当たり検針水量": "average_waterusage_person",
    "検針水量（推定月の11・12ヶ月前）": "suido_usage_f1",
    "検針水量（推定月の9・10ヶ月前）": "suido_usage_f2",
    "検針水量（推定月の7・8ヶ月前）": "suido_usage_f3",
    "検針水量（推定月の5・6ヶ月前）": "suido_usage_f4",
    "検針水量（推定月の3・4ヶ月前）": "suido_usage_f5",
    "検針水量（推定月の1・2ヶ月前）": "suido_usage_f6",
    # 登記系
    "登記構造": "structure_touki_residence",
    "登記日付": "registration_date_touki_residence",
    # 派生特徴量（水道）
    "前半平均使用水量": "usage_first_half_avg",
    "後半平均使用水量": "usage_second_half_avg",
    "半期変化率": "usage_half_year_change_rate",
    "直近使用水量": "recent_usage_avg",
    "再入居フラグ": "usage_recovery_flag",
    # 新規特徴量（水道時系列）
    "ゼロ使用期数": "num_zero_periods",
    "最小水道使用量": "min_water_usage",
    "使用量データあり": "has_usage_data",
    "使用量データなし": "usage_data_unavailable_flag",
    "使用量標準偏差": "std_water_usage",
    "使用量変動係数": "usage_cv",
    "使用量トレンド傾き": "usage_trend_slope",
    "トレンド傾き欠損": "usage_trend_slope_is_missing",
    "最大連続ゼロ期数": "max_consecutive_zero_periods",
    # 新規特徴量（住基系）
    "最大年齢欠損": "max_age_juki_residence_isnull",
    "消除イベントあり": "has_cancellation_event",
    "転出イベント数": "num_outmigrant_events",
    "最終異動後経過年数": "years_since_last_transfer",
    "最終異動経過年数欠損": "years_since_last_transfer_is_missing",
    "独居高齢者": "sole_elderly_resident",
    "死亡後入居者なし": "death_no_replacement",
    "世帯縮小率": "household_shrinkage_rate",
    "死亡イベントあり": "has_death_event",
    # 新規特徴量（交差・ルール系）
    "複合ルールスコア": "composite_rule_score",
    "閉栓かつ住基なし": "disconnected_and_no_resident",
    "職権記載高齢者フラグ": "juki_elderly_proxy_flag",
    "ゼロ使用かつ住基なし": "zero_usage_no_resident",
    "死亡かつ閉栓": "death_closed_meter",
    "独居高齢者かつ閉栓": "sole_elderly_closed_meter",
    "死亡後無入居かつ閉栓": "death_no_replacement_closed",
    # マッチフラグ
    "住基マッチフラグ_suido_residence": "juki_residence_flag",
    "一人当たり水道使用量": "average_waterusage_person",
}


# ══════════════════════════════════════════════════════════════════════════════
# Data preparation
# ══════════════════════════════════════════════════════════════════════════════

def _read_csv(path: str, logger=None) -> pd.DataFrame:
    """CSVファイルを読み込む（UTF-8 BOM対応）"""
    try:
        df = pd.read_csv(path, low_memory=False, encoding="utf-8-sig")
    except UnicodeDecodeError:
        try:
            import chardet
            with open(path, "rb") as f:
                enc = chardet.detect(f.read(100000))["encoding"]
            df = pd.read_csv(path, low_memory=False, encoding=enc)
        except Exception:
            raise Exception(f"ファイルの文字コードを判別できません: {path}")
    if logger:
        logger.info(f"  Loaded: {path} ({len(df):,} rows × {len(df.columns)} cols)")
    return df


def _resolve_feature_cols(
    explanatory_variables: list[str],
    df_columns: list[str],
) -> list[str]:
    """FEから受け取った説明変数リストをDataFrameのカラム名に解決する。

    FEは日本語カラム名を送信する場合がある。英語カラム名にマッピングし、
    DataFrameに存在するカラムのみを返す。
    """
    resolved = []
    for var in explanatory_variables:
        # まずそのままの名前でチェック
        if var in df_columns:
            resolved.append(var)
        # 日本語→英語マッピングを試行
        elif var in _JP_TO_EN_FEATURE_MAP:
            en_name = _JP_TO_EN_FEATURE_MAP[var]
            if en_name in df_columns and en_name not in resolved:
                resolved.append(en_name)
    return resolved


def _prepare_features(
    df: pd.DataFrame,
    feat_cols: list[str],
) -> tuple[np.ndarray, list[str]]:
    """特徴量行列を準備: NaN補完 + years_since_closure上限設定"""
    present = [c for c in feat_cols if c in df.columns]
    med = df[present].median()
    X = df[present].fillna(med).fillna(0).to_numpy(dtype=float)

    # F-7: years_since_closure の循環バイアス軽減
    if "years_since_closure" in present:
        idx = present.index("years_since_closure")
        X[:, idx] = np.clip(X[:, idx], 0, YSC_CAP)

    return X, present


# ══════════════════════════════════════════════════════════════════════════════
# M6 Prior-Rebalanced PU Bagging
# ══════════════════════════════════════════════════════════════════════════════

def _build_prior_rebalanced_data(
    X: np.ndarray,
    y: np.ndarray,
    target_prior: float = TARGET_PRIOR,
) -> tuple[np.ndarray, np.ndarray]:
    """Prior-Rebalanced Samplingを適用: 正例比率をtarget_priorに調整"""
    pos_idx = np.where(y == 1)[0]
    unl_idx = np.where(y == 0)[0]
    n_pos = len(pos_idx)

    if n_pos == 0:
        return X, y

    # 必要な負例数: n_pos * (1 - prior) / prior
    n_unl = max(1, int(n_pos * (1 - target_prior) / target_prior))
    n_unl = min(n_unl, len(unl_idx))

    rng = np.random.RandomState(RANDOM_SEED)
    sampled_unl = rng.choice(unl_idx, size=n_unl, replace=False)
    sel_idx = np.concatenate([pos_idx, sampled_unl])

    return X[sel_idx], y[sel_idx]


def _train_pu_bags(
    X_train: np.ndarray,
    y_train: np.ndarray,
    lgb_params: dict,
    n_bags: int = N_BAGS,
    progress_cb=None,
    logger=None,
) -> list:
    """PU Bagging: N_BAGS個のバッグでLightGBMモデルを学習"""
    pos_idx = np.where(y_train == 1)[0]
    unl_idx = np.where(y_train == 0)[0]
    n_pos = len(pos_idx)
    rng = np.random.RandomState(RANDOM_SEED)
    models = []

    for i in range(n_bags):
        # 各バッグ: 全正例 + 同数の負例をブートストラップサンプリング
        samp = rng.choice(unl_idx, size=n_pos, replace=True)
        idx = np.concatenate([pos_idx, samp])
        y_bag = np.concatenate([np.ones(n_pos), np.zeros(n_pos)])

        X_bag = np.nan_to_num(X_train[idx], nan=0.0)
        m = lgb.LGBMClassifier(**lgb_params)
        m.fit(X_bag, y_bag)
        models.append(m)

        if (i + 1) % 5 == 0 and logger:
            logger.info(f"[pu_bagging] Bag {i + 1}/{n_bags} trained")

        if progress_cb and (i + 1) % max(1, n_bags // 5) == 0:
            progress_cb(int(40 + 30 * (i + 1) / n_bags))

    return models


def _predict_bags(models: list, X: np.ndarray) -> np.ndarray:
    """全バッグの予測確率を平均化"""
    X = np.nan_to_num(np.asarray(X, dtype=float), nan=0.0)
    return np.mean([m.predict_proba(X)[:, 1] for m in models], axis=0)


# ══════════════════════════════════════════════════════════════════════════════
# Evaluation
# ══════════════════════════════════════════════════════════════════════════════

def _evaluate_model(
    y_true: np.ndarray,
    scores: np.ndarray,
    recall_target: float = 0.65,
) -> dict:
    """PU Learning向け評価メトリクスを計算。

    Precision@K / Lift@K でランキング品質を評価し、
    recall_target に基づく閾値で候補件数を算出する。
    """
    n = len(y_true)
    n_pos = int(y_true.sum())
    class_prior = n_pos / max(1, n)

    # スコア降順のインデックス
    order = np.argsort(-scores)
    y_sorted = y_true[order]

    # ── Precision@K ──────────────────────────────────────────────────
    ks = [100, 500, 1000, 3000, 5000]
    prec_at_k = {}
    for k in ks:
        k_actual = min(k, n)
        prec = float(y_sorted[:k_actual].sum()) / k_actual if k_actual > 0 else 0.0
        prec_at_k[k] = prec

    # ── Lift@K ───────────────────────────────────────────────────────
    lift_at_k = {}
    for k in ks:
        lift_at_k[k] = prec_at_k[k] / class_prior if class_prior > 0 else 0.0

    # ── Recall-based threshold ───────────────────────────────────────
    # recall_target（例: 0.65）の正例がこの閾値以上になるスコアを探す
    if n_pos > 0:
        scores_sorted_desc = scores[order]
        cumulative_pos = np.cumsum(y_sorted)
        # recall_target 割合の正例をカバーする位置
        target_count = int(np.ceil(recall_target * n_pos))
        # cumulative_pos が target_count に達する最初のインデックス
        idx = np.searchsorted(cumulative_pos, target_count, side="left")
        idx = min(idx, n - 1)
        threshold_value = float(scores_sorted_desc[idx])
        candidate_count = int((scores >= threshold_value).sum())
    else:
        threshold_value = 0.5
        candidate_count = 0

    candidate_ratio = candidate_count / max(1, n)

    return {
        "precisionAt100": str(round(prec_at_k[100], 4)),
        "precisionAt500": str(round(prec_at_k[500], 4)),
        "precisionAt1000": str(round(prec_at_k[1000], 4)),
        "precisionAt3000": str(round(prec_at_k[3000], 4)),
        "precisionAt5000": str(round(prec_at_k[5000], 4)),
        "liftAt1000": str(round(lift_at_k[1000], 2)),
        "liftAt5000": str(round(lift_at_k[5000], 2)),
        "recallTarget": str(recall_target),
        "threshold": str(round(threshold_value, 4)),
        "candidateCount": str(candidate_count),
        "candidateRatio": str(round(candidate_ratio, 4)),
    }


def _compute_feature_importance(
    models: list,
    feat_cols: list[str],
) -> list[dict]:
    """全バッグの特徴量重要度を平均して上位を返す"""
    importances = np.zeros(len(feat_cols))
    for m in models:
        importances += m.feature_importances_
    importances /= len(models)

    ranked = sorted(zip(feat_cols, importances), key=lambda x: -x[1])
    return [{"column": col, "value": str(round(float(val), 4))} for col, val in ranked[:20]]


# ══════════════════════════════════════════════════════════════════════════════
# Main entry point
# ══════════════════════════════════════════════════════════════════════════════

def train_and_evaluate(
    db_path: str,
    input_path: str,
    output_path: str,
    explanatory_variables: list[str],
    test_size: float = 0.3,
    n_splits: int = 3,
    undersample: bool = False,
    undersample_ratio: float = 3.0,
    recall_target: float = 0.65,
    hyperparameter_flag: bool = False,
    n_trials: int = 100,
    lambda_l1: float = 0,
    lambda_l2: float = 0,
    num_leaves: int = 31,
    feature_fraction: float = 1.0,
    bagging_fraction: float = 1.0,
    bagging_freq: int = 0,
    min_data_in_leaf: int = 20,
    citycode_value: str | None = None,
    targetyear_value: str | None = None,
    job_id: int | None = None,
):
    """モデル構築のメインエントリポイント。

    M6 Prior-Rebalanced PU Baggingでモデルを学習し、
    評価メトリクスとモデルをZIPファイルとして保存する。
    """
    logs_dir = os.path.join(os.path.dirname(output_path), "logs")
    logger = get_rotating_logger(logs_dir, logger_name="E021")
    task_id = None
    e021_start = datetime.now()  # NR007: モデル構築処理全体の計測起点

    try:
        # ── Progress tracking ────────────────────────────────────────────
        if job_id:
            task_id = create_or_update_job_task(
                job_id, "0", None, None, None, None,
            )

        def update_progress(pct):
            if job_id:
                create_or_update_job(job_id, str(pct))
            if task_id:
                create_or_update_job_task(
                    job_id, str(pct), None, None, None, None, id=task_id,
                )

        # ── Log received parameters ──────────────────────────────────────
        logger.info("[params] explanatory_variables=%d items, recall_target=%.2f, "
                     "test_size=%.2f, n_splits=%d, undersample=%s, undersample_ratio=%.1f",
                     len(explanatory_variables), recall_target, test_size, n_splits,
                     undersample, undersample_ratio)
        logger.info("[params] hyperparameter_flag=%s, n_trials=%d, lambda_l1=%.4f, "
                     "lambda_l2=%.4f, num_leaves=%d, feature_fraction=%.2f",
                     hyperparameter_flag, n_trials, lambda_l1, lambda_l2,
                     num_leaves, feature_fraction)
        logger.info("[params] bagging_fraction=%.2f, bagging_freq=%d, "
                     "min_data_in_leaf=%d, citycode=%s, targetyear=%s",
                     bagging_fraction, bagging_freq, min_data_in_leaf,
                     citycode_value, targetyear_value)

        # ── Step 1: Load data ────────────────────────────────────────────
        update_progress(5)
        logger.info("[load_data] Loading input: %s", input_path)
        df = _read_csv(input_path, logger)

        # Detect label column (新形式: is_vacant、旧形式: akiya_result_cleaned_flag)
        label_col = LABEL_COL
        if label_col not in df.columns:
            if "akiya_result_cleaned_flag" in df.columns:
                label_col = "akiya_result_cleaned_flag"
                logger.info(f"  Using legacy label column: {label_col}")
            else:
                raise Exception(
                    f"ラベルカラムが見つかりません: {LABEL_COL} または akiya_result_cleaned_flag"
                )

        n_pos = int(df[label_col].sum())
        n_total = len(df)
        logger.info(f"  Total: {n_total:,} | Positive: {n_pos:,} ({n_pos/max(1,n_total):.2%})")

        if n_pos == 0:
            raise Exception("正例（空き家ラベル=1）が0件です。ラベル付きデータを確認してください。")

        update_progress(10)

        # ── Step 2: Resolve feature columns ──────────────────────────────
        feat_cols = _resolve_feature_cols(explanatory_variables, list(df.columns))
        if not feat_cols:
            raise Exception(
                f"有効な説明変数が0個です。指定された変数: {explanatory_variables}"
            )
        logger.info(f"[resolve_features] Features resolved: {len(feat_cols)} / {len(explanatory_variables)} requested")
        logger.info(f"[resolve_features] Columns: {feat_cols}")

        # FR004-007: 説明変数の型不一致(E-201)を _prepare_features の .to_numpy(dtype=float) が
        # 不透明にクラッシュする前に検出し、どの列が非数値かを添えて明示停止する（責任分界=自治体修正）。
        bad_feature_cols = find_non_numeric_feature_columns(df, feat_cols)
        if bad_feature_cols:
            logger.error(f"[validate_features] Non-numeric feature columns: {bad_feature_cols}")
            raise FeatureTypeMismatchError(bad_feature_cols)
        # Log JP→EN mapping results
        mapped = {v: _JP_TO_EN_FEATURE_MAP[v] for v in explanatory_variables if v in _JP_TO_EN_FEATURE_MAP}
        if mapped:
            logger.info(f"[resolve_features] JP→EN mapped: {len(mapped)} columns")
        unresolved = [v for v in explanatory_variables if v not in feat_cols and (v not in _JP_TO_EN_FEATURE_MAP or _JP_TO_EN_FEATURE_MAP[v] not in feat_cols)]
        if unresolved:
            logger.warning(f"[resolve_features] Unresolved variables: {unresolved}")

        update_progress(20)

        # ── Step 3: Prepare features ─────────────────────────────────────
        X_full, used_cols = _prepare_features(df, feat_cols)
        y_full = df[label_col].to_numpy(dtype=float)

        logger.info(f"[prepare_features] Feature matrix shape: {X_full.shape}")
        nan_rates = {c: float(df[c].isna().mean()) for c in used_cols}
        high_nan = {c: f"{r:.2%}" for c, r in nan_rates.items() if r > 0.3}
        if high_nan:
            logger.warning(f"[prepare_features] High NaN rate features (>30%): {high_nan}")

        # ── Prior-Rebalanced sampling（全データ） ────────────────────
        X_rebal, y_rebal = _build_prior_rebalanced_data(
            X_full, y_full, TARGET_PRIOR
        )
        logger.info(f"[prior_rebalance] Rebalanced: {len(X_rebal):,} "
                     f"(pos={int(y_rebal.sum())} = {y_rebal.mean():.2%}, "
                     f"target_prior={TARGET_PRIOR})")

        # Train/test split（rebalanced data）
        X_train_rebal, X_test, y_train_rebal, y_test = train_test_split(
            X_rebal, y_rebal,
            test_size=test_size,
            random_state=RANDOM_SEED,
            stratify=y_rebal,
        )
        idx_train = np.arange(len(X_train_rebal))
        idx_test = np.arange(len(X_test))
        X_train, y_train = X_train_rebal, y_train_rebal
        logger.info(f"[train_test_split] Train: {len(X_train_rebal):,} (pos={int(y_train_rebal.sum())}) | "
                     f"Test: {len(X_test):,} (pos={int(y_test.sum())})")

        update_progress(30)

        # ── Step 5: Build LightGBM params ────────────────────────────────
        lgb_params = dict(DEFAULT_LGB_PARAMS)
        # UIからのパラメータで上書き
        if lambda_l1 > 0:
            lgb_params["reg_alpha"] = lambda_l1
        if lambda_l2 > 0:
            lgb_params["reg_lambda"] = lambda_l2
        if num_leaves != 31:
            lgb_params["num_leaves"] = num_leaves
        if feature_fraction < 1.0:
            lgb_params["colsample_bytree"] = feature_fraction
        if bagging_fraction < 1.0:
            lgb_params["subsample"] = bagging_fraction
        if bagging_freq > 0:
            lgb_params["subsample_freq"] = bagging_freq
        if min_data_in_leaf != 20:
            lgb_params["min_child_samples"] = min_data_in_leaf

        update_progress(35)

        # ── Step 6: Train PU Bagging models ──────────────────────────────
        logger.info(f"[pu_bagging] Training {N_BAGS} PU Bagging models...")

        def _progress_with_logging(pct):
            update_progress(pct)

        training_start = datetime.now()  # NR007: モデル学習（コア）の計測起点
        models = _train_pu_bags(
            X_train_rebal, y_train_rebal,
            lgb_params, N_BAGS,
            progress_cb=_progress_with_logging,
            logger=logger,
        )
        training_sec = (datetime.now() - training_start).total_seconds()
        logger.info(f"[pu_bagging] Training complete: {len(models)} models "
                     f"(Duration: {training_sec:.2f}s)")

        update_progress(75)

        # ── Step 7: Evaluate on test set ─────────────────────────────────
        scores_test = _predict_bags(models, X_test)
        metrics = _evaluate_model(y_test, scores_test, recall_target)
        importance = _compute_feature_importance(models, used_cols)

        logger.info(f"[evaluate] Test metrics:")
        logger.info(f"[evaluate]   P@100={metrics['precisionAt100']}  P@500={metrics['precisionAt500']}  "
                     f"P@1000={metrics['precisionAt1000']}  P@3000={metrics['precisionAt3000']}  "
                     f"P@5000={metrics['precisionAt5000']}")
        logger.info(f"[evaluate]   Lift@1000={metrics['liftAt1000']}  Lift@5000={metrics['liftAt5000']}")
        logger.info(f"[evaluate]   recallTarget={metrics['recallTarget']}  threshold={metrics['threshold']}  "
                     f"candidates={metrics['candidateCount']}  candidateRatio={metrics['candidateRatio']}")
        logger.info(f"[evaluate] Top-5 important features: "
                     f"{[(f['column'], f['value']) for f in importance[:5]]}")

        update_progress(80)

        # ── Step 8: Record metrics to job_tasks ──────────────────────────
        task_result = {
            "taskResultType": "model_create",
            **metrics,
            "important_columns": importance,
            "durationTrainingSec": str(round(training_sec, 2)),
        }
        if task_id:
            create_or_update_job_task(
                job_id, "90", None, None, None,
                json.dumps(task_result, ensure_ascii=False),
                id=task_id, is_finish=False,
            )

        update_progress(85)

        # ── Log task_result being sent to DB ──────────────────────────────
        logger.info(f"[task_result] taskResultType={task_result.get('taskResultType')} "
                     f"important_columns_count={len(task_result.get('important_columns', []))}")

        # ── Step 9: Save model as ZIP ────────────────────────────────────
        os.makedirs(output_path, exist_ok=True)

        # Save model artifact (joblib)
        model_path = os.path.join(output_path, "model.pkl")
        # 推定時にE022が学習時と同じNaN補完を再現するためmedianを保存
        medians = df[used_cols].median()
        joblib.dump({
            "models": models,
            "feat_cols": used_cols,
            "medians": medians.to_dict(),
            "ysc_cap": YSC_CAP,
            "method": "M6_prior_rebal",
            "target_prior": TARGET_PRIOR,
            "n_bags": N_BAGS,
            "lgb_params": lgb_params,
            "recall_target": recall_target,
            "threshold": float(metrics["threshold"]),
            "description": (
                "M6 Prior-Rebalanced PU Bagging model. "
                "Usage: scores = mean([m.predict_proba(X)[:,1] for m in models]). "
                "Select features with feat_cols before prediction."
            ),
        }, model_path)

        # Save metrics JSON
        metrics_path = os.path.join(output_path, "metrics.json")
        with open(metrics_path, "w", encoding="utf-8") as f:
            json.dump({
                "metrics": metrics,
                "feature_importance": importance,
                "training_info": {
                    "n_total": n_total,
                    "n_positive": n_pos,
                    "n_train": len(X_train),
                    "n_test": len(X_test),
                    "n_train_rebalanced": len(X_train_rebal),
                    "n_bags": N_BAGS,
                    "target_prior": TARGET_PRIOR,
                    "recall_target": recall_target,
                    "feature_count": len(used_cols),
                    "features": used_cols,
                },
            }, f, ensure_ascii=False, indent=2)

        # Create ZIP archive
        zip_path = f"{output_path}.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.write(model_path, "model.pkl")
            zf.write(metrics_path, "metrics.json")

        logger.info(f"[save_model] Model artifact keys: models({len(models)} bags), "
                     f"feat_cols({len(used_cols)}), threshold={float(metrics['threshold'])}")
        logger.info(f"[save_model] Model saved: {zip_path}")

        update_progress(95)

        # Finalize task
        # NR007: モデル保存まで含めた処理全体の所要時間を確定して記録する
        total_sec = (datetime.now() - e021_start).total_seconds()
        task_result["durationTotalSec"] = str(round(total_sec, 2))
        logger.info(f"[duration] total={total_sec:.2f}s training={training_sec:.2f}s")
        if task_id:
            create_or_update_job_task(
                job_id, "100", None, None, None,
                json.dumps(task_result, ensure_ascii=False),
                id=task_id, is_finish=True,
            )

    except FeatureTypeMismatchError:
        # 説明変数の型不一致(E-201)は IF002.main が責任分界つきで記録する。汎用の
        # model_learning(状況依存)を二重記録しないよう、ここでは素通しする。
        raise
    except Exception as e:
        # 送出理由を表示用コード付きの文面へ載せる。コードが無いと職員が問い合わせ時に
        # 該当エラーを指し示せず、表示用コードを鍵にする fix_guide も引き当たらない。
        error_msg = ERROR_10001["message"].replace("{param_st1}", str(e))
        logger.error(f"E021 failed: {e}\n{traceback.format_exc()}")
        if task_id:
            create_or_update_job_task(
                job_id, "", None,
                ERROR_10001["code"],
                error_msg,
                json.dumps({}),
                id=task_id, is_finish=True,
            )
        raise
