"""
E016 国勢調査境界ポリゴンのエンコーディング処理のユニットテスト

国勢調査の境界 shapefile（.dbf）は Shift-JIS(cp932) かつ .cpg が無いケースがあり、
GDAL/fiona のバージョンによっては誤デコードで S_NAME が hex 文字列や置換文字に化ける。
本テストは「読めた文字列が妥当な日本語か」を検証する read_boundary_polygon と
判定関数 _is_readable_japanese を検証する。

- 回帰検出: 誤デコード結果（hex / U+FFFD）を妥当と誤判定すると地域名称が崩れたまま通る
- 境界: 可読日本語 / hex / 置換文字 / 空 / 純数字 の両側をカバー
"""

import os

import geopandas as gpd
import pytest

FIXTURE_SHP = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "fixtures",
    "kokusei_boundary",
    "r2ka13101.shp",
)


class TestIsReadableJapanese:
    """S_NAME 値が可読日本語かの判定ロジックの検証"""

    @pytest.mark.parametrize(
        "value",
        [
            "丸の内一丁目",  # 漢字＋ひらがな
            "東京都千代田区",  # 漢字のみ
            "あ",  # ひらがな単体
            "カタカナ町",  # カタカナ含む
        ],
    )
    def test_可読な日本語はTrue(self, value):
        """CJK 文字を含む文字列は可読日本語と判定される"""
        from src.E001_DataMatching.E016 import _is_readable_japanese

        assert _is_readable_japanese(value) is True

    @pytest.mark.parametrize(
        "value",
        [
            "8adb82cc93e088ea929a96da",  # cp932 バイト列を hex 化した実 dev DB 値
            "丸の内一丁目".encode("cp932").hex(),  # 同形式の hex 文字列
            "��",  # U+FFFD 置換文字（デコード失敗）
            "丸�内",  # 一部が置換文字
            "",  # 空文字
            "123456",  # 純数字
            "A1b2",  # 英数字のみ
            None,  # 非文字列
        ],
    )
    def test_崩れた値やnon日本語はFalse(self, value):
        """hex 文字列・置換文字・空・純英数字は不可読と判定される"""
        from src.E001_DataMatching.E016 import _is_readable_japanese

        assert _is_readable_japanese(value) is False


class TestReadBoundaryPolygon:
    """国勢調査境界ポリゴン読み込みの検証（修正後の読み込み経路）"""

    def test_境界shapefileのS_NAMEが可読日本語になる(self):
        """SJIS 境界 shapefile を読み、S_NAME が文字化けせず可読日本語になる"""
        from src.E001_DataMatching.E016 import (
            _is_readable_japanese,
            read_boundary_polygon,
        )

        gdf = read_boundary_polygon(FIXTURE_SHP)

        assert isinstance(gdf, gpd.GeoDataFrame)
        assert "S_NAME" in gdf.columns
        names = gdf["S_NAME"].dropna().tolist()
        assert len(names) > 0
        # 既知の正解値が含まれること
        assert "丸の内一丁目" in names
        # 全名称が可読日本語（hex 文字列でない・置換文字を含まない）
        assert all(_is_readable_japanese(n) for n in names), (
            f"可読でない地域名称が混入: "
            f"{[n for n in names if not _is_readable_japanese(n)][:5]}"
        )

    def test_hex様文字列も置換文字も含まない(self):
        """読み込み結果の S_NAME に hex 様文字列・U+FFFD が一切含まれない"""
        from src.E001_DataMatching.E016 import read_boundary_polygon

        gdf = read_boundary_polygon(FIXTURE_SHP)
        names = gdf["S_NAME"].dropna().tolist()

        for n in names:
            assert "�" not in n, f"置換文字を含む: {n!r}"
            assert not (
                isinstance(n, str)
                and len(n) >= 6
                and all(c in "0123456789abcdefABCDEF" for c in n)
            ), f"hex 様文字列: {n!r}"

    def test_誤デコード結果は破棄して正しい結果にフォールバックする(
        self, monkeypatch
    ):
        """先頭エンコーディングが化けた S_NAME を返しても検証で弾き、正しい結果を採用する

        GDAL が誤エンコーディングでも例外を出さず hex 文字列を黙って返す挙動を
        gpd.read_file の monkeypatch で再現する。最初の試行（chardet/utf-8 相当）が
        hex 化した S_NAME を返し、cp932 で正しい結果を返す状況を模す。
        """
        import src.E001_DataMatching.E016 as E016

        real_read_file = gpd.read_file
        good = real_read_file(FIXTURE_SHP)

        # 化けた版: S_NAME を cp932 バイト列の hex 文字列に置換
        broken = good.copy()
        broken["S_NAME"] = broken["S_NAME"].map(
            lambda s: s.encode("cp932").hex() if isinstance(s, str) else s
        )

        call_count = {"n": 0}

        def fake_read_file(path, *args, **kwargs):
            # 1回目（最優先エンコーディング）は化けた結果を返す
            call_count["n"] += 1
            if call_count["n"] == 1:
                return broken
            return good

        monkeypatch.setattr(E016.gpd, "read_file", fake_read_file)

        gdf = E016.read_boundary_polygon(FIXTURE_SHP)
        names = gdf["S_NAME"].dropna().tolist()

        # 化けた1回目は破棄され、可読日本語の結果が採用される
        assert "丸の内一丁目" in names
        assert call_count["n"] >= 2, "フォールバックが発生していない"
