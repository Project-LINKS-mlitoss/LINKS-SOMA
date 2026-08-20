"""Unit tests for juki (住民基本台帳) aggregation logic.

Tests use dummy data with obviously fake addresses to ensure no real data is used.
Covers:
  - Task 1: Grouping by (household_code, address)
  - Task 2: Household size = settled before cutoff - departed before cutoff
  - Task 3: Reference date filtering for all person counts
  - The user's specific calculation example
  - Edge cases: empty data, multiple households, snapshot vs full_history
"""

import numpy as np
import pandas as pd
import pytest

from preprocessing.record_linkage.juki import (
    _to_num,
    filter_settled_before_cutoff,
    filter_single_household_addresses,
    calculate_household_size,
    calculate_event_counts,
    calculate_age_stats,
    _get_active_residents,
    aggregate_juki,
)


# ═══════════════════════════════════════════════════════════════════════════════
# Test data factory
# ═══════════════════════════════════════════════════════════════════════════════

def _make_juki_df(records: list[dict]) -> pd.DataFrame:
    """Create a juki-like DataFrame from a list of record dicts.

    Each dict should have keys: household_code, address, birth_date,
    move_date (住定日), date_transfer (異動日), reason_transfer (異動事由).

    Addresses use obviously fake Japanese names so they cannot be confused
    with real data.
    """
    cols = [
        "household_code",
        "normalized_address",
        "birth_date",
        "move_date",
        "date_transfer",
        "reason_transfer",
    ]
    rows = []
    for r in records:
        rows.append({
            "household_code": r.get("household_code", "HH001"),
            "normalized_address": r.get("address", "テスト県ダミー市A町1丁目1番地"),
            "birth_date": r.get("birth_date", "19500101"),
            "move_date": r.get("move_date", "19900101"),
            "date_transfer": r.get("date_transfer", "19900101"),
            "reason_transfer": r.get("reason_transfer", "転入"),
        })
    df = pd.DataFrame(rows, columns=cols)
    return df


def _add_numeric_dates(df: pd.DataFrame) -> pd.DataFrame:
    """Add _date_num and _move_num columns for aggregation functions."""
    df = df.copy()
    df["_date_num"] = _to_num(df["date_transfer"])
    df["_move_num"] = _to_num(df["move_date"])
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# Tests for _to_num (date conversion)
# ═══════════════════════════════════════════════════════════════════════════════

class TestToNum:
    def test_yyyymmdd_string(self):
        s = pd.Series(["20240101"])
        result = _to_num(s)
        assert result.iloc[0] == 20240101.0

    def test_dash_format(self):
        s = pd.Series(["2024-01-15"])
        result = _to_num(s)
        assert result.iloc[0] == 20240115.0

    def test_slash_format(self):
        s = pd.Series(["2024/1/5"])
        result = _to_num(s)
        assert result.iloc[0] == 20240105.0

    def test_nan_returns_nan(self):
        s = pd.Series([np.nan])
        result = _to_num(s)
        assert pd.isna(result.iloc[0])


# ═══════════════════════════════════════════════════════════════════════════════
# Tests for filter_settled_before_cutoff
# ═══════════════════════════════════════════════════════════════════════════════

class TestFilterSettledBeforeCutoff:
    def test_basic_filter(self):
        """People with 住定日 after cutoff should be excluded."""
        df = _make_juki_df([
            {"move_date": "19900101", "reason_transfer": "転入"},   # before
            {"move_date": "20250101", "reason_transfer": "出生"},   # after
            {"move_date": "20240101", "reason_transfer": "転入"},   # on cutoff
        ])
        df = _add_numeric_dates(df)
        result = filter_settled_before_cutoff(df, 20240101)
        assert len(result) == 2  # first and third

    def test_no_cutoff(self):
        """With max cutoff, all records pass."""
        df = _make_juki_df([
            {"move_date": "20990101"},
            {"move_date": "19000101"},
        ])
        df = _add_numeric_dates(df)
        result = filter_settled_before_cutoff(df, 99_999_999)
        assert len(result) == 2

    def test_all_excluded(self):
        """All people with future settlement dates."""
        df = _make_juki_df([
            {"move_date": "20250601"},
            {"move_date": "20260101"},
        ])
        df = _add_numeric_dates(df)
        result = filter_settled_before_cutoff(df, 20240101)
        assert len(result) == 0

    def test_nan_move_date_excluded(self):
        """NaN move_date should be excluded (can't confirm settlement)."""
        df = _make_juki_df([
            {"move_date": "19900101"},
            {"move_date": None},
        ])
        # Manually set NaN for move_date
        df.loc[1, "move_date"] = np.nan
        df = _add_numeric_dates(df)
        result = filter_settled_before_cutoff(df, 20240101)
        assert len(result) == 1


# ═══════════════════════════════════════════════════════════════════════════════
# Tests for calculate_household_size — Task 2
# ═══════════════════════════════════════════════════════════════════════════════

class TestCalculateHouseholdSize:
    """Test the new household size calculation:
    世帯人数 = settled_count - departed_count (転出/死亡 before cutoff)
    """

    def test_users_example(self):
        """Exact example from the task specification.

        基準日 = 2024-01-01
        #1: 転入, 住定日=1944/1/1, 異動日=1944/1/1 → settled, not departed → COUNT
        #2: 転出, 住定日=1934/1/1, 異動日=1984/1/1 → settled, departed (転出) → DON'T COUNT
        #3: 出生, 住定日=2025/1/1, 異動日=2025/1/1 → NOT settled (future) → DON'T COUNT
        #4: 死亡, 住定日=1900/1/1, 異動日=2023/3/26 → settled, departed (死亡) → DON'T COUNT

        世帯人数 = 3 (settled: #1,#2,#4) - 2 (departed: #2,#4) = 1
        """
        records = [
            {
                "household_code": "HH_KAKU001",
                "address": "架空県ウソ市ニセ町1丁目1番地",
                "birth_date": "19440101",
                "move_date": "19440101",
                "date_transfer": "19440101",
                "reason_transfer": "転入",
            },
            {
                "household_code": "HH_KAKU001",
                "address": "架空県ウソ市ニセ町1丁目1番地",
                "birth_date": "19340101",
                "move_date": "19340101",
                "date_transfer": "19840101",
                "reason_transfer": "転出",
            },
            {
                "household_code": "HH_KAKU001",
                "address": "架空県ウソ市ニセ町1丁目1番地",
                "birth_date": "20250101",
                "move_date": "20250101",
                "date_transfer": "20250101",
                "reason_transfer": "出生",
            },
            {
                "household_code": "HH_KAKU001",
                "address": "架空県ウソ市ニセ町1丁目1番地",
                "birth_date": "19000101",
                "move_date": "19000101",
                "date_transfer": "20230326",
                "reason_transfer": "死亡",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)

        # Filter settled before cutoff
        cutoff = 20240101
        settled = filter_settled_before_cutoff(df, cutoff, "_move_num")
        assert len(settled) == 3  # #1, #2, #4 (not #3)

        # Calculate household size
        hh_size = calculate_household_size(settled, cutoff)
        addr = "架空県ウソ市ニセ町1丁目1番地"
        assert hh_size[addr] == 1

    def test_all_active_residents(self):
        """All people settled before cutoff, none departed."""
        records = [
            {
                "household_code": "HH_MABOROSHI",
                "address": "幻県フェイク市B町2丁目",
                "birth_date": "19800101",
                "move_date": "20100101",
                "date_transfer": "20100101",
                "reason_transfer": "転入",
            },
            {
                "household_code": "HH_MABOROSHI",
                "address": "幻県フェイク市B町2丁目",
                "birth_date": "19850601",
                "move_date": "20150301",
                "date_transfer": "20150301",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        hh_size = calculate_household_size(settled, 20240101)
        assert hh_size["幻県フェイク市B町2丁目"] == 2

    def test_all_departed(self):
        """All people departed (転出) before cutoff → size = 0."""
        records = [
            {
                "household_code": "HH_SORA",
                "address": "空想県デタラメ市C町3丁目",
                "birth_date": "19700101",
                "move_date": "19800101",
                "date_transfer": "20200101",
                "reason_transfer": "転出",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        hh_size = calculate_household_size(settled, 20240101)
        assert hh_size["空想県デタラメ市C町3丁目"] == 0

    def test_future_departure_not_subtracted(self):
        """Person with departure AFTER cutoff should still be counted."""
        records = [
            {
                "household_code": "HH_MIRAI",
                "address": "未来県アリエナイ市D町4丁目",
                "birth_date": "19900101",
                "move_date": "20100101",
                "date_transfer": "20250601",  # after cutoff
                "reason_transfer": "転出",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        hh_size = calculate_household_size(settled, 20240101)
        assert hh_size["未来県アリエナイ市D町4丁目"] == 1

    def test_death_after_cutoff_not_subtracted(self):
        """Person who dies AFTER cutoff is alive at cutoff → counted."""
        records = [
            {
                "household_code": "HH_KOKU",
                "address": "虚構県ムダ市E町5丁目",
                "birth_date": "19400101",
                "move_date": "19600101",
                "date_transfer": "20250101",  # dies after cutoff
                "reason_transfer": "死亡",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        hh_size = calculate_household_size(settled, 20240101)
        assert hh_size["虚構県ムダ市E町5丁目"] == 1

    def test_multiple_households_same_address(self):
        """Two households at the same address → sizes are summed."""
        records = [
            # Household A: 2 people
            {
                "household_code": "HH_A",
                "address": "テスト県合計市F町6丁目",
                "birth_date": "19700101",
                "move_date": "20000101",
                "date_transfer": "20000101",
                "reason_transfer": "転入",
            },
            {
                "household_code": "HH_A",
                "address": "テスト県合計市F町6丁目",
                "birth_date": "19750601",
                "move_date": "20000101",
                "date_transfer": "20000101",
                "reason_transfer": "転入",
            },
            # Household B: 1 person (1 departed)
            {
                "household_code": "HH_B",
                "address": "テスト県合計市F町6丁目",
                "birth_date": "19600101",
                "move_date": "19850101",
                "date_transfer": "20150601",
                "reason_transfer": "転出",
            },
            {
                "household_code": "HH_B",
                "address": "テスト県合計市F町6丁目",
                "birth_date": "19620301",
                "move_date": "19850101",
                "date_transfer": "19850101",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        hh_size = calculate_household_size(settled, 20240101)
        # HH_A: 2, HH_B: 2 settled - 1 departed = 1 → total = 3
        assert hh_size["テスト県合計市F町6丁目"] == 3

    def test_no_household_code(self):
        """When household_code is missing, group by address only."""
        records = [
            {
                "address": "テスト県ナシ市G町7丁目",
                "birth_date": "19800101",
                "move_date": "20100101",
                "date_transfer": "20100101",
                "reason_transfer": "転入",
            },
            {
                "address": "テスト県ナシ市G町7丁目",
                "birth_date": "19850101",
                "move_date": "20120101",
                "date_transfer": "20200101",
                "reason_transfer": "転出",
            },
        ]
        df = _make_juki_df(records)
        df["household_code"] = np.nan  # no household code
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        hh_size = calculate_household_size(settled, 20240101)
        assert hh_size["テスト県ナシ市G町7丁目"] == 1

    def test_empty_dataframe(self):
        """Empty input should return empty series."""
        df = _make_juki_df([])
        df = _add_numeric_dates(df)
        hh_size = calculate_household_size(df, 20240101)
        assert len(hh_size) == 0

    def test_clip_at_zero(self):
        """Household size should never go below 0.

        Edge case: if departed > settled due to data quality issues.
        """
        # This shouldn't normally happen, but the clip ensures safety
        records = [
            {
                "household_code": "HH_EDGE",
                "address": "テスト県ゼロ市H町8丁目",
                "birth_date": "19700101",
                "move_date": "19800101",
                "date_transfer": "20200101",
                "reason_transfer": "転出",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        hh_size = calculate_household_size(settled, 20240101)
        assert hh_size["テスト県ゼロ市H町8丁目"] == 0


# ═══════════════════════════════════════════════════════════════════════════════
# Tests for calculate_event_counts — Task 3
# ═══════════════════════════════════════════════════════════════════════════════

class TestCalculateEventCounts:
    """All event counts must exclude people with 住定日 > 基準日."""

    def test_basic_counts(self):
        """Count deaths, immigrants, outmigrants."""
        records = [
            {
                "address": "架空県カウント市I町9丁目",
                "move_date": "19500101",
                "date_transfer": "20200101",
                "reason_transfer": "死亡",
            },
            {
                "address": "架空県カウント市I町9丁目",
                "move_date": "20100101",
                "date_transfer": "20100101",
                "reason_transfer": "転入",
            },
            {
                "address": "架空県カウント市I町9丁目",
                "move_date": "19600101",
                "date_transfer": "20180101",
                "reason_transfer": "転出",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        counts = calculate_event_counts(settled, 20240101)
        addr = "架空県カウント市I町9丁目"
        assert counts.loc[addr, "num_deaths_juki_residence"] == 1
        assert counts.loc[addr, "num_inmigrants_juki_residence"] == 1
        assert counts.loc[addr, "num_outmigrants_relocations_juki_residence"] == 1

    def test_future_settlement_excluded_from_counts(self):
        """Person with 住定日 > cutoff should not be counted at all."""
        records = [
            {
                "address": "架空県フィルタ市J町10丁目",
                "move_date": "20250101",  # future settlement
                "date_transfer": "20250101",
                "reason_transfer": "転入",
            },
            {
                "address": "架空県フィルタ市J町10丁目",
                "move_date": "20100101",  # valid
                "date_transfer": "20100101",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        counts = calculate_event_counts(settled, 20240101)
        addr = "架空県フィルタ市J町10丁目"
        assert counts.loc[addr, "num_inmigrants_juki_residence"] == 1  # only the valid one

    def test_death_after_cutoff_not_counted(self):
        """Death with 異動日 > cutoff should not be counted as death."""
        records = [
            {
                "address": "架空県未来死亡市K町",
                "move_date": "19400101",
                "date_transfer": "20250601",  # future death
                "reason_transfer": "死亡",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        counts = calculate_event_counts(settled, 20240101)
        addr = "架空県未来死亡市K町"
        assert counts.loc[addr, "num_deaths_juki_residence"] == 0

    def test_outmigration_after_cutoff_not_counted(self):
        """Outmigration with 異動日 > cutoff should not be counted."""
        records = [
            {
                "address": "テスト県転出市L町",
                "move_date": "19900101",
                "date_transfer": "20250101",  # future departure
                "reason_transfer": "転出",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        counts = calculate_event_counts(settled, 20240101)
        addr = "テスト県転出市L町"
        assert counts.loc[addr, "num_outmigrants_relocations_juki_residence"] == 0

    def test_snapshot_format_tenkyou_not_outmigrant(self):
        """In snapshot format, 転居 = moved INTO this address, NOT outmigrant."""
        records = [
            {
                "address": "テスト県スナップ市M町",
                "move_date": "20100101",
                "date_transfer": "20100101",
                "reason_transfer": "転居",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        counts = calculate_event_counts(settled, 20240101)
        addr = "テスト県スナップ市M町"
        assert counts.loc[addr, "num_outmigrants_relocations_juki_residence"] == 0

    def test_tenkyou_is_not_outmigrant(self):
        """転居 is NOT counted as outmigrant (ADR-0016: snapshot only)."""
        records = [
            {
                "address": "テスト県履歴市N町",
                "move_date": "20100101",
                "date_transfer": "20200101",
                "reason_transfer": "転居",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        counts = calculate_event_counts(settled, 20240101)
        addr = "テスト県履歴市N町"
        assert counts.loc[addr, "num_outmigrants_relocations_juki_residence"] == 0

    def test_birth_counted_as_inmigrant(self):
        """出生 (birth) should be counted as immigration."""
        records = [
            {
                "address": "架空県出生市O町",
                "move_date": "20200101",
                "date_transfer": "20200101",
                "reason_transfer": "出生",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        counts = calculate_event_counts(settled, 20240101)
        addr = "架空県出生市O町"
        assert counts.loc[addr, "num_inmigrants_juki_residence"] == 1

    def test_cancellation_counted(self):
        """消除 (cancellation) should be counted with date filter."""
        records = [
            {
                "address": "テスト県消除市P町",
                "move_date": "19800101",
                "date_transfer": "20230101",
                "reason_transfer": "消除",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        counts = calculate_event_counts(settled, 20240101)
        addr = "テスト県消除市P町"
        assert counts.loc[addr, "num_cancellations_juki_residence"] == 1

    def test_empty_dataframe(self):
        """Empty input returns empty DataFrame with correct columns."""
        df = _make_juki_df([])
        df = _add_numeric_dates(df)
        counts = calculate_event_counts(df, 20240101)
        expected_cols = [
            "num_deaths_juki_residence",
            "num_inmigrants_juki_residence",
            "num_outmigrants_relocations_juki_residence",
            "num_cancellations_juki_residence",
        ]
        assert list(counts.columns) == expected_cols


# ═══════════════════════════════════════════════════════════════════════════════
# Tests for calculate_age_stats
# ═══════════════════════════════════════════════════════════════════════════════

class TestCalculateAgeStats:
    def test_basic_ages(self):
        """Calculate max age and age group counts."""
        records = [
            {
                "address": "テスト県年齢市Q町",
                "birth_date": "19500101",  # 74 years old in 2024
                "move_date": "19700101",
                "date_transfer": "19700101",
                "reason_transfer": "転入",
            },
            {
                "address": "テスト県年齢市Q町",
                "birth_date": "20150101",  # 9 years old in 2024
                "move_date": "20150101",
                "date_transfer": "20150101",
                "reason_transfer": "出生",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        age_stats = calculate_age_stats(df, 2024)
        addr = "テスト県年齢市Q町"
        assert age_stats.loc[addr, "max_age_juki_residence"] == 74
        assert age_stats.loc[addr, "over_65_count_juki_residence"] == 1
        assert age_stats.loc[addr, "under_15_count_juki_residence"] == 1

    def test_departed_excluded_from_age_stats(self):
        """Departed people should not be in age calculations.

        Use _get_active_residents first to filter out departed.
        """
        records = [
            {
                "address": "テスト県除外市R町",
                "birth_date": "19300101",  # 94 years old (departed)
                "move_date": "19500101",
                "date_transfer": "20200101",
                "reason_transfer": "死亡",
            },
            {
                "address": "テスト県除外市R町",
                "birth_date": "19800101",  # 44 years old (active)
                "move_date": "20000101",
                "date_transfer": "20000101",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        active = _get_active_residents(settled, 20240101)
        age_stats = calculate_age_stats(active, 2024)
        addr = "テスト県除外市R町"
        assert age_stats.loc[addr, "max_age_juki_residence"] == 44
        assert age_stats.loc[addr, "over_65_count_juki_residence"] == 0

    def test_impossible_ages_filtered(self):
        """Ages < 0 or > 120 should be excluded."""
        records = [
            {
                "address": "テスト県異常市S町",
                "birth_date": "18000101",  # 224 years old → impossible
                "move_date": "18500101",
                "date_transfer": "18500101",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        age_stats = calculate_age_stats(df, 2024)
        assert len(age_stats) == 0

    def test_empty_input(self):
        """Empty input returns empty DataFrame."""
        df = _make_juki_df([])
        df = _add_numeric_dates(df)
        age_stats = calculate_age_stats(df, 2024)
        assert len(age_stats) == 0


# ═══════════════════════════════════════════════════════════════════════════════
# Tests for _get_active_residents
# ═══════════════════════════════════════════════════════════════════════════════

class TestGetActiveResidents:
    def test_filters_departed(self):
        """People with 転出/死亡 before cutoff are filtered out."""
        records = [
            {
                "address": "テスト県アクティブ市T町",
                "move_date": "19800101",
                "date_transfer": "20200101",
                "reason_transfer": "転出",
            },
            {
                "address": "テスト県アクティブ市T町",
                "move_date": "19900101",
                "date_transfer": "19900101",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        active = _get_active_residents(settled, 20240101)
        assert len(active) == 1  # only the 転入 person

    def test_future_departure_stays_active(self):
        """Person departing after cutoff is still active at cutoff."""
        records = [
            {
                "address": "テスト県未来市U町",
                "move_date": "19900101",
                "date_transfer": "20250601",  # after cutoff
                "reason_transfer": "転出",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        active = _get_active_residents(settled, 20240101)
        assert len(active) == 1

    def test_non_departure_reasons_stay_active(self):
        """転入, 出生, 転居 are not departure reasons."""
        records = [
            {"address": "A町", "move_date": "20100101", "date_transfer": "20100101", "reason_transfer": "転入"},
            {"address": "A町", "move_date": "20120101", "date_transfer": "20120101", "reason_transfer": "出生"},
            {"address": "A町", "move_date": "20150101", "date_transfer": "20150101", "reason_transfer": "転居"},
            {"address": "A町", "move_date": "20180101", "date_transfer": "20180101", "reason_transfer": "個人番号記載"},
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        active = _get_active_residents(settled, 20240101)
        assert len(active) == 4  # all active


# ═══════════════════════════════════════════════════════════════════════════════
# Tests for aggregate_juki — full integration
# ═══════════════════════════════════════════════════════════════════════════════

class TestAggregateJuki:
    """Integration tests for the full aggregate_juki function."""

    def test_users_example_full_pipeline(self):
        """Full pipeline test with the user's calculation example.

        基準日 = 2024-01-01 → 世帯人数 = 1
        """
        records = [
            {
                "household_code": "HH_TEST001",
                "address": "架空県テスト市ニセ町1丁目1番地",
                "birth_date": "19440101",
                "move_date": "19440101",
                "date_transfer": "19440101",
                "reason_transfer": "転入",
            },
            {
                "household_code": "HH_TEST001",
                "address": "架空県テスト市ニセ町1丁目1番地",
                "birth_date": "19340101",
                "move_date": "19340101",
                "date_transfer": "19840101",
                "reason_transfer": "転出",
            },
            {
                "household_code": "HH_TEST001",
                "address": "架空県テスト市ニセ町1丁目1番地",
                "birth_date": "20250101",
                "move_date": "20250101",
                "date_transfer": "20250101",
                "reason_transfer": "出生",
            },
            {
                "household_code": "HH_TEST001",
                "address": "架空県テスト市ニセ町1丁目1番地",
                "birth_date": "19000101",
                "move_date": "19000101",
                "date_transfer": "20230326",
                "reason_transfer": "死亡",
            },
        ]
        df = _make_juki_df(records)
        # aggregate_juki expects normalized_address, which our factory provides
        standard_date = pd.Timestamp("2024-01-01")
        result = aggregate_juki(df, standard_date=standard_date)

        addr = "架空県テスト市ニセ町1丁目1番地"
        assert addr in result.index
        assert result.loc[addr, "household_size_juki_residence"] == 1
        assert result.loc[addr, "juki_residence_flag"] == 1
        assert result.loc[addr, "num_deaths_juki_residence"] == 1
        # Immigration: #1(転入) is counted (住定日 before cutoff)
        # #3(出生) has 住定日 2025 > cutoff → excluded
        assert result.loc[addr, "num_inmigrants_juki_residence"] == 1

    def test_no_num_householdsize_after_changes(self):
        """The old column num_householdsize_after_changes_juki_residence
        should NOT exist in the output."""
        records = [
            {
                "address": "テスト県確認市V町",
                "move_date": "20100101",
                "date_transfer": "20100101",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        result = aggregate_juki(df, standard_date=pd.Timestamp("2024-01-01"))
        assert "num_householdsize_after_changes_juki_residence" not in result.columns

    def test_snapshot_format(self):
        """Test with snapshot format data."""
        records = [
            {
                "household_code": "W001",
                "address": "テスト県スナップ市W町1番",
                "birth_date": "19600101",
                "move_date": "19800101",
                "date_transfer": "19800101",
                "reason_transfer": "転居",  # snapshot: moved INTO = valid
            },
            {
                "household_code": "W001",
                "address": "テスト県スナップ市W町1番",
                "birth_date": "19650601",
                "move_date": "19800101",
                "date_transfer": "19800101",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        result = aggregate_juki(
            df,
            standard_date=pd.Timestamp("2024-01-01"),
        )
        addr = "テスト県スナップ市W町1番"
        assert result.loc[addr, "household_size_juki_residence"] == 2

    def test_full_history_dedup(self):
        """No dedup: same person with multiple rows both counted (ADR-0016).

        snapshot形式のみ対応のためデデュプなし。同一人物の複数行がそのままカウントされる。
        """
        records = [
            {
                "household_code": "X001",
                "address": "テスト県履歴市X町",
                "birth_date": "19700101",
                "move_date": "19900101",
                "date_transfer": "19900101",
                "reason_transfer": "転入",
            },
            {
                "household_code": "X001",
                "address": "テスト県履歴市X町",
                "birth_date": "19700101",
                "move_date": "19900101",
                "date_transfer": "20200101",
                "reason_transfer": "転出",
            },
        ]
        df = _make_juki_df(records)
        result = aggregate_juki(
            df,
            standard_date=pd.Timestamp("2024-01-01"),
        )
        addr = "テスト県履歴市X町"
        # デデュプなし: 2行とも残る
        # 1行目: 転入（departedでない）
        # 2行目: 転出（departed）
        # household_size = 2 - 1 = 1
        assert result.loc[addr, "household_size_juki_residence"] == 1

    def test_multiple_addresses(self):
        """Aggregation should produce one row per address."""
        records = [
            {
                "household_code": "Y001",
                "address": "テスト県多住所市Y町1番",
                "birth_date": "19800101",
                "move_date": "20000101",
                "date_transfer": "20000101",
                "reason_transfer": "転入",
            },
            {
                "household_code": "Z001",
                "address": "テスト県多住所市Z町2番",
                "birth_date": "19850601",
                "move_date": "20050101",
                "date_transfer": "20050101",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        result = aggregate_juki(df, standard_date=pd.Timestamp("2024-01-01"))
        assert len(result) == 2
        assert "テスト県多住所市Y町1番" in result.index
        assert "テスト県多住所市Z町2番" in result.index

    def test_age_only_from_active_residents(self):
        """max_age should come from active residents, not departed ones."""
        records = [
            {
                "household_code": "AGE001",
                "address": "テスト県高齢市老町",
                "birth_date": "19300101",  # 94 years old
                "move_date": "19500101",
                "date_transfer": "20230101",
                "reason_transfer": "死亡",  # departed
            },
            {
                "household_code": "AGE001",
                "address": "テスト県高齢市老町",
                "birth_date": "19800101",  # 44 years old
                "move_date": "20000101",
                "date_transfer": "20000101",
                "reason_transfer": "転入",  # active
            },
        ]
        df = _make_juki_df(records)
        result = aggregate_juki(
            df,
            standard_date=pd.Timestamp("2024-01-01"),
        )
        addr = "テスト県高齢市老町"
        assert result.loc[addr, "max_age_juki_residence"] == 44
        assert result.loc[addr, "over_65_count_juki_residence"] == 0

    def test_residence_duration(self):
        """residence_duration should be from oldest move_date of active residents."""
        records = [
            {
                "household_code": "DUR001",
                "address": "テスト県期間市居町",
                "birth_date": "19500101",
                "move_date": "19800101",  # oldest move_date
                "date_transfer": "19800101",
                "reason_transfer": "転入",
            },
            {
                "household_code": "DUR001",
                "address": "テスト県期間市居町",
                "birth_date": "19800101",
                "move_date": "20100601",
                "date_transfer": "20100601",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        standard_date = pd.Timestamp("2024-01-01")
        result = aggregate_juki(df, standard_date=standard_date)
        addr = "テスト県期間市居町"
        # Oldest active move: 1980-01-01. Days to 2024-01-01 = 16071
        expected_days = (standard_date - pd.Timestamp("1980-01-01")).days
        assert result.loc[addr, "residence_duration_juki_residence"] == expected_days


# ═══════════════════════════════════════════════════════════════════════════════
# Tests for combined Task 1 + 2 + 3 scenarios
# ═══════════════════════════════════════════════════════════════════════════════

class TestCombinedScenarios:
    """Integration scenarios covering all three tasks together."""

    def test_mixed_household_with_reference_date(self):
        """Complex scenario: mixed events, reference date filtering, household grouping.

        Household at "テスト県総合市総合町":
        Person A: settled 2000, transferred in → active (size +1)
        Person B: settled 2005, died 2022    → departed (size -0, but death counted)
        Person C: settled 2025 (future)      → excluded from all counts
        Person D: settled 2010, transferred out 2020 → departed (size -0)
        Person E: settled 2015, transferred out 2025 (future departure) → still active (size +1)

        Expected:
          settled = A, B, D, E (4 people)
          departed = B (death 2022), D (転出 2020) = 2
          household_size = 4 - 2 = 2
          deaths = 1 (B)
          inmigrants = A(転入) + E(転入) = 2  (B=死亡, D=転出 are not immigrants)
          outmigrants = D(転出 2020) = 1 (E's 転出 is after cutoff)
        """
        cutoff_date = pd.Timestamp("2024-01-01")
        records = [
            {  # Person A
                "household_code": "SOGO001",
                "address": "テスト県総合市総合町",
                "birth_date": "19700101",
                "move_date": "20000101",
                "date_transfer": "20000101",
                "reason_transfer": "転入",
            },
            {  # Person B
                "household_code": "SOGO001",
                "address": "テスト県総合市総合町",
                "birth_date": "19400101",
                "move_date": "20050101",
                "date_transfer": "20220601",
                "reason_transfer": "死亡",
            },
            {  # Person C — future settlement
                "household_code": "SOGO001",
                "address": "テスト県総合市総合町",
                "birth_date": "20250101",
                "move_date": "20250101",
                "date_transfer": "20250101",
                "reason_transfer": "出生",
            },
            {  # Person D
                "household_code": "SOGO001",
                "address": "テスト県総合市総合町",
                "birth_date": "19600101",
                "move_date": "20100101",
                "date_transfer": "20200101",
                "reason_transfer": "転出",
            },
            {  # Person E — future departure
                "household_code": "SOGO001",
                "address": "テスト県総合市総合町",
                "birth_date": "19900101",
                "move_date": "20150101",
                "date_transfer": "20250101",
                "reason_transfer": "転入",
            },
        ]
        df = _make_juki_df(records)
        result = aggregate_juki(df, standard_date=cutoff_date)

        addr = "テスト県総合市総合町"
        assert result.loc[addr, "household_size_juki_residence"] == 2
        assert result.loc[addr, "num_deaths_juki_residence"] == 1
        assert result.loc[addr, "num_inmigrants_juki_residence"] == 2
        assert result.loc[addr, "num_outmigrants_relocations_juki_residence"] == 1

    def test_two_households_at_same_address(self):
        """Two different household_codes at the same address.

        1 住所 1 世帯に当たらないため、住所ごと集計対象から外れる。
        """
        cutoff_date = pd.Timestamp("2024-01-01")
        records = [
            # HH_A
            {"household_code": "HH_A", "address": "テスト県二世帯市共住町",
             "birth_date": "19700101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
            {"household_code": "HH_A", "address": "テスト県二世帯市共住町",
             "birth_date": "19750601", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
            # HH_B
            {"household_code": "HH_B", "address": "テスト県二世帯市共住町",
             "birth_date": "19500101", "move_date": "19800101",
             "date_transfer": "20220101", "reason_transfer": "死亡"},
            {"household_code": "HH_B", "address": "テスト県二世帯市共住町",
             "birth_date": "19550601", "move_date": "19800101",
             "date_transfer": "19800101", "reason_transfer": "転入"},
            {"household_code": "HH_B", "address": "テスト県二世帯市共住町",
             "birth_date": "19800301", "move_date": "20050101",
             "date_transfer": "20050101", "reason_transfer": "転入"},
        ]
        df = _make_juki_df(records)
        result = aggregate_juki(df, standard_date=cutoff_date)

        assert "テスト県二世帯市共住町" not in result.index
        assert len(result) == 0

    def test_only_future_residents(self):
        """All people have 住定日 > cutoff → address should NOT appear
        in the aggregated output (no settled residents)."""
        records = [
            {
                "household_code": "FUT001",
                "address": "テスト県未来市全未来町",
                "birth_date": "20250101",
                "move_date": "20250101",
                "date_transfer": "20250101",
                "reason_transfer": "出生",
            },
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        # No one settled before cutoff → empty
        assert len(settled) == 0
        hh_size = calculate_household_size(settled, 20240101)
        assert len(hh_size) == 0


# ═══════════════════════════════════════════════════════════════════════════════
# Tests for filter_single_household_addresses
# ═══════════════════════════════════════════════════════════════════════════════

class TestFilterSingleHouseholdAddresses:
    """集計対象を 1 住所 1 世帯のレコードに限定する。"""

    def test_single_household_kept(self):
        """1 住所 1 世帯なら、複数人でも残る。"""
        df = _make_juki_df([
            {"household_code": "HH_ONE", "address": "テスト県単世帯市A町"},
            {"household_code": "HH_ONE", "address": "テスト県単世帯市A町"},
        ])
        assert len(filter_single_household_addresses(df)) == 2

    def test_multiple_codes_at_one_address_excluded(self):
        """同一住所に世帯番号が 2 つあると、その住所のレコードが全て外れる。"""
        df = _make_juki_df([
            {"household_code": "HH_X", "address": "テスト県混在市B町"},
            {"household_code": "HH_Y", "address": "テスト県混在市B町"},
            {"household_code": "HH_Z", "address": "テスト県単独市C町"},
        ])
        result = filter_single_household_addresses(df)
        assert list(result["normalized_address"]) == ["テスト県単独市C町"]

    def test_one_code_at_multiple_addresses_excluded(self):
        """同一世帯番号が 2 住所に現れると、その世帯のレコードが全て外れる。"""
        df = _make_juki_df([
            {"household_code": "HH_MOVE", "address": "テスト県転居市D町"},
            {"household_code": "HH_MOVE", "address": "テスト県転居市E町"},
            {"household_code": "HH_STAY", "address": "テスト県定住市F町"},
        ])
        result = filter_single_household_addresses(df)
        assert list(result["normalized_address"]) == ["テスト県定住市F町"]

    def test_null_code_row_at_excluded_address_dropped(self):
        """対象外の住所に世帯番号なしの行が混ざっていても、住所ごと外れる。"""
        df = _make_juki_df([
            {"household_code": "HH_P", "address": "テスト県欠損市G町"},
            {"household_code": "HH_Q", "address": "テスト県欠損市G町"},
            {"household_code": "HH_NULL", "address": "テスト県欠損市G町"},
            {"household_code": "HH_R", "address": "テスト県欠損市H町"},
        ])
        df.loc[2, "household_code"] = np.nan
        result = filter_single_household_addresses(df)
        assert list(result["normalized_address"]) == ["テスト県欠損市H町"]

    def test_blank_address_not_counted_as_another_address(self):
        """住所が入力されていない行は、住所の種類として数えない。

        normalize_series は空欄・None・NaN をそれぞれ別文字列にするため、
        これを住所として数えると同一世帯が複数住所にまたがる扱いになる。
        """
        df = _make_juki_df([
            {"household_code": "HH_B1", "address": "テスト県空欄市R町"},
            {"household_code": "HH_B1", "address": "テスト県空欄市R町"},
            {"household_code": "HH_B1", "address": ""},
            {"household_code": "HH_B1", "address": "None"},
            {"household_code": "HH_B1", "address": "nan"},
        ])
        result = filter_single_household_addresses(df)
        assert len(result) == 5

    def test_whitespace_only_difference_is_same_household(self):
        """前後の空白だけが違う世帯番号は、同一世帯として扱う。"""
        df = _make_juki_df([
            {"household_code": "H001", "address": "テスト県空白市W町"},
            {"household_code": "H001 ", "address": "テスト県空白市W町"},
            {"household_code": " H001", "address": "テスト県空白市W町"},
        ])
        assert len(filter_single_household_addresses(df)) == 3

    def test_blank_code_not_treated_as_a_household(self):
        """空白だけの世帯番号は未入力として扱い、1つの世帯に束ねない。"""
        df = _make_juki_df([
            {"household_code": " ", "address": "テスト県空番市X町"},
            {"household_code": "  ", "address": "テスト県空番市Y町"},
            {"household_code": "H9", "address": "テスト県空番市Z町"},
        ])
        assert len(filter_single_household_addresses(df)) == 3

    def test_missing_address_column_keeps_everything(self):
        """住所カラムが無い入力でも例外にせず全件残す。"""
        df = _make_juki_df([
            {"household_code": "H1", "address": "テスト県無住所市A町"},
        ]).drop(columns=["normalized_address"])
        assert len(filter_single_household_addresses(df)) == 1

    def test_judged_df_limits_the_population(self):
        """judged_df に含まれないレコードは世帯数として数えない。"""
        df = _make_juki_df([
            {"household_code": "HH_J1", "address": "テスト県母集団市S町"},
            {"household_code": "HH_J2", "address": "テスト県母集団市S町"},
        ])
        judged = df.iloc[[0]]
        assert len(filter_single_household_addresses(df, judged_df=judged)) == 2
        assert len(filter_single_household_addresses(df)) == 0

    def test_all_codes_null_keeps_everything(self):
        """世帯番号が全て欠損なら重複を判定できないため、全件残す。"""
        df = _make_juki_df([
            {"address": "テスト県無番市I町"},
            {"address": "テスト県無番市I町"},
        ])
        df["household_code"] = np.nan
        assert len(filter_single_household_addresses(df)) == 2

    def test_missing_code_column_keeps_everything(self):
        """世帯番号カラム自体が無い入力でも例外にせず全件残す。"""
        df = _make_juki_df([
            {"address": "テスト県無列市J町"},
            {"address": "テスト県無列市J町"},
        ]).drop(columns=["household_code"])
        assert len(filter_single_household_addresses(df)) == 2


class TestAggregateJukiSingleHouseholdLimit:
    """aggregate_juki が 1 住所 1 世帯の限定を適用する。"""

    STD = pd.Timestamp("2024-01-01")

    def test_mixed_address_excluded_others_kept(self):
        """世帯番号が混在する住所だけが消え、他の住所は従来どおり集計される。"""
        records = [
            {"household_code": "HH_M1", "address": "テスト県混在市K町",
             "birth_date": "19500101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
            {"household_code": "HH_M2", "address": "テスト県混在市K町",
             "birth_date": "19600101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
            {"household_code": "HH_S1", "address": "テスト県健全市L町",
             "birth_date": "19700101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
            {"household_code": "HH_S1", "address": "テスト県健全市L町",
             "birth_date": "19750101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
        ]
        result = aggregate_juki(_make_juki_df(records), standard_date=self.STD)

        assert "テスト県混在市K町" not in result.index
        assert result.loc["テスト県健全市L町", "household_size_juki_residence"] == 2

    def test_relocated_household_excluded_from_both_addresses(self):
        """同一世帯番号が 2 住所にあると、両方の住所が集計に出ない。"""
        records = [
            {"household_code": "HH_MV", "address": "テスト県転居市M町",
             "birth_date": "19500101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
            {"household_code": "HH_MV", "address": "テスト県転居市N町",
             "birth_date": "19500101", "move_date": "20100101",
             "date_transfer": "20100101", "reason_transfer": "転入"},
            {"household_code": "HH_FX", "address": "テスト県定住市O町",
             "birth_date": "19700101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
        ]
        result = aggregate_juki(_make_juki_df(records), standard_date=self.STD)

        assert "テスト県転居市M町" not in result.index
        assert "テスト県転居市N町" not in result.index
        assert result.loc["テスト県定住市O町", "household_size_juki_residence"] == 1

    def test_all_records_excluded_returns_empty(self):
        """全レコードが対象外でも例外にせず空の集計結果を返す。"""
        records = [
            {"household_code": "HH_E1", "address": "テスト県全除外市P町",
             "birth_date": "19500101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
            {"household_code": "HH_E2", "address": "テスト県全除外市P町",
             "birth_date": "19600101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
        ]
        result = aggregate_juki(_make_juki_df(records), standard_date=self.STD)
        assert len(result) == 0
        # match_juki_to_water が reset_index() で住所列を復元できる必要がある
        assert result.index.name == "normalized_address"

    def test_future_settlement_not_counted_as_second_household(self):
        """基準日より後に住定する世帯は、基準日時点の世帯数に数えない。"""
        records = [
            {"household_code": "HH_NOW", "address": "テスト県未来市T町",
             "birth_date": "19700101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
            {"household_code": "HH_NOW", "address": "テスト県未来市T町",
             "birth_date": "19750101", "move_date": "20000101",
             "date_transfer": "20000101", "reason_transfer": "転入"},
            {"household_code": "HH_LATER", "address": "テスト県未来市T町",
             "birth_date": "19900101", "move_date": "20300101",
             "date_transfer": "20300101", "reason_transfer": "転入"},
        ]
        result = aggregate_juki(_make_juki_df(records), standard_date=self.STD)

        assert result.loc["テスト県未来市T町", "household_size_juki_residence"] == 2

    def test_departed_household_not_counted_as_second_household(self):
        """基準日より前に転出した世帯は、基準日時点の世帯数に数えない。"""
        records = [
            {"household_code": "HH_GONE", "address": "テスト県入替市U町",
             "birth_date": "19500101", "move_date": "19900101",
             "date_transfer": "20100101", "reason_transfer": "転出"},
            {"household_code": "HH_HERE", "address": "テスト県入替市U町",
             "birth_date": "19800101", "move_date": "20150101",
             "date_transfer": "20150101", "reason_transfer": "転入"},
        ]
        result = aggregate_juki(_make_juki_df(records), standard_date=self.STD)

        assert "テスト県入替市U町" in result.index
        assert result.loc["テスト県入替市U町", "household_size_juki_residence"] == 1

    def test_two_households_both_present_still_excluded(self):
        """基準日時点で 2 世帯とも在住していれば、従来どおり対象外になる。"""
        records = [
            {"household_code": "HH_P1", "address": "テスト県同居市V町",
             "birth_date": "19500101", "move_date": "19900101",
             "date_transfer": "19900101", "reason_transfer": "転入"},
            {"household_code": "HH_P2", "address": "テスト県同居市V町",
             "birth_date": "19800101", "move_date": "20150101",
             "date_transfer": "20150101", "reason_transfer": "転入"},
        ]
        result = aggregate_juki(_make_juki_df(records), standard_date=self.STD)

        assert "テスト県同居市V町" not in result.index

    def test_without_household_code_behaves_as_before(self):
        """世帯番号が無い入力では限定が効かず、住所単位の集計が従来どおり動く。"""
        records = [
            {"address": "テスト県無番市Q町", "birth_date": "19500101",
             "move_date": "20000101", "date_transfer": "20000101",
             "reason_transfer": "転入"},
            {"address": "テスト県無番市Q町", "birth_date": "19600101",
             "move_date": "20000101", "date_transfer": "20000101",
             "reason_transfer": "転入"},
        ]
        df = _make_juki_df(records)
        df["household_code"] = np.nan
        result = aggregate_juki(df, standard_date=self.STD)
        assert result.loc["テスト県無番市Q町", "household_size_juki_residence"] == 2
