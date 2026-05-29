"""address_utils モジュールの単体テスト

住所正規化（都道府県除去、漢数字変換、カタカナ→ひらがな等）の検証。
"""

import pandas as pd


class TestAddressUtils:
    """アドレス正規化のテスト"""

    def test_normalize_basic_address(self):
        """基本的な住所正規化: 丁目→ハイフン、番地→ハイフン"""
        from preprocessing.address_utils import normalize_address_full

        assert normalize_address_full("東京都千代田区一丁目2番3号") == "千代田区1-2-3"

    def test_normalize_kanji_numerals(self):
        """漢数字を算用数字に変換"""
        from preprocessing.address_utils import normalize_address_full

        result = normalize_address_full("愛知県豊田市三丁目五番地")
        # 丁目の漢数字→算用数字は変換される。番地の漢数字はそのまま残る場合あり。
        assert "3-" in result or "3" in result

    def test_normalize_removes_prefecture(self):
        """都道府県プレフィクスの除去"""
        from preprocessing.address_utils import normalize_address_full

        result = normalize_address_full("愛知県豊田市大字西中山町")
        assert not result.startswith("愛知県")

    def test_normalize_removes_city_with_municipality(self):
        """municipality指定時に市名プレフィクスが除去される"""
        from preprocessing.address_utils import normalize_address_full

        result = normalize_address_full("豊田市大字西中山町", municipality="豊田市")
        assert not result.startswith("豊田市")

    def test_normalize_preserves_city_without_municipality(self):
        """municipality未指定時は市名が残る"""
        from preprocessing.address_utils import normalize_address_full

        result = normalize_address_full("豊田市大字西中山町")
        assert result.startswith("豊田市")

    def test_normalize_handles_none(self):
        """Noneを渡した場合"""
        from preprocessing.address_utils import normalize_address_full

        assert normalize_address_full(None) is None

    def test_normalize_handles_nan(self):
        """NaN値を渡した場合"""
        from preprocessing.address_utils import normalize_address_full

        result = normalize_address_full(float("nan"))
        # NaN → NaN を返す（文字列にならない）
        assert result != result  # NaN check

    def test_normalize_katakana_to_hiragana(self):
        """カタカナのひらがな変換"""
        from preprocessing.address_utils import normalize_address_full

        result = normalize_address_full("豊田市トヨタ町", municipality="豊田市")
        assert "とよた町" in result

    def test_normalize_series(self):
        """Series一括正規化"""
        from preprocessing.address_utils import CleanData

        s = pd.Series(["愛知県豊田市一丁目2番3号", "豊田市大字西中山"])
        result = CleanData.normalize_series(s)
        assert len(result) == 2
        assert "1-2-3" in result.iloc[0]

    def test_kanji_to_arabic(self):
        """漢数字→算用数字"""
        from preprocessing.address_utils import kanji_to_arabic

        assert kanji_to_arabic("十五") == 15
        assert kanji_to_arabic("三") == 3
        assert kanji_to_arabic("十") == 10
        assert kanji_to_arabic("十九") == 19
