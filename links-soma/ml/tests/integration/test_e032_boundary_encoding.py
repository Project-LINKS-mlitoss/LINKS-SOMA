"""E032 の地域集計境界読み込み（read_boundary_polygon）の検証

推定の地域名称(area_group=S_NAME)は E032 が area_grouping の境界ファイルを
読んで付与する。旧実装は encoding='utf-8-sig' を強制し、SJIS 境界(.cpg なし)で
S_NAME が hex 化・文字化けしていた。

検証ギャップ注意: poetry 環境の geopandas は plain read で SJIS を正しく読むため、
実バイナリ(PyInstaller 同梱の GDAL)で起きる hex 化は自然には再現しない。そこで
フォールバック経路を monkeypatch で再現し、誤デコード結果を破棄して可読な結果へ
切り替わることを保証する（実バイナリの hex 出力でも効く）。
"""

import os

import geopandas as gpd
from shapely.geometry import Point

import E032

FIXTURE = os.path.join(
    os.path.dirname(__file__), "..", "fixtures", "kokusei_boundary", "r2ka13101.shp"
)


def _gdf(names):
    return gpd.GeoDataFrame(
        {"S_NAME": names, "geometry": [Point(0, 0) for _ in names]}
    )


class TestIsReadableJapanese:
    """SUT: _is_readable_japanese が崩れ値と可読日本語を判別する。"""

    def test_可読な日本語はTrue(self):
        for value in ["丸の内一丁目", "大手町", "かすみがせき", "カタカナ町"]:
            assert E032._is_readable_japanese(value), value

    def test_崩れ値や非日本語はFalse(self):
        # 境界(反対側): hex 化・空・None・置換文字・ASCII のみ
        for value in [
            "8adb82cc93e088ea929a96da",  # cp932 バイトの hex 化
            "",
            None,
            "Tokyo",
            "12345",
            "��",  # U+FFFD 置換文字
        ]:
            assert not E032._is_readable_japanese(value), value


class TestReadBoundaryPolygonRealFixture:
    """SUT: read_boundary_polygon が SJIS 境界を可読日本語で読む。"""

    def test_SJIS境界のS_NAMEが可読日本語になる(self):
        gdf = E032.read_boundary_polygon(FIXTURE)
        names = gdf["S_NAME"].dropna().tolist()
        assert "丸の内一丁目" in names
        assert all(E032._is_readable_japanese(n) for n in names)


class TestReadBoundaryPolygonFallback:
    """SUT: 誤デコード結果(hex)を破棄し、可読な結果へフォールバックする。"""

    def test_誤デコード結果を破棄して可読な結果を採用する(self, monkeypatch):
        calls = {"n": 0}

        def fake_read_file(path, *args, **kwargs):
            calls["n"] += 1
            if calls["n"] == 1:
                # 1 回目: GDAL が誤エンコーディングで hex 化した状態を模す
                return _gdf(["8adb82cc93e088ea929a96da"])
            # 2 回目以降: 正しいエンコーディングで読めた状態
            return _gdf(["丸の内一丁目"])

        monkeypatch.setattr(E032.gpd, "read_file", fake_read_file)
        monkeypatch.setattr(E032, "detect_encoding", lambda p: "utf-8")

        gdf = E032.read_boundary_polygon("dummy.shp")

        assert list(gdf["S_NAME"]) == ["丸の内一丁目"]
        assert calls["n"] >= 2  # 1 回目を破棄して再試行したこと
