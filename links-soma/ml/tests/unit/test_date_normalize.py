"""正準な日付正規化（FR004-007）の単体テスト。

網羅表が全日付列に規定する受理集合（8桁/区切り/年月日/和暦）を YYYYMMDD float に
正規化できること、いずれにも当てはまらない値は NaN になることを固定する。
"""

import math

import pandas as pd

from preprocessing.date_normalize import normalize_date_series


def _v(value):
    """単一値を正規化して返すヘルパ。"""
    return normalize_date_series(pd.Series([value])).iloc[0]


class TestAcceptedFormats:
    """網羅表 DATE_PATTERNS の各形式が同じ YYYYMMDD へ正規化される。"""

    def test_8桁(self):
        assert _v("20240131") == 20240131.0

    def test_float読みの8桁(self):
        # 欠損混在で pandas が float 化した "20240131.0" も同一視する
        assert _v("20240131.0") == 20240131.0

    def test_区切り_ハイフン(self):
        assert _v("2024-01-31") == 20240131.0

    def test_区切り_スラッシュ(self):
        assert _v("2024/1/3") == 20240103.0

    def test_区切り_ドット(self):
        assert _v("2024.1.3") == 20240103.0

    def test_年月日(self):
        assert _v("2024年1月31日") == 20240131.0

    def test_和暦_漢字(self):
        # 令和6年 = 2024年
        assert _v("令和6年1月31日") == 20240131.0

    def test_和暦_略号区切り(self):
        # R06.05.28 = 2024-05-28
        assert _v("R06.05.28") == 20240528.0

    def test_和暦_平成(self):
        # 平成30年 = 2018年
        assert _v("平成30年12月25日") == 20181225.0


class TestRejectedValues:
    """日付として解釈できない値は NaN。"""

    def test_非日付文字列(self):
        assert math.isnan(_v("abc"))

    def test_短い数値は日付でない(self):
        # juki の _to_num は float("123") を 123.0 にしていたが、123 は日付でないので NaN
        assert math.isnan(_v("123"))

    def test_年範囲外(self):
        # 年 3024 は妥当範囲(1800-2100)外
        assert math.isnan(_v("30240101"))

    def test_欠損(self):
        assert math.isnan(_v(None))

    def test_空文字(self):
        assert math.isnan(_v(""))


class TestMonthDayRange:
    """月日の範囲（月1〜12・日1〜31）外は NaN。暦の実在（2月30日等）までは検証しない。"""

    def test_月が範囲外_13月はNaN(self):
        assert math.isnan(_v("2024-13-01"))

    def test_日が範囲外_45日はNaN(self):
        assert math.isnan(_v("2024-01-45"))

    def test_8桁の不可能日付はNaN(self):
        # 20241345 は _RE_8 にマッチするが月13日45で範囲外
        assert math.isnan(_v("20241345"))

    def test_ISO不可能日付はNaN(self):
        # 区切り形式でも月13・日45 は暦上ありえないので NaN
        assert math.isnan(_v("2024-13-45"))

    def test_境界_月12日31は妥当(self):
        assert _v("2024-12-31") == 20241231.0

    def test_境界_月1日1は妥当(self):
        assert _v("2024-01-01") == 20240101.0

    def test_範囲のみ_暦不成立の2月30日は通過(self):
        # 月日とも範囲内なので範囲チェックは通す（暦の実在判定はしない設計）
        assert _v("2024-02-30") == 20240230.0


class TestExistingLoaderParity:
    """既存 loader が受理してきた形式は同じ結果になる（加算的変更の保証）。"""

    def test_water_normalize_date_series_と同じ_iso(self):
        # water._normalize_date_series: ISO → YYYYMMDD
        assert _v("2024-05-28") == 20240528.0

    def test_water_normalize_date_series_と同じ_era(self):
        # water._normalize_date_series: R06.05.28 → 20240528
        assert _v("R06.05.28") == 20240528.0

    def test_juki_to_num_と同じ_slash(self):
        # juki._to_num: 2024/1/1 → 20240101
        assert _v("2024/1/1") == 20240101.0

    def test_touki_pd_to_numeric_と同じ_8桁(self):
        # touki: pd.to_numeric("20150101") → 20150101
        assert _v("20150101") == 20150101.0
