"""検証ラボの判定計算（ml/experiments/evaluation.py）の純粋関数。

学習を伴わない部分だけを対象にする。判定下限とパラメータ解決は検証の結論を直接左右する
ため、値が変わったことに気付けるようにする。
"""

import math

import pytest

from evaluation import (
    DEFAULT_LGB_PARAMS,
    SPLIT_SEED_BASE,
    detection_floor,
    resolve_params,
    split_seeds,
)


class TestSplitSeeds:
    """分割 seed の生成。"""

    def test_連番を要求本数だけ返す(self):
        assert split_seeds(5) == [SPLIT_SEED_BASE + i for i in range(5)]

    def test_本数を増やしても切り詰められない(self):
        assert len(split_seeds(10)) == 10

    @pytest.mark.parametrize("n", [1, 0, -1])
    def test_ばらつきを測れない本数は拒否する(self, n):
        with pytest.raises(ValueError):
            split_seeds(n)


class TestDetectionFloor:
    """「効いた」と言える平均差の下限。"""

    def test_t分布の係数を使う(self):
        # n=5 の両側95%点は 2.776。標準偏差1・5分割なら 2.776/√5。
        assert detection_floor(1.0, 5) == pytest.approx(2.7764 / math.sqrt(5), rel=1e-3)

    def test_標準偏差2倍の近似より大きい(self):
        # 大標本向けの近似（係数2）は小標本で下限を小さく見積もる。
        assert detection_floor(1.0, 5) > 2 * 1.0 / math.sqrt(5)

    def test_分割を増やすと下限が下がる(self):
        assert detection_floor(1.0, 20) < detection_floor(1.0, 5)

    def test_ばらつきが0なら下限も0(self):
        assert detection_floor(0.0, 5) == 0.0

    @pytest.mark.parametrize("n", [1, 0])
    def test_ばらつきを測れない本数は拒否する(self, n):
        with pytest.raises(ValueError):
            detection_floor(1.0, n)


class TestResolveParams:
    """LightGBM パラメータの解決。"""

    def test_Noneは既定パラメータそのまま(self):
        assert resolve_params(None) == dict(DEFAULT_LGB_PARAMS)

    def test_差分は既定に重ねる(self):
        assert resolve_params({"num_leaves": 15})["num_leaves"] == 15

    def test_差分を渡しても再現性の設定が残る(self):
        # 置き換えにすると random_state が失われ、結果が再現できなくなる。
        resolved = resolve_params({"num_leaves": 15})
        assert resolved["random_state"] == DEFAULT_LGB_PARAMS["random_state"]
        assert resolved["verbose"] == DEFAULT_LGB_PARAMS["verbose"]

    def test_既定パラメータを書き換えない(self):
        before = dict(DEFAULT_LGB_PARAMS)
        resolve_params({"num_leaves": 15})
        assert DEFAULT_LGB_PARAMS == before
