"""preprocessing.features.touki モジュールの単体テスト

登記特徴量（建物登録経過年数、純居住用途判定、所有権移転回数）の検証。
適用都市: 登記データがある都市のみ。
touki_residence_flag が存在しない場合は全処理をスキップ。
"""

import numpy as np
import pandas as pd
import pytest

from preprocessing.features.touki import add_touki_features


# ══════════════════════════════════════════════════════════════════════════════
# 早期リターン
# ══════════════════════════════════════════════════════════════════════════════


class TestToukiSkip:
    """touki_residence_flag がない場合はスキップ"""

    REF = pd.Timestamp("2024-01-01")

    def test_no_touki_flag_returns_unchanged(self):
        """touki_residence_flag がなければ何も追加しない"""
        df = pd.DataFrame({"other": [1]})
        result = add_touki_features(df, self.REF)
        assert "building_registration_age_years" not in result.columns
        assert "is_pure_residential" not in result.columns
        assert "multiple_ownership_changes" not in result.columns


# ══════════════════════════════════════════════════════════════════════════════
# 建物登録経過年数
# ══════════════════════════════════════════════════════════════════════════════


class TestBuildingRegistrationAge:
    """building_registration_age_years: 最新登記日からの経過年数"""

    REF = pd.Timestamp("2024-01-01")

    def test_basic_age(self):
        """2020年登記 + touki_flag=1 → 約4年"""
        df = pd.DataFrame({
            "registration_date_touki_residence": [20200101.0],
            "touki_residence_flag": [1],
        })
        result = add_touki_features(df, self.REF)
        assert result["building_registration_age_years"].iloc[0] == pytest.approx(4.0, abs=0.02)
        assert result["building_registration_age_years_is_missing"].iloc[0] == 0

    def test_unmatched_flag_zero(self):
        """touki_residence_flag=0 → NaN（登記マッチ失敗）"""
        df = pd.DataFrame({
            "registration_date_touki_residence": [20200101.0],
            "touki_residence_flag": [0],
        })
        result = add_touki_features(df, self.REF)
        assert np.isnan(result["building_registration_age_years"].iloc[0])
        assert result["building_registration_age_years_is_missing"].iloc[0] == 1

    def test_missing_date(self):
        """登記日なし → NaN + missing=1"""
        df = pd.DataFrame({
            "registration_date_touki_residence": [np.nan],
            "touki_residence_flag": [1],
        })
        result = add_touki_features(df, self.REF)
        assert np.isnan(result["building_registration_age_years"].iloc[0])
        assert result["building_registration_age_years_is_missing"].iloc[0] == 1


# ══════════════════════════════════════════════════════════════════════════════
# 純居住用途判定
# ══════════════════════════════════════════════════════════════════════════════


class TestIsPureResidential:
    """is_pure_residential: 登記理由が居宅/共同住宅/長屋か"""

    REF = pd.Timestamp("2024-01-01")

    def test_kyotaku(self):
        """居宅 + flag=1 → 1"""
        df = pd.DataFrame({
            "registration_reason_touki_residence": ["居宅"],
            "touki_residence_flag": [1],
        })
        result = add_touki_features(df, self.REF)
        assert result["is_pure_residential"].iloc[0] == 1.0

    def test_non_residential(self):
        """事務所 + flag=1 → 0"""
        df = pd.DataFrame({
            "registration_reason_touki_residence": ["事務所"],
            "touki_residence_flag": [1],
        })
        result = add_touki_features(df, self.REF)
        assert result["is_pure_residential"].iloc[0] == 0.0

    def test_unmatched_is_nan(self):
        """touki_residence_flag=0 → NaN（未知）+ missing=1"""
        df = pd.DataFrame({
            "registration_reason_touki_residence": ["居宅"],
            "touki_residence_flag": [0],
        })
        result = add_touki_features(df, self.REF)
        assert np.isnan(result["is_pure_residential"].iloc[0])
        assert result["is_pure_residential_is_missing"].iloc[0] == 1

    def test_matched_non_residential_missing_zero(self):
        """flag=1 + 非居住 → is_pure_residential=0, missing=0"""
        df = pd.DataFrame({
            "registration_reason_touki_residence": ["事務所"],
            "touki_residence_flag": [1],
        })
        result = add_touki_features(df, self.REF)
        assert result["is_pure_residential_is_missing"].iloc[0] == 0


# ══════════════════════════════════════════════════════════════════════════════
# 所有権移転回数
# ══════════════════════════════════════════════════════════════════════════════


class TestMultipleOwnershipChanges:
    """multiple_ownership_changes: 登記イベント3回以上 かつ flag=1"""

    REF = pd.Timestamp("2024-01-01")

    def test_three_or_more_matched(self):
        """3回以上 + flag=1 → 1"""
        df = pd.DataFrame({
            "events_count_touki_residence": [3],
            "touki_residence_flag": [1],
        })
        result = add_touki_features(df, self.REF)
        assert result["multiple_ownership_changes"].iloc[0] == 1

    def test_less_than_three(self):
        """2回 + flag=1 → 0"""
        df = pd.DataFrame({
            "events_count_touki_residence": [2],
            "touki_residence_flag": [1],
        })
        result = add_touki_features(df, self.REF)
        assert result["multiple_ownership_changes"].iloc[0] == 0

    def test_unmatched_flag_zero(self):
        """3回以上でもflag=0 → 0"""
        df = pd.DataFrame({
            "events_count_touki_residence": [5],
            "touki_residence_flag": [0],
        })
        result = add_touki_features(df, self.REF)
        assert result["multiple_ownership_changes"].iloc[0] == 0
