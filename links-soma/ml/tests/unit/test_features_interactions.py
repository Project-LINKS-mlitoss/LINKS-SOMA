"""preprocessing.features.interactions モジュールの単体テスト

複合空き家リスクスコア（composite_rule_score）の加重計算ロジックを検証する。
"""

import numpy as np
import pandas as pd
import pytest

from preprocessing.features.interactions import add_interaction_features


class TestCompositeRuleScore:
    """composite_rule_score の加重計算テスト"""

    def test_all_vacancy_signals_max_score(self):
        """全空き家シグナル → スコア = 0.4+0.3+0.2+0.1 = 1.0"""
        df = pd.DataFrame({
            "water_disconnection_flag": [1],
            "min_water_usage": [0.0],
            "juki_residence_flag": [0],
            "household_size_juki_residence": [0],
        })
        result = add_interaction_features(df)
        assert result["composite_rule_score"].iloc[0] == pytest.approx(1.0)

    def test_no_vacancy_signals_zero_score(self):
        """全正常シグナル → スコア = 0"""
        df = pd.DataFrame({
            "water_disconnection_flag": [0],
            "min_water_usage": [10.0],
            "juki_residence_flag": [1],
            "household_size_juki_residence": [3],
        })
        result = add_interaction_features(df)
        assert result["composite_rule_score"].iloc[0] == pytest.approx(0.0)

    def test_water_disconnection_only(self):
        """閉栓のみ → 0.4"""
        df = pd.DataFrame({"water_disconnection_flag": [1]})
        result = add_interaction_features(df)
        assert result["composite_rule_score"].iloc[0] == pytest.approx(0.4)

    def test_zero_usage_only(self):
        """最小使用量=0のみ → 0.3"""
        df = pd.DataFrame({"min_water_usage": [0.0]})
        result = add_interaction_features(df)
        assert result["composite_rule_score"].iloc[0] == pytest.approx(0.3)

    def test_no_columns_present(self):
        """入力カラムなし → スコア=0"""
        df = pd.DataFrame({"other": [1, 2, 3]})
        result = add_interaction_features(df)
        assert (result["composite_rule_score"] == 0.0).all()

    def test_nan_water_usage_treated_as_nonzero(self):
        """min_water_usage=NaN → fillna(1)で非ゼロ扱い → 寄与なし"""
        df = pd.DataFrame({"min_water_usage": [np.nan]})
        result = add_interaction_features(df)
        assert result["composite_rule_score"].iloc[0] == pytest.approx(0.0)

    def test_nan_disconnection_flag_treated_as_zero(self):
        """water_disconnection_flag=NaN → fillna(0)で未閉栓扱い → 寄与なし"""
        df = pd.DataFrame({"water_disconnection_flag": [np.nan]})
        result = add_interaction_features(df)
        assert result["composite_rule_score"].iloc[0] == pytest.approx(0.0)

    def test_clip_upper_bound(self):
        """非二値のflag値（2）→ 0.8寄与、clip(upper=1.0)で上限"""
        df = pd.DataFrame({
            "water_disconnection_flag": [2],  # 非二値
            "min_water_usage": [0.0],
        })
        result = add_interaction_features(df)
        # 2*0.4 + 0.3 = 1.1 → clip → 1.0
        assert result["composite_rule_score"].iloc[0] == pytest.approx(1.0)

    def test_empty_dataframe(self):
        """0行のDataFrame → エラーなく完了"""
        df = pd.DataFrame({"water_disconnection_flag": pd.Series(dtype=float)})
        result = add_interaction_features(df)
        assert len(result) == 0
        assert "composite_rule_score" in result.columns
