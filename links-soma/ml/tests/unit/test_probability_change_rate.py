"""空き家推定確率の年度間変化率(compute_probability_change_rates)の単体テスト。

相対変化率 (p - p_基準) / p_基準 を、最古年度基準・前年度基準の2種類で算出する。
各テストは入力の predicted_probability から期待値を数式でトレースできるよう構成する。
"""

import math

import pandas as pd
import pytest

from probability_change_rate import (
    COLUMN_FROM_OLDEST,
    COLUMN_FROM_PREVIOUS,
    compute_probability_change_rates,
)


def _rates_by_id(rows):
    """行リストを算出し id をインデックスにした結果を返すヘルパ。"""
    result = compute_probability_change_rates(pd.DataFrame(rows))
    return result.set_index("id")


def _row(row_id, address, date, probability):
    return {
        "id": row_id,
        "normalized_address": address,
        "reference_date": date,
        "predicted_probability": probability,
    }


class TestSingleYearExcluded:
    """reference_date が1種類のみの結果は対象外(全行 NaN)。仕様「単一年度は対象外」。"""

    def test_単一年度は両列NaN(self):
        rates = _rates_by_id(
            [
                _row(1, "X", "2020-04-01", 0.20),
                _row(2, "Y", "2020-04-01", 0.50),
            ]
        )
        for row_id in (1, 2):
            assert math.isnan(rates.loc[row_id, COLUMN_FROM_OLDEST])
            assert math.isnan(rates.loc[row_id, COLUMN_FROM_PREVIOUS])


class TestRelativeChangeTwoYears:
    """2年度: 最古年度は基準(from_oldest=0)、翌年度は相対変化率。"""

    def test_2年度の変化率(self):
        rates = _rates_by_id(
            [
                _row(1, "X", "2020-04-01", 0.20),
                _row(2, "X", "2021-04-01", 0.30),
            ]
        )
        # 最古年度(2020): 自身が基準
        assert rates.loc[1, COLUMN_FROM_OLDEST] == 0.0
        assert math.isnan(rates.loc[1, COLUMN_FROM_PREVIOUS])
        # 翌年度(2021): (0.30-0.20)/0.20 = 0.5
        assert rates.loc[2, COLUMN_FROM_OLDEST] == pytest.approx(0.5)
        assert rates.loc[2, COLUMN_FROM_PREVIOUS] == pytest.approx(0.5)


class TestRelativeChangeThreeYears:
    """3年度: from_oldest は常に最古基準、from_previous は直前年度基準。"""

    def test_3年度の変化率(self):
        rates = _rates_by_id(
            [
                _row(1, "X", "2020-04-01", 0.20),
                _row(2, "X", "2021-04-01", 0.30),
                _row(3, "X", "2022-04-01", 0.24),
            ]
        )
        # from_oldest: 0, (0.30-0.20)/0.20=0.5, (0.24-0.20)/0.20=0.2
        assert rates.loc[1, COLUMN_FROM_OLDEST] == 0.0
        assert rates.loc[2, COLUMN_FROM_OLDEST] == pytest.approx(0.5)
        assert rates.loc[3, COLUMN_FROM_OLDEST] == pytest.approx(0.2)
        # from_previous: NaN, 0.5, (0.24-0.30)/0.30=-0.2
        assert math.isnan(rates.loc[1, COLUMN_FROM_PREVIOUS])
        assert rates.loc[2, COLUMN_FROM_PREVIOUS] == pytest.approx(0.5)
        assert rates.loc[3, COLUMN_FROM_PREVIOUS] == pytest.approx(-0.2)


class TestZeroBaseline:
    """基準値が0の行は0除算のため NaN。"""

    def test_最古年度が0なら全行NaN(self):
        rates = _rates_by_id(
            [
                _row(1, "X", "2020-04-01", 0.0),
                _row(2, "X", "2021-04-01", 0.30),
            ]
        )
        # p_最古=0 なので from_oldest は両行 NaN
        assert math.isnan(rates.loc[1, COLUMN_FROM_OLDEST])
        assert math.isnan(rates.loc[2, COLUMN_FROM_OLDEST])
        # 2021 の前年度=0 なので from_previous も NaN
        assert math.isnan(rates.loc[2, COLUMN_FROM_PREVIOUS])

    def test_前年度0でも最古非0なら_from_oldestは算出(self):
        rates = _rates_by_id(
            [
                _row(1, "X", "2020-04-01", 0.20),
                _row(2, "X", "2021-04-01", 0.0),
                _row(3, "X", "2022-04-01", 0.10),
            ]
        )
        # from_oldest(基準=0.20): 0, (0-0.20)/0.20=-1.0, (0.10-0.20)/0.20=-0.5
        assert rates.loc[1, COLUMN_FROM_OLDEST] == 0.0
        assert rates.loc[2, COLUMN_FROM_OLDEST] == pytest.approx(-1.0)
        assert rates.loc[3, COLUMN_FROM_OLDEST] == pytest.approx(-0.5)
        # from_previous: NaN, (0-0.20)/0.20=-1.0, 前年度=0 なので NaN
        assert math.isnan(rates.loc[1, COLUMN_FROM_PREVIOUS])
        assert rates.loc[2, COLUMN_FROM_PREVIOUS] == pytest.approx(-1.0)
        assert math.isnan(rates.loc[3, COLUMN_FROM_PREVIOUS])


class TestSingleObservationBuilding:
    """複数年度の結果内でも、観測が1回だけの建物は比較対象がなく NaN。"""

    def test_単一観測の建物は両列NaN(self):
        rates = _rates_by_id(
            [
                _row(1, "X", "2020-04-01", 0.20),
                _row(2, "X", "2021-04-01", 0.30),
                _row(3, "Y", "2020-04-01", 0.40),  # Y は2020のみ
            ]
        )
        assert math.isnan(rates.loc[3, COLUMN_FROM_OLDEST])
        assert math.isnan(rates.loc[3, COLUMN_FROM_PREVIOUS])
        # X は算出される(退行防止)
        assert rates.loc[2, COLUMN_FROM_OLDEST] == pytest.approx(0.5)


class TestMissingProbability:
    """predicted_probability が欠損の行・基準は NaN。"""

    def test_最古年度が欠損なら全行NaN(self):
        rates = _rates_by_id(
            [
                _row(1, "X", "2020-04-01", None),
                _row(2, "X", "2021-04-01", 0.30),
            ]
        )
        assert math.isnan(rates.loc[1, COLUMN_FROM_OLDEST])
        assert math.isnan(rates.loc[2, COLUMN_FROM_OLDEST])
        assert math.isnan(rates.loc[2, COLUMN_FROM_PREVIOUS])


class TestBuildingsAreIndependent:
    """建物ごとに独立して算出され、他建物の値が混入しない。"""

    def test_2建物が独立に算出される(self):
        rates = _rates_by_id(
            [
                _row(1, "X", "2020-04-01", 0.20),
                _row(2, "X", "2021-04-01", 0.40),
                _row(3, "Y", "2020-04-01", 0.50),
                _row(4, "Y", "2021-04-01", 0.25),
            ]
        )
        # X 2021: (0.40-0.20)/0.20 = 1.0
        assert rates.loc[2, COLUMN_FROM_OLDEST] == pytest.approx(1.0)
        # Y 2021: (0.25-0.50)/0.50 = -0.5
        assert rates.loc[4, COLUMN_FROM_OLDEST] == pytest.approx(-0.5)


class TestUnsortedInput:
    """入力行が年度昇順でなくても reference_date で並べ替えて基準を決める。"""

    def test_入力が降順でも最古年度が基準(self):
        rates = _rates_by_id(
            [
                _row(1, "X", "2021-04-01", 0.30),  # 新しい年度を先に
                _row(2, "X", "2020-04-01", 0.20),  # 古い年度を後に
            ]
        )
        # 最古=2020(id=2, p=0.20) が基準
        assert rates.loc[2, COLUMN_FROM_OLDEST] == 0.0
        assert rates.loc[1, COLUMN_FROM_OLDEST] == pytest.approx(0.5)
        assert rates.loc[1, COLUMN_FROM_PREVIOUS] == pytest.approx(0.5)
