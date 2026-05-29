"""preprocessing.features.water モジュールの単体テスト

水道メーター特徴量（使用量統計、閉栓経過年数）の計算ロジックを検証する。
"""

import numpy as np
import pandas as pd
import pytest

from preprocessing.features.water import _parse_yyyymmdd, add_water_features


# ══════════════════════════════════════════════════════════════════════════════
# _parse_yyyymmdd
# ══════════════════════════════════════════════════════════════════════════════


class TestParseYyyymmdd:
    """日付パース関数のテスト"""

    def test_yyyymmdd_float(self):
        """YYYYMMDD浮動小数点数をTimestampに変換"""
        result = _parse_yyyymmdd(pd.Series([20240331.0]))
        assert result.iloc[0] == pd.Timestamp("2024-03-31")

    def test_yyyymmdd_string(self):
        """YYYYMMDD文字列をTimestampに変換"""
        result = _parse_yyyymmdd(pd.Series(["20200115"]))
        assert result.iloc[0] == pd.Timestamp("2020-01-15")

    def test_iso_format(self):
        """ISO 8601形式（YYYY-MM-DD、10文字）をパース"""
        result = _parse_yyyymmdd(pd.Series(["2024-03-31"]))
        assert result.iloc[0] == pd.Timestamp("2024-03-31")

    def test_short_iso_falls_through(self):
        """ハイフンありだが10文字でない場合はYYYYMMDDフォールバック"""
        # "2020-1-5" はlen=8、ISOブランチをスキップしYYYYMMDD変換を試みる
        result = _parse_yyyymmdd(pd.Series(["2020-1-5"]))
        # int(float("2020-1-5")) は例外 → NaT
        assert pd.isna(result.iloc[0])

    def test_nan_returns_nat(self):
        """NaN → NaT"""
        result = _parse_yyyymmdd(pd.Series([np.nan]))
        assert pd.isna(result.iloc[0])

    def test_none_returns_nat(self):
        """None → NaT"""
        result = _parse_yyyymmdd(pd.Series([None]))
        assert pd.isna(result.iloc[0])

    def test_string_nan_returns_nat(self):
        """文字列"nan" → NaT"""
        result = _parse_yyyymmdd(pd.Series(["nan"]))
        assert pd.isna(result.iloc[0])

    def test_empty_string_returns_nat(self):
        """空文字列 → NaT"""
        result = _parse_yyyymmdd(pd.Series([""]))
        assert pd.isna(result.iloc[0])

    def test_garbage_returns_nat(self):
        """不正な文字列 → NaT"""
        result = _parse_yyyymmdd(pd.Series(["abc"]))
        assert pd.isna(result.iloc[0])


# ══════════════════════════════════════════════════════════════════════════════
# add_water_features — 使用量統計
# ══════════════════════════════════════════════════════════════════════════════


class TestWaterUsageStats:
    """水道使用量統計の特徴量テスト"""

    REF_DATE = pd.Timestamp("2024-01-01")

    def _make_df(self, **kwargs):
        """suido_usage_f1〜f6を持つDataFrameを作成"""
        defaults = {f"suido_usage_f{i}": [0.0] for i in range(1, 7)}
        defaults.update(kwargs)
        return pd.DataFrame(defaults)

    def test_all_zero_usage(self):
        """全期間ゼロ → num_zero_periods=6, min=0"""
        df = self._make_df()
        result = add_water_features(df, self.REF_DATE)
        assert result["num_zero_periods"].iloc[0] == 6
        assert result["min_water_usage"].iloc[0] == 0

    def test_all_nan_usage(self):
        """全期間NaN → num_zero_periods=0, min=NaN, has_usage_data=0"""
        df = self._make_df(**{f"suido_usage_f{i}": [np.nan] for i in range(1, 7)})
        result = add_water_features(df, self.REF_DATE)
        assert result["has_usage_data"].iloc[0] == 0
        assert result["num_zero_periods"].iloc[0] == 0  # NaNは0としてカウントされない
        assert np.isnan(result["min_water_usage"].iloc[0])

    def test_mixed_usage(self):
        """混合データ → 正しい統計値"""
        df = self._make_df(
            suido_usage_f1=[10.0], suido_usage_f2=[0.0], suido_usage_f3=[5.0],
            suido_usage_f4=[0.0], suido_usage_f5=[0.0], suido_usage_f6=[3.0],
        )
        result = add_water_features(df, self.REF_DATE)
        assert result["has_usage_data"].iloc[0] == 1
        assert result["num_zero_periods"].iloc[0] == 3
        assert result["min_water_usage"].iloc[0] == 0

    def test_no_usage_columns_skips_features(self):
        """f1〜f6がない → 使用量特徴量は追加されない"""
        df = pd.DataFrame({"other": [1, 2]})
        result = add_water_features(df, self.REF_DATE)
        assert "num_zero_periods" not in result.columns
        assert "has_usage_data" not in result.columns

    def test_half_year_change_rate_increasing(self):
        """前半<後半 → 正の変化率（再入居シグナル）"""
        df = self._make_df(
            suido_usage_f1=[1.0], suido_usage_f2=[1.0], suido_usage_f3=[1.0],
            suido_usage_f4=[2.0], suido_usage_f5=[2.0], suido_usage_f6=[2.0],
        )
        result = add_water_features(df, self.REF_DATE)
        # (2-1)/1 = 1.0
        assert result["usage_half_year_change_rate"].iloc[0] == pytest.approx(1.0)

    def test_half_year_change_rate_zero_denominator(self):
        """前半平均=0 → 変化率はNaN（ゼロ除算回避）"""
        df = self._make_df(
            suido_usage_f1=[0.0], suido_usage_f2=[0.0], suido_usage_f3=[0.0],
            suido_usage_f4=[5.0], suido_usage_f5=[5.0], suido_usage_f6=[5.0],
        )
        result = add_water_features(df, self.REF_DATE)
        assert np.isnan(result["usage_half_year_change_rate"].iloc[0])

    def test_recent_usage_avg(self):
        """直近2期間（f5, f6）の平均"""
        df = self._make_df(
            suido_usage_f1=[0.0], suido_usage_f2=[0.0], suido_usage_f3=[0.0],
            suido_usage_f4=[0.0], suido_usage_f5=[10.0], suido_usage_f6=[20.0],
        )
        result = add_water_features(df, self.REF_DATE)
        assert result["recent_usage_avg"].iloc[0] == pytest.approx(15.0)

    def test_empty_dataframe(self):
        """0行のDataFrame → エラーなく完了"""
        df = pd.DataFrame({f"suido_usage_f{i}": pd.Series(dtype=float) for i in range(1, 7)})
        result = add_water_features(df, self.REF_DATE)
        assert len(result) == 0
        assert "num_zero_periods" in result.columns


# ══════════════════════════════════════════════════════════════════════════════
# add_water_features — 閉栓経過年数
# ══════════════════════════════════════════════════════════════════════════════


class TestYearsSinceClosure:
    """閉栓経過年数の特徴量テスト"""

    REF_DATE = pd.Timestamp("2024-01-01")

    def test_closed_meter_with_past_date(self):
        """閉栓済み + 過去の日付 → 正の経過年数"""
        df = pd.DataFrame({
            "usage_end_date": [20230101.0],
            "water_disconnection_flag": [1],
        })
        result = add_water_features(df, self.REF_DATE)
        # 2023-01-01 → 2024-01-01 = 約1.0年
        assert result["years_since_closure"].iloc[0] == pytest.approx(1.0, abs=0.01)

    def test_open_meter_returns_nan(self):
        """未閉栓 → NaN"""
        df = pd.DataFrame({
            "usage_end_date": [20230101.0],
            "water_disconnection_flag": [0],
        })
        result = add_water_features(df, self.REF_DATE)
        assert np.isnan(result["years_since_closure"].iloc[0])

    def test_future_date_clipped_to_zero(self):
        """未来の閉栓日 → 0にクリップ（データ入力ミス対応）"""
        df = pd.DataFrame({
            "usage_end_date": [20250601.0],
            "water_disconnection_flag": [1],
        })
        result = add_water_features(df, self.REF_DATE)
        assert result["years_since_closure"].iloc[0] == 0.0

    def test_no_disconnection_flag_column(self):
        """water_disconnection_flagカラムなし → デフォルト0で全行NaN"""
        df = pd.DataFrame({"usage_end_date": [20230101.0]})
        result = add_water_features(df, self.REF_DATE)
        assert np.isnan(result["years_since_closure"].iloc[0])


# ══════════════════════════════════════════════════════════════════════════════
# add_water_features — usage_data_unavailable_flag
# ══════════════════════════════════════════════════════════════════════════════


class TestUsageDataUnavailableFlag:
    """使用量データ欠損フラグのテスト"""

    REF_DATE = pd.Timestamp("2024-01-01")

    def test_closed_with_no_usage_data(self):
        """閉栓済み + avg_water_usage=NaN → フラグ=1"""
        df = pd.DataFrame({
            "water_disconnection_flag": [1],
            "avg_water_usage": [np.nan],
        })
        result = add_water_features(df, self.REF_DATE)
        assert result["usage_data_unavailable_flag"].iloc[0] == 1

    def test_closed_with_usage_data(self):
        """閉栓済み + avg_water_usageあり → フラグ=0"""
        df = pd.DataFrame({
            "water_disconnection_flag": [1],
            "avg_water_usage": [5.0],
        })
        result = add_water_features(df, self.REF_DATE)
        assert result["usage_data_unavailable_flag"].iloc[0] == 0

    def test_open_meter_with_no_usage(self):
        """未閉栓 + avg_water_usage=NaN → フラグ=0"""
        df = pd.DataFrame({
            "water_disconnection_flag": [0],
            "avg_water_usage": [np.nan],
        })
        result = add_water_features(df, self.REF_DATE)
        assert result["usage_data_unavailable_flag"].iloc[0] == 0

    def test_missing_columns_skips_flag(self):
        """必要カラムがない → フラグ未追加"""
        df = pd.DataFrame({"other": [1]})
        result = add_water_features(df, self.REF_DATE)
        assert "usage_data_unavailable_flag" not in result.columns
