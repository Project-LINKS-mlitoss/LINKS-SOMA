"""LOCO-CV（ml/experiments/loco.py）の fold 構成と集約。

学習を伴わない部分だけを対象にする。fold の切り方と都市平均の取り方は都市横断の結論を
直接左右するため、値が変わったことに気付けるようにする。
"""

import numpy as np
import pandas as pd
import pytest

from loco import (
    MODE_IN_CITY,
    MODE_LOCO,
    _matrix,
    _mean_over_cities,
    loco_measure_variants,
    make_folds,
)


class TestMakeFolds:
    """fold は都市。都市数がそのまま fold 数になる。"""

    def test_都市数だけfoldを作る(self):
        assert len(make_folds(["A", "B", "C"])) == 3

    def test_テスト都市は学習側に入らない(self):
        for test_city, train_cities in make_folds(["A", "B", "C"]):
            assert test_city not in train_cities

    def test_学習側は残りの全都市(self):
        assert make_folds(["A", "B", "C"])[0] == ("A", ["B", "C"])

    @pytest.mark.parametrize("cities", [[], ["A"]])
    def test_1都市以下はfoldを作れない(self, cities):
        assert make_folds(cities) == []


class TestMatrix:
    """都市によって持たない列があるため、列を feats に揃えてから学習する。"""

    def test_列順をfeatsに固定する(self):
        df = pd.DataFrame({"b": [2.0], "a": [1.0]})
        assert _matrix(df, ["a", "b"]).tolist() == [[1.0, 2.0]]

    def test_持たない列はNaNで補う(self):
        df = pd.DataFrame({"a": [1.0]})
        assert np.isnan(_matrix(df, ["a", "touki_missing"])[0][1])

    def test_featsに無い列は落とす(self):
        df = pd.DataFrame({"a": [1.0], "extra": [9.0]})
        assert _matrix(df, ["a"]).shape == (1, 1)


class TestMeanOverCities:
    """都市平均は macro（行数で重み付けしない）。"""

    def test_行数の多い都市に引っ張られない(self):
        per_city = {
            "大": {"at_k": {100: {"precision": 0.0, "lift": 0.0, "recall": 0.0}}},
            "小": {"at_k": {100: {"precision": 1.0, "lift": 4.0, "recall": 0.5}}},
        }
        assert _mean_over_cities(per_city, [100])[100]["precision"] == 0.5

    def test_precisionとliftとrecallを返す(self):
        per_city = {"A": {"at_k": {100: {"precision": 0.2, "lift": 3.0, "recall": 0.1}}}}
        assert _mean_over_cities(per_city, [100])[100] == {
            "precision": 0.2,
            "lift": 3.0,
            "recall": 0.1,
        }


class TestLocoMeasureVariants:
    """条件の比較は都市間の差で判定するため、2都市以上を要求する。"""

    def test_1都市では比較できない(self):
        with pytest.raises(ValueError):
            loco_measure_variants({"下関市": pd.DataFrame()}, ["a"], {"x": {}})


class TestModeLabels:
    """mode は都市横断の結果かどうかを読み手に伝えるラベル。"""

    def test_2つのmodeは区別される(self):
        assert MODE_LOCO != MODE_IN_CITY
