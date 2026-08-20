"""Address normalisation utilities — standalone reimplementation of E012.py logic.

Faithfully reproduces the normalize_address_full() pipeline from
links-akiya/ml/src/E001_DataMatching/E012.py without any dependency on the
links-akiya submodule or its production infrastructure.

The key normalization steps (in order):
  1. NFKC unicode normalization (full-width → narrow, half-width kana → full-width)
  2. Katakana → hiragana (entire string)
  3. Kanji numeral normalization in positional suffixes (丁目 etc.)
  4. Single-ツ → つ
  5. Full-width digits → ASCII digits
  6. Address structure cleanup:
       - Remove prefecture / city name prefix
       - 丁目 → hyphen, 番地 → hyphen, 号 → remove
       - 大字 / 字 → remove
       - Katakana particles ノ、ヶ etc. → hiragana equivalents
       - Remaining katakana → hiragana (second pass)
       - Trailing/duplicate hyphens cleaned up

After normalisation, addresses from different sources that refer to the same
location should produce identical strings, enabling exact-match joins.
"""

from __future__ import annotations

import re
import unicodedata
from functools import partial


# ──────────────────────────────────────────────────────────────────────────────
# kanji_to_arabic — used inside CleanData.convert_address
# ──────────────────────────────────────────────────────────────────────────────

def kanji_to_arabic(kanji: str) -> int:
    """Convert a small ordinal kanji string (一..十九) to an int."""
    mapping = {
        "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
        "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
    }
    total = temp = 0
    for ch in kanji:
        n = mapping.get(ch)
        if n is None:
            continue
        if n == 10:
            total += (temp or 1) * 10
            temp = 0
        else:
            temp = n
    return total + temp


# ──────────────────────────────────────────────────────────────────────────────
# katakana_to_hiragana
# ──────────────────────────────────────────────────────────────────────────────

def katakana_to_hiragana(text: str) -> str:
    """Convert full-width katakana (and half-width kana via NFKC) to hiragana."""
    if not isinstance(text, str):
        return text
    text = unicodedata.normalize("NFKC", text)  # half-width kana → full-width
    result = []
    for ch in text:
        code = ord(ch)
        # Full-width katakana range: U+30A1–U+30F6
        if 0x30A1 <= code <= 0x30F6:
            result.append(chr(code - 0x60))  # offset to hiragana block
        else:
            result.append(ch)
    return "".join(result)


# ──────────────────────────────────────────────────────────────────────────────
# KanjiConverter — kanji numeral helpers
# ──────────────────────────────────────────────────────────────────────────────

class KanjiConverter:
    """Convert kanji numerals in address strings."""

    _KANJI_NUM: dict[str, int] = {
        "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4,
        "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
    }
    _KANJI_PLACE_S = {"十": 10, "百": 100, "千": 1000}
    _KANJI_PLACE_L = {"万": 10_000, "億": 10**8, "兆": 10**12}

    @classmethod
    def _split_large_units(cls, text: str) -> int:
        num = current = 0
        current_str = ""
        for ch in text:
            if ch in cls._KANJI_PLACE_L:
                num += (cls._parse_below_10000(current_str) if current_str
                        else 1) * cls._KANJI_PLACE_L[ch]
                current_str = ""
            else:
                current_str += ch
        if current_str:
            num += cls._parse_below_10000(current_str)
        return num

    @classmethod
    def _parse_below_10000(cls, text: str) -> int:
        num = temp = 0
        for ch in text:
            if ch in cls._KANJI_NUM:
                temp = cls._KANJI_NUM[ch]
            elif ch in cls._KANJI_PLACE_S:
                num += (temp or 1) * cls._KANJI_PLACE_S[ch]
                temp = 0
        return num + temp

    @classmethod
    def kanji_to_int(cls, text: str) -> int:
        if not text:
            return 0
        return cls._split_large_units(text)

    @staticmethod
    def normalize_address(text: str) -> str:
        """Address-specific kanji/variant normalisation (北◯条西 etc.)."""
        if not isinstance(text, str):
            return text
        text = re.sub(
            r"北([一二三四五六七八九十百千万]+)条西",
            lambda m: f"北{kanji_to_arabic(m.group(1))}条西",
            text,
        )
        text = text.replace("ヱ", "エ")
        text = text.replace("センター", "センタ")
        text = text.replace("通り", "通")
        text = text.replace("ふ頭", "埠頭")
        return text


# ──────────────────────────────────────────────────────────────────────────────
# CleanData — full address normalization
# ──────────────────────────────────────────────────────────────────────────────

# Prefecture names used to strip leading prefix
_PREFECTURES = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
]

_RE_PREF = re.compile(r"^(" + "|".join(map(re.escape, _PREFECTURES)) + r")")

_JP_CHAR = r"[一-龥ぁ-ゟァ-ヿ]"
_RE_KATA_NO = re.compile(rf"(?<={_JP_CHAR})ノ(?={_JP_CHAR})")
_RE_NO_ZE   = re.compile(r"之")
_RE_KATA_RI = re.compile(rf"(?<={_JP_CHAR})リ(?={_JP_CHAR})")

_GA_SUFFIX = "丘谷崎沢澤原畑尻岡森田野島浦浜端"
_RE_GA     = re.compile(
    rf"(?:ヶ|ケ|ヵ|ｹ|ガ)(?=[{_GA_SUFFIX}])"
)
_RE_GA_ALONE = re.compile(
    rf"(?<={_JP_CHAR})(?:ヶ|ケ|ヵ|ｹ|ガ)(?={_JP_CHAR})"
)
_RE_TSU_COMPOUND = re.compile(r"([一二三四五六七八九十〇])つ(塚|屋)")
_RE_MIDDOT = re.compile(r"[･・].*?$")
_RE_TRAILING_BAN = re.compile(r"(番地|番)$")
_REMOVE_CHARS = dict.fromkeys(map(ord, ",，、*＊:：[]【】（）()〔〕"))

_FW_DIGIT_TABLE = str.maketrans("０１２３４５６７８９", "0123456789")


class CleanData:
    """Full address normalisation pipeline (equivalent to E012.CleanData)."""

    @staticmethod
    def convert_address(address: str, municipality=None) -> str:
        """Apply structural address normalisation (steps ⑥–⑳ of E012)."""
        if not isinstance(address, str):
            return address
        try:
            # 全角・半角スペースを削除
            # 都道府県名・市区町村名の削除より前に行う。両者は先頭一致で除去するため、
            # 「愛知県　豊田市　〇〇」のように間に空白があると一致せず市名が residual として残る
            address = re.sub(r"[\s　]+", "", address)

            address = _RE_PREF.sub("", address)
            # 市区町村名を削除（UIから入力された市区町村名を先頭一致で除去）
            # municipality にも住所と同じ正規化（NFKC・ひらがな化）を適用してから照合
            if municipality:
                normalized_municipality = katakana_to_hiragana(
                    unicodedata.normalize("NFKC", municipality)
                )
                address = re.sub("^" + re.escape(normalized_municipality), "", address)
            address = re.sub(r"[－—―−\u2010\u2011\u2012\u2013\u2014\u2015]", "-", address)

            # 丁目: kanji numerals → digits, then 丁目 → hyphen
            address = re.sub(
                r"([一二三四五六七八九十]+)丁目",
                lambda m: f"{kanji_to_arabic(m.group(1))}丁目",
                address,
            )
            address = re.sub(r"(\d+)丁目", r"\1-", address)

            # 番地 / 号
            address = re.sub(r"(\d+)番地の(\d+号?)", r"\1-\2", address)
            address = re.sub(r"(\d+)番地?(\d+号?)", r"\1-\2", address)
            address = re.sub(r"(\d+)番地?$", r"\1", address)
            address = re.sub(r"(\d+)号", r"\1", address)

            # 大字 / 字
            address = re.sub(r"大字", "", address)
            address = re.sub(r"字", "", address)

            # Consolidate hyphens
            address = re.sub(r"-+", "-", address)

            # Middot and particles
            address = _RE_MIDDOT.sub("", address).strip()
            address = _RE_TRAILING_BAN.sub("", address).strip()
            address = address.translate(_REMOVE_CHARS)

            # Katakana particles → hiragana
            address = _RE_KATA_NO.sub("の", address)
            address = _RE_NO_ZE.sub("の", address)
            address = _RE_KATA_RI.sub("り", address)
            address = _RE_GA.sub("が", address)
            address = _RE_GA_ALONE.sub("が", address)

            # Remaining katakana → hiragana (second pass)
            address = katakana_to_hiragana(address)

            # Misc clean-up
            address = _RE_TSU_COMPOUND.sub(r"\1\2", address)
            address = re.sub(r"-$", "", address)
            address = re.sub(r"[\u002E\uFF0E]", "", address)  # dots
            address = address.strip()
            address = re.sub(r"\s+", " ", address)
        except Exception:
            pass
        return address

    @staticmethod
    def replace_single_katakana(text: str) -> str:
        """Replace isolated ツ/ﾂ with つ."""
        if not isinstance(text, str):
            return text
        hw = r"ｦ-ﾟ"
        fw = r"ァ-ン"
        pat = (
            rf"(?<![{hw}])ﾂ(?![{hw}])|"
            rf"(?<![{fw}])ツ(?![{fw}])"
        )
        return re.sub(pat, "つ", text)

    @classmethod
    def normalize(cls, address: str, municipality=None) -> str:
        """Alias for normalize_address_full on a single string."""
        return normalize_address_full(address, municipality=municipality)

    @classmethod
    def normalize_series(cls, series, municipality=None) -> "pd.Series":  # type: ignore[name-defined]  # noqa: F821
        """Vectorised normalisation of a pandas Series."""
        normalizer = partial(normalize_address_full, municipality=municipality)
        return series.astype(str).map(normalizer)


def normalize_address_full(raw: str, municipality=None) -> str:
    """Full address normalisation pipeline (E012.normalize_address_full equivalent).

    Applies (in order):
      1. NFKC normalization
      2. Katakana → hiragana
      3. Kanji numeral normalisation (北◯条西 etc.)
      4. Single-ツ → つ
      5. Full-width digits → ASCII
      6. Structural address cleanup (prefecture/city prefix, 丁目→-, 番地→-, etc.)

    Args:
        raw: Raw address string from any source.

    Returns:
        Normalized address string suitable for exact-match joining.
    """
    if raw is None:
        return raw
    try:
        import pandas as _pd
        if isinstance(raw, float) and _pd.isna(raw):
            return raw
        if not isinstance(raw, str) and _pd.isna(raw):
            return raw
    except Exception:
        pass
    if not isinstance(raw, str):
        return raw

    s = unicodedata.normalize("NFKC", raw)
    s = katakana_to_hiragana(s)
    s = KanjiConverter.normalize_address(s)
    s = CleanData.replace_single_katakana(s)
    s = s.translate(_FW_DIGIT_TABLE)
    s = CleanData.convert_address(s, municipality=municipality)
    return s
