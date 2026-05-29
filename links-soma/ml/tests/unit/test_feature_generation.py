"""特徴量生成の完全性テスト

add_water_features / add_juki_features / add_interaction_features を
組み合わせて適用した結果、FEATURE_COLS 39個が全て生成され、
入力データに応じた非null条件を満たすことを検証する。

個別関数の計算ロジックは test_features_water.py / test_features_juki.py /
test_features_interactions.py でカバー済み。本テストは横断的な生成完全性を保証する。
"""

import numpy as np
import pandas as pd
import pytest

from preprocessing.features.water import add_water_features
from preprocessing.features.juki import add_juki_features
from preprocessing.features.interactions import add_interaction_features
from shared import FEATURE_COLS


REF_DATE = pd.Timestamp("2024-01-01")


def _build_full_sample() -> pd.DataFrame:
    """水道・住基・イベントデータを全て揃えたサンプル（1行）

    全FEATURE_COLSが非null（一部を除く）になるよう設計:
    - 閉栓済み + 使用量あり + 住基あり + イベントあり
    """
    return pd.DataFrame({
        # 水道基本
        "water_disconnection_flag": [1],
        "avg_water_usage": [15.0],
        "max_water_usage": [30.0],
        "total_water_usage": [90.0],
        "change_rate_waterusage_over_last4months": [0.5],
        # 水道使用量（f1-f6）
        "suido_usage_f1": [10.0],
        "suido_usage_f2": [12.0],
        "suido_usage_f3": [8.0],
        "suido_usage_f4": [15.0],
        "suido_usage_f5": [20.0],
        "suido_usage_f6": [18.0],
        # 閉栓日（years_since_closure用）
        "usage_end_date": [20220601.0],
        # 住基基本
        "juki_residence_flag": [1],
        "household_size_juki_residence": [2],
        "max_age_juki_residence": [70.0],
        "over_65_count_juki_residence": [1],
        "under_15_count_juki_residence": [0],
        "residence_duration_juki_residence": [3650.0],
        "num_deaths_juki_residence": [0],
        "num_inmigrants_juki_residence": [1],
        "num_outmigrants_relocations_juki_residence": [1.0],
        "average_waterusage_person": [7.5],
        # 住基イベント
        "reason_transfer_1_juki_residence": ["転入"],
        "reason_transfer_2_juki_residence": ["死亡"],
        "reason_transfer_3_juki_residence": ["転出"],
        "reason_transfer_4_juki_residence": ["職権消除"],
        # move_date（住定日）ベースで経過年数を計算
        "move_date_1_juki_residence": [20220101.0],
        "move_date_2_juki_residence": [20230301.0],
        "move_date_3_juki_residence": [20230601.0],
        "move_date_4_juki_residence": [20231001.0],
    })


def _apply_all_features(df: pd.DataFrame) -> pd.DataFrame:
    """3つの特徴量生成関数を順に適用"""
    df = add_water_features(df, REF_DATE)
    df = add_juki_features(df, REF_DATE)
    df = add_interaction_features(df)
    return df


class TestFeatureColsCompleteness:
    """FEATURE_COLS 40個の生成完全性"""

    def test_all_feature_cols_present(self):
        """全入力データを揃えた場合、FEATURE_COLS 40カラムが全て存在する"""
        df = _apply_all_features(_build_full_sample())
        missing = [col for col in FEATURE_COLS if col not in df.columns]
        assert missing == [], f"生成されなかったカラム: {missing}"

    def test_feature_cols_count(self):
        """FEATURE_COLS は39個"""
        assert len(FEATURE_COLS) == 39, (
            f"FEATURE_COLS が {len(FEATURE_COLS)} 個（期待: 39）"
        )


class TestNonNullWithFullData:
    """全入力データを揃えた場合の非null検証

    「値があるのにnullになっていないか」を系統別に検証する。
    各カラムの計算式から、このサンプルデータでは非nullになるべきカラムを特定。
    """

    @pytest.fixture()
    def result(self):
        return _apply_all_features(_build_full_sample())

    # ── 水道系（入力データそのまま渡すカラム）──────────────────────
    @pytest.mark.parametrize("col", [
        "water_disconnection_flag",
        "avg_water_usage",
        "max_water_usage",
        "total_water_usage",
        "change_rate_waterusage_over_last4months",
        "suido_usage_f1", "suido_usage_f2", "suido_usage_f3",
        "suido_usage_f4", "suido_usage_f5", "suido_usage_f6",
    ])
    def test_water_base_columns_not_null(self, result, col):
        """水道系基本カラム: 入力値があれば非null"""
        assert pd.notna(result[col].iloc[0]), f"{col} が null"

    # ── 水道時系列（add_water_features で生成）──────────────────
    @pytest.mark.parametrize("col", [
        "has_usage_data",
        "num_zero_periods",
        "min_water_usage",
        "usage_first_half_avg",
        "usage_second_half_avg",
        "usage_half_year_change_rate",
        "recent_usage_avg",
    ])
    def test_water_derived_columns_not_null(self, result, col):
        """水道時系列: f1-f6が全てあれば非null"""
        assert pd.notna(result[col].iloc[0]), f"{col} が null"

    def test_years_since_closure_not_null_when_closed(self, result):
        """閉栓済み + usage_end_date あり → years_since_closure は非null"""
        assert pd.notna(result["years_since_closure"].iloc[0])

    def test_years_since_closure_positive(self, result):
        """閉栓日が過去 → years_since_closure > 0"""
        assert result["years_since_closure"].iloc[0] > 0

    def test_usage_data_unavailable_flag_value(self, result):
        """閉栓済み + avg_water_usageあり → usage_data_unavailable_flag = 0"""
        assert result["usage_data_unavailable_flag"].iloc[0] == 0

    # ── 住基系（入力データそのまま + キャップ処理）──────────────
    @pytest.mark.parametrize("col", [
        "juki_residence_flag",
        "household_size_juki_residence",
        "max_age_juki_residence",
        "over_65_count_juki_residence",
        "under_15_count_juki_residence",
        "residence_duration_juki_residence",
        "num_deaths_juki_residence",
        "num_inmigrants_juki_residence",
        "num_outmigrants_relocations_juki_residence",
        "average_waterusage_person",
    ])
    def test_juki_base_columns_not_null(self, result, col):
        """住基系基本カラム: 入力値があれば非null"""
        assert pd.notna(result[col].iloc[0]), f"{col} が null"

    # ── 住基イベント系（add_juki_features で生成）────────────────
    def test_max_age_isnull_flag(self, result):
        """max_age 非null → max_age_juki_residence_isnull = 0"""
        assert result["max_age_juki_residence_isnull"].iloc[0] == 0

    @pytest.mark.parametrize("col", [
        "has_cancellation_event",
        "num_outmigrant_events",
        "years_since_last_transfer",
        "sole_elderly_resident",
        "death_no_replacement",
        "household_shrinkage_rate",
    ])
    def test_juki_event_columns_not_null(self, result, col):
        """住基イベント系: reason/dateカラムがあれば非null"""
        assert pd.notna(result[col].iloc[0]), f"{col} が null"

    def test_years_since_last_transfer_is_missing_zero(self, result):
        """異動日あり → years_since_last_transfer_is_missing = 0"""
        assert result["years_since_last_transfer_is_missing"].iloc[0] == 0

    # ── 交差・ルール系（add_interaction_features で生成）──────────
    def test_composite_rule_score_not_null(self, result):
        """composite_rule_score は常に非null"""
        assert pd.notna(result["composite_rule_score"].iloc[0])


class TestNullWithMinimalData:
    """最小入力データ（水道・住基なし）での期待されるnull

    入力データが欠損している場合に、計算不能なカラムが
    適切にnull/デフォルト値になることを検証する。
    """

    @pytest.fixture()
    def result(self):
        df = pd.DataFrame({"other": [1]})
        return _apply_all_features(df)

    def test_water_derived_not_generated(self, result):
        """f1-f6がない → 水道時系列カラムは生成されない"""
        for col in ["has_usage_data", "num_zero_periods", "min_water_usage"]:
            assert col not in result.columns, f"{col} が存在するべきでない"

    def test_years_since_closure_not_generated(self, result):
        """usage_end_date がない → years_since_closure は生成されない"""
        assert "years_since_closure" not in result.columns

    def test_juki_event_defaults(self, result):
        """reasonカラムなし → イベントフラグはデフォルト値"""
        assert result["has_cancellation_event"].iloc[0] == 0
        assert np.isnan(result["num_outmigrant_events"].iloc[0])

    def test_sole_elderly_default(self, result):
        """住基カラムなし → sole_elderly_resident = 0"""
        assert result["sole_elderly_resident"].iloc[0] == 0

    def test_composite_rule_score_zero(self, result):
        """入力カラムなし → composite_rule_score = 0"""
        assert result["composite_rule_score"].iloc[0] == pytest.approx(0.0)

    def test_years_since_last_transfer_missing(self, result):
        """dateカラムなし → years_since_last_transfer_is_missing = 1"""
        assert result["years_since_last_transfer_is_missing"].iloc[0] == 1
