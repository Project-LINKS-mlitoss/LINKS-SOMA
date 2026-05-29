"""preprocessing.features.juki モジュールの単体テスト

住民基本台帳イベント特徴量（死亡/転出フラグ、マイナンバー除外、独居高齢者等）の検証。
"""

import numpy as np
import pandas as pd
import pytest

from preprocessing.features.juki import (
    add_juki_features,
    _parse_yyyymmdd,
    _reason_cols,
    _move_date_cols,
    _contains_keyword,
)


# ══════════════════════════════════════════════════════════════════════════════
# ヘルパー関数
# ══════════════════════════════════════════════════════════════════════════════


class TestReasonCols:
    """_reason_cols: DataFrameから存在するreason_transfer_Nカラムを取得"""

    def test_returns_present_columns(self):
        df = pd.DataFrame({
            "reason_transfer_1_juki_residence": ["転入"],
            "reason_transfer_3_juki_residence": ["転出"],
            "other": [1],
        })
        assert _reason_cols(df) == [
            "reason_transfer_1_juki_residence",
            "reason_transfer_3_juki_residence",
        ]

    def test_returns_empty_when_none(self):
        df = pd.DataFrame({"other": [1]})
        assert _reason_cols(df) == []


class TestMoveDateCols:
    """_move_date_cols: DataFrameから存在するmove_date_Nカラムを取得"""

    def test_returns_present_columns(self):
        df = pd.DataFrame({
            "move_date_1_juki_residence": ["20200101"],
            "move_date_3_juki_residence": ["20210601"],
            "other": [1],
        })
        assert _move_date_cols(df) == [
            "move_date_1_juki_residence",
            "move_date_3_juki_residence",
        ]

    def test_returns_empty_when_none(self):
        df = pd.DataFrame({"other": [1]})
        assert _move_date_cols(df) == []


class TestContainsKeyword:
    """_contains_keyword: Series内のキーワード検索"""

    def test_finds_keyword(self):
        s = pd.Series(["死亡", "転入", "職権消除"])
        result = _contains_keyword(s, "死亡")
        assert result.tolist() == [True, False, False]

    def test_handles_nan(self):
        s = pd.Series([np.nan, "転入"])
        result = _contains_keyword(s, "転入")
        assert result.tolist() == [False, True]


class TestJukiParseYyyymmdd:
    """juki版_parse_yyyymmdd: スラッシュ形式対応"""

    def test_slash_format(self):
        """YYYY/MM/DD形式をパース"""
        result = _parse_yyyymmdd(pd.Series(["2020/01/15"]))
        assert result.iloc[0] == pd.Timestamp("2020-01-15")

    def test_slash_single_digit(self):
        """YYYY/M/D形式（1桁月日）をパース"""
        result = _parse_yyyymmdd(pd.Series(["2020/1/5"]))
        assert result.iloc[0] == pd.Timestamp("2020-01-05")


# ══════════════════════════════════════════════════════════════════════════════
# add_juki_features — キャップ
# ══════════════════════════════════════════════════════════════════════════════


class TestJukiCaps:
    """residence_duration / household_size のキャップ処理"""

    REF = pd.Timestamp("2024-01-01")

    def test_residence_duration_capped_at_36500(self):
        """residence_durationが36500（約100年）でクリップされる"""
        df = pd.DataFrame({"residence_duration_juki_residence": [50000.0]})
        result = add_juki_features(df, self.REF)
        assert result["residence_duration_juki_residence"].iloc[0] == 36500

    def test_household_size_capped_at_20(self):
        """household_sizeが20でクリップされる"""
        df = pd.DataFrame({"household_size_juki_residence": [100]})
        result = add_juki_features(df, self.REF)
        assert result["household_size_juki_residence"].iloc[0] == 20


# ══════════════════════════════════════════════════════════════════════════════
# add_juki_features — イベントフラグ
# ══════════════════════════════════════════════════════════════════════════════


class TestEventFlags:
    """reason_transfer カラムからのイベントフラグ抽出"""

    REF = pd.Timestamp("2024-01-01")

    def test_death_event_detected(self):
        """死亡イベントが検出される"""
        df = pd.DataFrame({
            "reason_transfer_1_juki_residence": ["転入"],
            "reason_transfer_2_juki_residence": ["死亡"],
        })
        result = add_juki_features(df, self.REF)
        assert result["has_death_event"].iloc[0] == 1

    def test_cancellation_event_detected(self):
        """職権消除イベントが検出される"""
        df = pd.DataFrame({
            "reason_transfer_1_juki_residence": ["職権消除"],
        })
        result = add_juki_features(df, self.REF)
        assert result["has_cancellation_event"].iloc[0] == 1

    def test_outmigrant_count(self):
        """転出イベントのカウント"""
        df = pd.DataFrame({
            "reason_transfer_1_juki_residence": ["転出"],
            "reason_transfer_2_juki_residence": ["転入"],
            "reason_transfer_3_juki_residence": ["転出"],
        })
        result = add_juki_features(df, self.REF)
        assert result["num_outmigrant_events"].iloc[0] == 2

    def test_no_events(self):
        """イベントなし → 全フラグ0"""
        df = pd.DataFrame({
            "reason_transfer_1_juki_residence": ["転入"],
        })
        result = add_juki_features(df, self.REF)
        assert result["has_death_event"].iloc[0] == 0
        assert result["has_cancellation_event"].iloc[0] == 0
        assert result["num_outmigrant_events"].iloc[0] == 0

    def test_no_reason_columns_fallback(self):
        """reasonカラムなし → デフォルト値"""
        df = pd.DataFrame({"other": [1]})
        result = add_juki_features(df, self.REF)
        assert result["has_death_event"].iloc[0] == 0
        assert result["has_cancellation_event"].iloc[0] == 0
        assert np.isnan(result["num_outmigrant_events"].iloc[0])


# ══════════════════════════════════════════════════════════════════════════════
# add_juki_features — 最終異動日
# ══════════════════════════════════════════════════════════════════════════════


class TestYearsSinceLastTransfer:
    """最終住定日からの経過年数（move_dateベース・未来日マスク含む）

    move_date（住定日）は行政イベント（マイナンバー一括更新等）の影響を受けないため、
    reason_transfer によるフィルタリングは不要。
    """

    REF = pd.Timestamp("2024-01-01")

    def test_basic_move_date(self):
        """通常の住定日 → 正しい経過年数"""
        df = pd.DataFrame({
            "move_date_1_juki_residence": [20230101.0],
        })
        result = add_juki_features(df, self.REF)
        assert result["years_since_last_transfer"].iloc[0] == pytest.approx(1.0, abs=0.01)
        assert result["years_since_last_transfer_is_missing"].iloc[0] == 0

    def test_multiple_move_dates_uses_latest(self):
        """複数の住定日がある場合、最新のものが使われる"""
        df = pd.DataFrame({
            "move_date_1_juki_residence": [20200101.0],
            "move_date_2_juki_residence": [20230601.0],
        })
        result = add_juki_features(df, self.REF)
        # 2023-06-01 → 2024-01-01 = 214日 / 365.25 ≈ 0.586年
        assert result["years_since_last_transfer"].iloc[0] == pytest.approx(0.586, abs=0.01)

    def test_no_reason_filter_needed(self):
        """move_dateはreason_transferに依存しない（マイナンバーフィルタ不要）

        date_transfer時代は reason="914" のイベントを除外する必要があったが、
        move_date は住定日であり行政一括更新の影響を受けないため、
        reason_transfer カラムの有無に関わらず正しく計算される。
        """
        df = pd.DataFrame({
            "move_date_1_juki_residence": [20200101.0],
            "reason_transfer_1_juki_residence": ["914"],
        })
        result = add_juki_features(df, self.REF)
        # reason="914" でもmove_dateはそのまま使われる
        assert result["years_since_last_transfer"].iloc[0] == pytest.approx(4.0, abs=0.01)
        assert result["years_since_last_transfer_is_missing"].iloc[0] == 0

    def test_future_date_masked(self):
        """未来の住定日はマスクされる"""
        df = pd.DataFrame({
            "move_date_1_juki_residence": [20250601.0],
        })
        result = add_juki_features(df, self.REF)
        assert np.isnan(result["years_since_last_transfer"].iloc[0])

    def test_no_move_date_columns_fallback(self):
        """move_dateカラムなし → NaN + missing=1"""
        df = pd.DataFrame({"other": [1]})
        result = add_juki_features(df, self.REF)
        assert np.isnan(result["years_since_last_transfer"].iloc[0])
        assert result["years_since_last_transfer_is_missing"].iloc[0] == 1


# ══════════════════════════════════════════════════════════════════════════════
# add_juki_features — 複合特徴量
# ══════════════════════════════════════════════════════════════════════════════


class TestSoleElderlyResident:
    """独居高齢者フラグ"""

    REF = pd.Timestamp("2024-01-01")

    def test_sole_elderly(self):
        """世帯人数1 + 年齢65歳以上 → 1"""
        df = pd.DataFrame({
            "household_size_juki_residence": [1],
            "max_age_juki_residence": [70.0],
        })
        result = add_juki_features(df, self.REF)
        assert result["sole_elderly_resident"].iloc[0] == 1

    def test_boundary_age_64(self):
        """世帯人数1 + 年齢64歳 → 0（境界値）"""
        df = pd.DataFrame({
            "household_size_juki_residence": [1],
            "max_age_juki_residence": [64.0],
        })
        result = add_juki_features(df, self.REF)
        assert result["sole_elderly_resident"].iloc[0] == 0

    def test_multi_person_household(self):
        """世帯人数2以上 → 0（高齢でも独居でない）"""
        df = pd.DataFrame({
            "household_size_juki_residence": [2],
            "max_age_juki_residence": [80.0],
        })
        result = add_juki_features(df, self.REF)
        assert result["sole_elderly_resident"].iloc[0] == 0

    def test_fallback_when_columns_missing(self):
        """必要カラムなし → 0"""
        df = pd.DataFrame({"other": [1]})
        result = add_juki_features(df, self.REF)
        assert result["sole_elderly_resident"].iloc[0] == 0


class TestDeathNoReplacement:
    """死亡後転入なしフラグ"""

    REF = pd.Timestamp("2024-01-01")

    def test_death_with_no_inmigrants(self):
        """死亡あり + 転入者0 → 1"""
        df = pd.DataFrame({
            "reason_transfer_1_juki_residence": ["死亡"],
            "num_inmigrants_juki_residence": [0],
        })
        result = add_juki_features(df, self.REF)
        assert result["death_no_replacement"].iloc[0] == 1

    def test_death_with_inmigrants(self):
        """死亡あり + 転入者あり → 0"""
        df = pd.DataFrame({
            "reason_transfer_1_juki_residence": ["死亡"],
            "num_inmigrants_juki_residence": [2],
        })
        result = add_juki_features(df, self.REF)
        assert result["death_no_replacement"].iloc[0] == 0

    def test_fallback_equals_death_event(self):
        """num_inmigrantsカラムなし → has_death_eventと同値"""
        df = pd.DataFrame({
            "reason_transfer_1_juki_residence": ["死亡"],
        })
        result = add_juki_features(df, self.REF)
        assert result["death_no_replacement"].iloc[0] == result["has_death_event"].iloc[0]


class TestHouseholdShrinkageRate:
    """世帯縮小率"""

    REF = pd.Timestamp("2024-01-01")

    def test_basic_shrinkage(self):
        """転出2人 / 世帯4人 = 0.5"""
        df = pd.DataFrame({
            "num_outmigrants_relocations_juki_residence": [2.0],
            "household_size_juki_residence": [4],
        })
        result = add_juki_features(df, self.REF)
        assert result["household_shrinkage_rate"].iloc[0] == pytest.approx(0.5)

    def test_zero_household_size_clipped(self):
        """世帯人数0 → clip(lower=1)でゼロ除算回避"""
        df = pd.DataFrame({
            "num_outmigrants_relocations_juki_residence": [1.0],
            "household_size_juki_residence": [0],
        })
        result = add_juki_features(df, self.REF)
        assert result["household_shrinkage_rate"].iloc[0] == pytest.approx(1.0)

    def test_fallback_nan(self):
        """必要カラムなし → NaN"""
        df = pd.DataFrame({"other": [1]})
        result = add_juki_features(df, self.REF)
        assert np.isnan(result["household_shrinkage_rate"].iloc[0])
