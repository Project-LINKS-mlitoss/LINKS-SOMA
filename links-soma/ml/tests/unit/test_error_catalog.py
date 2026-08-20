"""エラーカタログ生成の機械保証（FR004-007 / #1849）。

ねらいは2つ。
1. 生成物 error-catalog.csv がコードから再生成した内容と一致すること（golden）。
   → コードを直したのにカタログを直し忘れる、が構造的に起きない。
2. 要件網羅表 CSV とコード（registry）の表示コード・責任分界が食い違わないこと（drift）。
   → 手動注記で齟齬を押さえる運用（例: R-077）を不要にする。
"""

import re

import error_catalog


class Test生成物がコードと一致する:
    """golden: 委譲済み CSV は再生成結果と1文字も違わない"""

    def test_error_catalog_csvが最新である(self):
        expected = error_catalog.render_csv(error_catalog.build_catalog_rows())
        actual = error_catalog.OUTPUT_CSV.read_text(encoding="utf-8-sig")
        assert actual == expected, (
            "error-catalog.csv が古くなっています。"
            "`cd ml && npm run gen:error-catalog` で再生成してください。"
        )


class Test網羅表とコードが整合する:
    """drift: 網羅表の表示コード・責任分界が registry と一致する"""

    def test_網羅表とregistryに食い違いがない(self):
        drift = error_catalog.detect_drift()
        assert drift == [], f"網羅表とコードの食い違い: {drift}"


class Testカタログの構造:
    """生成行が期待する列と最低限の整合性を持つ"""

    def test_全行が定義済みの列を持つ(self):
        for row in error_catalog.build_catalog_rows():
            assert set(row.keys()) == set(error_catalog.HEADERS)

    def test_表示コードはメッセージ末尾のEコードと一致する(self):
        """表示コード（registry由来）と メッセージ本文末尾の [E-XXXX]（constants由来）が
        別ソースなので、両者の食い違い（registryとconstantsで採番がズレる）を検出する。"""
        for row in error_catalog.build_catalog_rows():
            m = re.search(r"\[(E-[\w-]+)\]", row["メッセージ本文"])
            if m:
                assert row["表示コード"] == m.group(1), (
                    f"{row['内部識別子']}: 表示コード={row['表示コード']} / "
                    f"メッセージ内={m.group(1)}"
                )
