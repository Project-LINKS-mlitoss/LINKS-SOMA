"""update_predicted_probability_change_rates の統合テスト

DB からの読み込み → 変化率算出 → data_set_detail_buildings への UPDATE までを
実 SQLite で検証する。単体テスト(compute)で守れない SQL 列名・params 順・
NaN→NULL 変換・data_set_result_id 絞り込みの回帰を防ぐ。
"""

import pytest

import utils
from db_helpers import insert_row, query_all


def _insert_building(db_path, result_id, address, date, probability):
    return insert_row(
        db_path,
        "data_set_detail_buildings",
        data_set_result_id=result_id,
        normalized_address=address,
        reference_date=date,
        predicted_probability=probability,
    )


def _rows_by_id(db_path):
    return {r["id"]: r for r in query_all(db_path, "data_set_detail_buildings")}


class TestUpdatePersistsChangeRates:
    """SUT: 複数年度の結果で建物2行に相対変化率が書き込まれる。"""

    def test_2年度で変化率がUPDATEされる(self, test_db):
        result_id = 1
        oldest_id = _insert_building(test_db, result_id, "X", "2020-04-01", 0.20)
        newer_id = _insert_building(test_db, result_id, "X", "2021-04-01", 0.30)

        utils.connect_sqllite(test_db)
        updated = utils.update_predicted_probability_change_rates(result_id)

        rows = _rows_by_id(test_db)
        # 最古年度(2020): from_oldest=0, from_previous=NULL
        assert rows[oldest_id][
            "predicted_probability_change_rate_from_oldest"
        ] == 0.0
        assert (
            rows[oldest_id]["predicted_probability_change_rate_from_previous"]
            is None
        )
        # 翌年度(2021): (0.30-0.20)/0.20 = 0.5
        assert rows[newer_id][
            "predicted_probability_change_rate_from_oldest"
        ] == pytest.approx(0.5)
        assert rows[newer_id][
            "predicted_probability_change_rate_from_previous"
        ] == pytest.approx(0.5)
        # 更新行数は from_oldest=0 の最古行も含む(値が非NULLのため)
        assert updated == 2


class TestSingleYearLeavesNull:
    """SUT: 単一年度の結果では両列 NULL のまま(仕様: 単一年度は対象外)。"""

    def test_単一年度は書き込まない(self, test_db):
        result_id = 1
        a_id = _insert_building(test_db, result_id, "X", "2020-04-01", 0.20)
        b_id = _insert_building(test_db, result_id, "Y", "2020-04-01", 0.50)

        utils.connect_sqllite(test_db)
        updated = utils.update_predicted_probability_change_rates(result_id)

        rows = _rows_by_id(test_db)
        for row_id in (a_id, b_id):
            assert (
                rows[row_id]["predicted_probability_change_rate_from_oldest"]
                is None
            )
            assert (
                rows[row_id]["predicted_probability_change_rate_from_previous"]
                is None
            )
        assert updated == 0


class TestOnlyTargetResultUpdated:
    """SUT: 指定 data_set_result_id 以外の建物は更新しない。"""

    def test_別resultは変化率を持たない(self, test_db):
        target = 1
        other = 2
        _insert_building(test_db, target, "X", "2020-04-01", 0.20)
        _insert_building(test_db, target, "X", "2021-04-01", 0.30)
        other_id = _insert_building(test_db, other, "X", "2020-04-01", 0.20)
        other_id2 = _insert_building(test_db, other, "X", "2021-04-01", 0.30)

        utils.connect_sqllite(test_db)
        utils.update_predicted_probability_change_rates(target)

        rows = _rows_by_id(test_db)
        for row_id in (other_id, other_id2):
            assert (
                rows[row_id]["predicted_probability_change_rate_from_oldest"]
                is None
            )
            assert (
                rows[row_id]["predicted_probability_change_rate_from_previous"]
                is None
            )
