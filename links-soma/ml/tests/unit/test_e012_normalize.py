"""E012 住所正規化の詳細分岐テスト

test_address_utils.py でカバーされていない関数・分岐を検証する:
- KanjiConverter.kanji_to_int（百/千/万対応）
- CleanData.convert_address の個別変換ステップ
- katakana_to_hiragana
- KanjiConverter.normalize_address
"""

from preprocessing.address_utils import (
    CleanData,
    KanjiConverter,
    katakana_to_hiragana,
)


# ══════════════════════════════════════════════════════════════════════════════
# KanjiConverter.kanji_to_int
# ══════════════════════════════════════════════════════════════════════════════


class TestKanjiToInt:
    """漢数字→整数変換（百/千/万対応版）"""

    def test_single_digit(self):
        assert KanjiConverter.kanji_to_int("三") == 3

    def test_ten(self):
        assert KanjiConverter.kanji_to_int("十") == 10

    def test_teen(self):
        """十五 → 15"""
        assert KanjiConverter.kanji_to_int("十五") == 15

    def test_twenty(self):
        """二十 → 20"""
        assert KanjiConverter.kanji_to_int("二十") == 20

    def test_twenty_three(self):
        """二十三 → 23"""
        assert KanjiConverter.kanji_to_int("二十三") == 23

    def test_hundred(self):
        """百 → 100"""
        assert KanjiConverter.kanji_to_int("百") == 100

    def test_three_hundred_fifty(self):
        """三百五十 → 350"""
        assert KanjiConverter.kanji_to_int("三百五十") == 350

    def test_thousand(self):
        """千 → 1000"""
        assert KanjiConverter.kanji_to_int("千") == 1000

    def test_two_thousand_five_hundred(self):
        """二千五百 → 2500"""
        assert KanjiConverter.kanji_to_int("二千五百") == 2500

    def test_man(self):
        """万 → 10000"""
        assert KanjiConverter.kanji_to_int("万") == 10000

    def test_one_man_five_thousand(self):
        """一万五千 → 15000"""
        assert KanjiConverter.kanji_to_int("一万五千") == 15000

    def test_empty_string(self):
        """空文字列 → 0"""
        assert KanjiConverter.kanji_to_int("") == 0


# ══════════════════════════════════════════════════════════════════════════════
# katakana_to_hiragana
# ══════════════════════════════════════════════════════════════════════════════


class TestKatakanaToHiragana:
    """カタカナ→ひらがな変換"""

    def test_full_width_katakana(self):
        """全角カタカナ → ひらがな"""
        assert katakana_to_hiragana("トヨタ") == "とよた"

    def test_half_width_katakana(self):
        """半角カタカナ → NFKC正規化後にひらがな"""
        assert katakana_to_hiragana("ﾄﾖﾀ") == "とよた"

    def test_mixed_text_preserves_non_katakana(self):
        """カタカナ以外の文字はそのまま"""
        assert katakana_to_hiragana("豊田市トヨタ町") == "豊田市とよた町"

    def test_non_string_passthrough(self):
        """非文字列はそのまま返す"""
        assert katakana_to_hiragana(123) == 123
        assert katakana_to_hiragana(None) is None


# ══════════════════════════════════════════════════════════════════════════════
# KanjiConverter.normalize_address
# ══════════════════════════════════════════════════════════════════════════════


class TestNormalizeAddress:
    """住所固有の漢字・表記正規化"""

    def test_kita_jou_nishi(self):
        """北N条西 の漢数字変換"""
        assert KanjiConverter.normalize_address("北三条西") == "北3条西"

    def test_we_to_e(self):
        """ヱ → エ"""
        assert "エ" in KanjiConverter.normalize_address("ヱビス町")

    def test_center_normalization(self):
        """センター → センタ"""
        assert KanjiConverter.normalize_address("センター南") == "センタ南"

    def test_toori(self):
        """通り → 通"""
        assert KanjiConverter.normalize_address("大通り") == "大通"

    def test_futou(self):
        """ふ頭 → 埠頭"""
        assert KanjiConverter.normalize_address("ふ頭") == "埠頭"

    def test_non_string_passthrough(self):
        assert KanjiConverter.normalize_address(None) is None


# ══════════════════════════════════════════════════════════════════════════════
# CleanData.convert_address — 個別変換ステップ
# ══════════════════════════════════════════════════════════════════════════════


class TestConvertAddressPrefecture:
    """都道府県・市名の除去"""

    def test_remove_prefecture(self):
        result = CleanData.convert_address("愛知県豊田市大手町")
        assert not result.startswith("愛知県")

    def test_remove_city_with_municipality(self):
        """municipality指定時に市名が除去される"""
        result = CleanData.convert_address("豊田市大手町", municipality="豊田市")
        assert not result.startswith("豊田市")

    def test_city_preserved_without_municipality(self):
        """municipality未指定時は市名が残る"""
        result = CleanData.convert_address("豊田市大手町")
        assert result.startswith("豊田市")

    def test_different_municipality_preserved(self):
        """指定と異なる市名は除去しない"""
        result = CleanData.convert_address("横浜市中区", municipality="豊田市")
        assert result.startswith("横浜市")


class TestConvertAddressBanchi:
    """番地・号の正規化"""

    def test_banchi_no_gou(self):
        """1番地の2号 → 1-2"""
        result = CleanData.convert_address("大手町1番地の2号")
        assert "1-2" in result

    def test_banchi_gou(self):
        """1番2号 → 1-2"""
        result = CleanData.convert_address("大手町1番2号")
        assert "1-2" in result

    def test_trailing_banchi(self):
        """末尾の番地 → 除去"""
        result = CleanData.convert_address("大手町1番地")
        assert result.endswith("1")
        assert "番地" not in result

    def test_oaza_removal(self):
        """大字の除去"""
        result = CleanData.convert_address("大字西中山町")
        assert "大字" not in result


class TestConvertAddressParticles:
    """カタカナ助詞の正規化"""

    def test_katakana_no_to_hiragana(self):
        """カタカナ「ノ」→ ひらがな「の」"""
        # 日本語文字に挟まれたノ
        result = CleanData.convert_address("渡刈町ノ上")
        assert "の" in result

    def test_no_ze_to_no(self):
        """之 → の"""
        result = CleanData.convert_address("渡刈之上")
        assert "の" in result

    def test_ke_ga_before_suffix(self):
        """ヶ + 丘/谷等 → が"""
        result = CleanData.convert_address("三ヶ丘")
        assert "が丘" in result

    def test_middot_truncation(self):
        """・以降を切り捨て"""
        result = CleanData.convert_address("大手町1-1・Aビル")
        assert "ビル" not in result


class TestConvertAddressEdgeCases:
    """convert_address のエッジケース"""

    def test_non_string_passthrough(self):
        assert CleanData.convert_address(None) is None
        assert CleanData.convert_address(123) == 123

    def test_whitespace_collapse(self):
        """全角・半角空白の除去"""
        result = CleanData.convert_address("大手町　1丁目　2番")
        assert "　" not in result
        assert " " not in result.strip()

    def test_trailing_hyphen_removed(self):
        """末尾ハイフンの除去"""
        result = CleanData.convert_address("大手町1-")
        assert not result.endswith("-")

    def test_period_removal(self):
        """ピリオドの除去"""
        result = CleanData.convert_address("大手町1.2.3")
        assert "." not in result
