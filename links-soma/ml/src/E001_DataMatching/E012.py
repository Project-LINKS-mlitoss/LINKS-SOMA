"""
# E012 名寄せ機能
* アップロードされた住所カラムに該当するすべての列の名寄せ（住所の正規化）をする機能
"""

import copy
import json
import os
import re
import sys
import traceback
from concurrent.futures import ProcessPoolExecutor
from functools import partial
from multiprocessing import cpu_count
from pathlib import Path

import unicodedata
import argparse
import chardet
import pandas as pd
import warnings

warnings.filterwarnings("ignore")
current_dir = os.path.dirname(os.path.abspath(__file__))
async_tasks_path = os.path.join(current_dir, "..", "async_tasks")
if async_tasks_path not in sys.path:
    sys.path.append(async_tasks_path)

try:
    from utils import *
    from constants import *
except ImportError:
    sys.path.remove(async_tasks_path)
    sys.path.append(
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../"))
    )
    from async_tasks.utils import *
    from async_tasks.constants import *


def setup_environment():
    """
    Setup environment for child processes in PyInstaller frozen executables.
    """
    # Fix stdout/stderr for PyInstaller frozen executables
    if getattr(sys, 'frozen', False):
        if sys.stdout is None:
            sys.stdout = open(os.devnull, 'w')
        if sys.stderr is None:
            sys.stderr = open(os.devnull, 'w')


# 入力する各データのカラムを定義
INPUT_COLUMNS = {
    "suido_status": {
        "water_supply_number": None,
        "suido_status_address": None,
        "usage_start_date": None,
        "usage_end_date": None,
    },
    "suido_use": {
        "water_supply_number": None,
        "meter_reading_date": None,
        "suido_usage": None,
    },
    "juki": {
        "household_code": None,
        "juki_address": None,
        "birth_date": None,
        "move_date": None,
        "reason_transfer": None,
        "date_transfer": None,
    },
    "touki": {
        "touki_address": None,
        "structure": None,
        "registration_reason": None,
        "registration_date": None,
    },
    "geocoding": {
        "geocoding_address": None,
        "geocoding_latitude": None,
        "geocoding_longitude": None,
        "level_geocoding": None,
        "confidency_geocoding": None,
    },
}

# 　出力する各データのカラムを定義
OUTPUT_COLUMNS = {
    "suido_status": {
        "water_supply_number": "water_supply_number",
        "suido_status_address": "suido_status_address",
        "usage_start_date": "usage_start_date",
        "usage_end_date": "usage_end_date",
        "convert_suido_address": "normalized_address",
    },
    "suido_use": {
        "water_supply_number": "water_supply_number",
        "meter_reading_date": "meter_reading_date",
        "suido_usage": "suido_usage",
    },
    "juki": {
        "household_code": "household_code",
        "juki_address": "juki_address",
        "birth_date": "birth_date",
        "move_date": "move_date",
        "reason_transfer": "reason_transfer",
        "date_transfer": "date_transfer",
        "convert_juki_address": "normalized_address",
    },
    "touki": {
        "touki_address": "touki_address",
        "structure": "structure",
        "registration_reason": "registration_reason",
        "registration_date": "registration_date",
        "convert_touki_address": "normalized_address",
    },
    "geocoding": {
        "geocoding_address": "geocoding_address",
        "geocoding_latitude": "latitude",
        "geocoding_longitude": "longitude",
        "level_geocoding": "level_geocoding",
        "confidency_geocoding": "confidency_geocoding",
        "convert_geo_address": "normalized_address",
    },
}
OUTPUT_COLUMNS_INITIAL = OUTPUT_COLUMNS

FILE_NAME_JP = {
    "suido_status": "水道閉開栓状況",
    "juki": "住民基本台帳",
    "touki": "建物情報",
    "geocoding": "ジオコーディング済みデータ",
    "building_type_determination": "建物種別判定用データ",
}

ERROR_CODE = None
ERROR_MSG = None


class KanjiConverter:
    """
    漢数字の文字列を整数に変換する機能を提供します。
    「二十一」や「千二百三」のような位を含む数字に対応します。
    """

    # 漢数字と数値、位の定義
    _KANJI_NUM = {
        "〇": 0,
        "一": 1,
        "二": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
    }

    _KANJI_PLACE_S = {"十": 10, "百": 100, "千": 1000}  # 1万未満の位
    _KANJI_PLACE_L = {"万": 10000, "億": 10**8, "兆": 10**12}  # 万以上の位

    @classmethod
    def _split_large_units(cls, text: str):
        """
        大きな位（万、億、兆）で分割する。
        """
        units = list(cls._KANJI_PLACE_L.keys())
        num = 0
        current = ""

        for ch in text:
            if ch in units:
                if current:
                    num += (
                        cls._parse_below_10000(current)
                        * cls._KANJI_PLACE_L[ch]
                    )
                    current = ""
                else:
                    num += cls._KANJI_PLACE_L[ch]  # 「万」のみなど
            else:
                current += ch

        if current:
            num += cls._parse_below_10000(current)
        return num

    @classmethod
    def _parse_below_10000(cls, text: str) -> int:
        """
        1万未満の数字を解析する。
        """
        num = 0
        temp = 0
        for ch in text:
            if ch in cls._KANJI_NUM:
                temp = cls._KANJI_NUM[ch]
            elif ch in cls._KANJI_PLACE_S:
                if temp == 0:
                    temp = 1
                num += temp * cls._KANJI_PLACE_S[ch]
                temp = 0
            else:
                # 認識できない文字が出た場合は無視する
                pass
        num += temp
        return num

    @classmethod
    def kanji_to_int(cls, text: str) -> int:
        """
        漢数字列を整数に変換するメイン関数。
        """
        if not text:
            return 0
        return cls._split_large_units(text)

    @staticmethod
    def convert_kanji_to_number(kanji_str: str) -> int:
        """
        簡易版（丁目など）で使用する漢数字→数字変換。
        """
        mapping = {
            "一": 1,
            "二": 2,
            "三": 3,
            "四": 4,
            "五": 5,
            "六": 6,
            "七": 7,
            "八": 8,
            "九": 9,
            "十": 10,
        }
        result = 0
        temp = 0

        for char in kanji_str:
            if char in mapping:
                value = mapping[char]
                if value == 10:
                    if temp == 0:
                        temp = 1
                    result += temp * value
                    temp = 0
                else:
                    temp = value
        result += temp
        return result

    @staticmethod
    def normalize_address(text: str) -> str:
        """
        住所用：漢数字や表記ゆれをある程度ならす処理。
        """

        if not isinstance(text, str):
            return text

        # ひらがな → 判明している漢字（例示）
        # text = text.replace("つくば市", "筑波市")

        # 数字と接尾語
        text = re.sub(
            r"北([一二三四五六七八九十百千万]+)条西",
            lambda m: f"北{KanjiConverter.convert_kanji_to_number(m.group(1))}条西",
            text,
        )
        # text = re.sub(r'([一二三四五六七八九十百千万]+)番町', lambda m: f"{KanjiConverter.convert_kanji_to_number(m.group(1))}番町", text)

        # カタカナ「エ」「ヱ」
        # 仕様：ヱ → エ のみ
        text = text.replace("ヱ", "エ")

        # 長音記号
        text = text.replace("センター", "センタ")

        # 送り仮名
        text = text.replace("通り", "通")

        # かな・漢字のゆれ
        text = text.replace("ふ頭", "埠頭")

        return text

    @classmethod
    def regex_normalize(cls, text: str) -> str:
        try:
            return pattern_kanji_mapping.sub(
                lambda x: KANJI_TABLE_MAPPING[x.group()], text
            )
        except Exception:
            return text


KANJI_TABLE_MAPPING = {chr(c): str(c) for c in range(0x4E00, 0x9FA6)}
pattern_kanji_mapping = re.compile(
    r"[" + "".join(KANJI_TABLE_MAPPING.keys()) + r"]"
)


class CleanData:
    # 単独カタカナの置換
    @staticmethod
    def replace_single_katakana(text):
        """
        単独カタカナを置換する

        Parameters
        ----------
        text : str
            処理対象のテキスト

        Returns
        -------
        str
            単独カタカナが置換されたテキスト
        """
        if not isinstance(text, str):
            return text

        # カタカナの Unicode 範囲 (半角・全角) を定義
        halfwidth_katakana = r"ｦ-ﾟ"
        fullwidth_katakana = r"ァ-ン"

        # 単独の「ツ」「ﾂ」をひらがなの「つ」に置換する
        single_tsu_pattern = (
            rf"(?<![{halfwidth_katakana}])ﾂ(?![{halfwidth_katakana}])|"
            rf"(?<![{fullwidth_katakana}])ツ(?![{fullwidth_katakana}])"
        )
        text = re.sub(single_tsu_pattern, "つ", text)

        return text

    @staticmethod
    def convert_fullwidth_to_halfwidth_digits(text):
        """
        テキスト内の全角数字を半角数字に変換する
        """
        if not isinstance(text, str):
            return text
        fullwidth_to_halfwidth = str.maketrans(
            "０１２３４５６７８９", "0123456789"
        )
        return text.translate(fullwidth_to_halfwidth)

    @staticmethod
    def convert_address(address, municipality=None):
        """
        住所文字列を正規化する関数

        Parameters
        ----------
        address : str
            正規化対象の住所文字列

        Returns
        -------
        str
            正規化された住所文字列
        """
        if not isinstance(address, str):
            return address

        RE_REMOVE_AFTER_MIDDOT = re.compile(r"[･・].*?$")
        RE_TRAILING_BAN = re.compile(r"(番地|番)$")
        REMOVE_CHARS_TABLE = dict.fromkeys(map(ord, ",，、*＊:："))

        try:
            # 都道府県名を削除
            prefectures = [
                "北海道",
                "青森県",
                "岩手県",
                "宮城県",
                "秋田県",
                "山形県",
                "福島県",
                "茨城県",
                "栃木県",
                "群馬県",
                "埼玉県",
                "千葉県",
                "東京都",
                "神奈川県",
                "新潟県",
                "富山県",
                "石川県",
                "福井県",
                "山梨県",
                "長野県",
                "岐阜県",
                "静岡県",
                "愛知県",
                "三重県",
                "滋賀県",
                "京都府",
                "大阪府",
                "兵庫県",
                "奈良県",
                "和歌山県",
                "鳥取県",
                "島根県",
                "岡山県",
                "広島県",
                "山口県",
                "徳島県",
                "香川県",
                "愛媛県",
                "高知県",
                "福岡県",
                "佐賀県",
                "長崎県",
                "熊本県",
                "大分県",
                "宮崎県",
                "鹿児島県",
                "沖縄県",
            ]
            # 都道府県名を削除
            pattern = "^(" + "|".join(map(re.escape, prefectures)) + ")"
            address = re.sub(pattern, "", address)

            # 市区町村名を削除（UIから入力された市区町村名を先頭一致で除去）
            # municipality にも住所と同じ正規化（NFKC・ひらがな化）を適用してから照合
            if municipality:
                normalized_municipality = katakana_to_hiragana(
                    unicodedata.normalize("NFKC", municipality)
                )
                pattern2 = "^" + re.escape(normalized_municipality)
                address = re.sub(pattern2, "", address)

            # 全角・半角スペースを削除
            address = re.sub(r"[\s　]+", "", address)

            # ハイフンを半角ハイフン（U+002D）に変換
            address = re.sub(r"[－—―−]", "-", address)

            # 丁目の漢数字を算用数字へ & 丁目をハイフンに変換
            def kanji_to_chome_local(match):
                kanji = match.group(1)
                number = kanji_to_arabic(kanji)
                return f"{number}丁目"

            address = re.sub(
                r"([一二三四五六七八九十]+)丁目", kanji_to_chome_local, address
            )
            address = re.sub(r"(\d+)丁目", r"\1-", address)

            # 番地をハイフンに変換
            address = re.sub(r"(\d+)番地の(\d+号?)", r"\1-\2", address)
            address = re.sub(r"(\d+)番地?(\d+号?)", r"\1-\2", address)
            address = re.sub(r"(\d+)番地?$", r"\1", address)

            # 号を除去
            address = re.sub(r"(\d+)号", r"\1", address)

            # 大字・字を削除
            address = re.sub(r"大字", "", address)
            address = re.sub(r"字", "", address)

            # 連続する半角ハイフンを一つに統合
            address = re.sub(r"-+", "-", address)

            # 「・」以降を削る
            address = RE_REMOVE_AFTER_MIDDOT.sub("", address).strip()

            # 末尾の「番」「番地」を削る
            address = RE_TRAILING_BAN.sub("", address).strip()

            # 不要記号を削除
            address = address.translate(REMOVE_CHARS_TABLE)

            # 住所助詞・連結のゆれを“ひらがな”へ統一
            JP_CHAR = r"[一-龥ぁ-ゟァ-ヿ]"

            # カタカナ「ノ」→ひらがな「の」（地名の中間にある場合のみ）
            RE_KATA_NO = re.compile(
                r"(?<=" + JP_CHAR + r")ノ(?=" + JP_CHAR + r")"
            )
            # 漢字「之」→ひらがな「の」
            RE_NO_ZE = re.compile(r"之")
            # カタカナ「リ」→ひらがな「り」（連結助詞っぽい場合）
            RE_KATA_RI = re.compile(
                r"(?<=" + JP_CHAR + r")リ(?=" + JP_CHAR + r")"
            )

            address = RE_KATA_NO.sub("の", address)
            address = RE_NO_ZE.sub("の", address)
            address = RE_KATA_RI.sub("り", address)

            # 「ヶ/ケ/ヵ/ｹ/ガ」→「が」（特殊な変換）
            # 直後が地名に典型の語尾（丘/谷/崎/沢/澤/原/畑/尻/岡/森/田/野/島/浦/浜/端 等）の場合に限定
            GA_SUFFIX = (
                "丘",
                "谷",
                "崎",
                "沢",
                "澤",
                "原",
                "畑",
                "尻",
                "岡",
                "森",
                "田",
                "野",
                "島",
                "浦",
                "浜",
                "端",
            )
            RE_GA_PARTICLE = re.compile(
                r"(?:ヶ|ケ|ヵ|ｹ|ガ)(?=(?:"
                + "|".join(map(re.escape, GA_SUFFIX))
                + r"))"
            )
            address = RE_GA_PARTICLE.sub("が", address)

            # 上の例外：一般的に “ヶ/ケ/ヵ/ｹ” 単独でも長年の地名ゆれ→「が」へ統一
            # ただし誤変換を避けるため、前後が日本語文字の時に限る
            RE_GA_ALONE = re.compile(
                r"(?<=" + JP_CHAR + r")(?:ヶ|ケ|ヵ|ｹ|ガ)(?=" + JP_CHAR + r")"
            )
            address = RE_GA_ALONE.sub("が", address)

            # 残ったカタカナをすべてひらがなに変換
            address = katakana_to_hiragana(address)

            # 「三つ塚→三塚」「四つ屋→四屋」（必要最小限の一般化）
            RE_TSU_COMPOUND = re.compile(
                r"([一二三四五六七八九十〇])つ(塚|屋)"
            )
            address = RE_TSU_COMPOUND.sub(r"\1\2", address)

            # 末尾のハイフンを削除
            address = re.sub(r"-$", "", address)

            # すべてのピリオド（半角と全角）を削除
            address = re.sub(r"[\u002E\uFF0E]", "", address)

            # 先頭末尾の空白文字を除去
            address = address.strip()

            # 連続する空白文字を単一の空白に置換
            address = re.sub(r"\s+", " ", address)

            return address

        except Exception:
            return address

    @staticmethod
    def normalize_text(text):
        """
        テキストを正規化する

        Parameters
        ----------
        text : str
            正規化対象のテキスト

        Returns
        -------
        str
            正規化されたテキスト
        """
        if isinstance(text, str):
            # Unicode正規化（NFKC）を適用
            return unicodedata.normalize("NFKC", text)
        return text

    @staticmethod
    def convert_halfwidth_to_fullwidth(text):
        """
        半角カタカナを全角カタカナに変換する

        Parameters
        ----------
        text : str
            正規化対象のテキスト

        Returns
        -------
        str
            正規化されたテキスト
        """
        if not isinstance(text, str):
            return text

        # 半角カタカナの範囲に対応するUnicode番号を計算し、全角カタカナに変換
        half_to_full_katakana_map = str.maketrans(
            "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿ" "ﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓ" "ﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ",
            "ヲァィゥェォャュョッーアイウエオカキクケコサシスセソ"
            "タチツテトナニヌネノハヒフヘホマミムメモ"
            "ヤユヨラリルレロワン゛゜",
        )
        text = text.translate(half_to_full_katakana_map)

        # 拗音・促音の場合、後続の文字を結合して適切な全角カタカナにする
        text = re.sub(r"(\w゛)", lambda x: chr(ord(x.group(1)[0]) + 1), text)
        text = re.sub(r"(\w゜)", lambda x: chr(ord(x.group(1)[0]) + 2), text)
        return text


def katakana_to_hiragana(text: str) -> str:
    """
    全角カタカナ・半角カタカナをすべてひらがなに変換する
    """
    if not isinstance(text, str):
        return text

    # 半角カナなどを含めて一旦 NFKC に正規化（半角カナ → 全角カナ など）
    text = unicodedata.normalize("NFKC", text)

    # --- 全角カタカナ → 全角ひらがな ---
    result = []
    for ch in text:
        code = ord(ch)
        # カタカナ → ひらがな（U+30A1〜U+30F6）
        if 0x30A1 <= code <= 0x30F6:
            result.append(chr(code - 0x60))  # 差分 0x60 = 96
        else:
            result.append(ch)

    return "".join(result)


def kanji_to_arabic(kanji):
    # 変換用の漢数字と半角数字の対応辞書
    kanji_to_number = {
        "一": 1,
        "二": 2,
        "三": 3,
        "四": 4,
        "五": 5,
        "六": 6,
        "七": 7,
        "八": 8,
        "九": 9,
        "十": 10,
    }
    total = 0
    temp = 0
    for char in kanji:
        num = kanji_to_number.get(char, None)
        if num is not None:
            if num == 10:
                if temp == 0:  # "十" の前に数字がない場合（例: 十一）
                    temp = 1
                total += temp * 10
                temp = 0
            else:
                temp += num
    total += temp
    return total


# 正規表現で「〇丁目」の漢数字部分を数字に変換
def kanji_to_chome(match):
    kanji = match.group(1)
    number = kanji_to_arabic(kanji)  # 漢数字を対応する数字に変換
    return f"{number}丁目"


def normalize_address_full(raw: str, municipality=None):
    """
    住所文字列1件に対して、仕様①〜⑳の正規化処理を順番に適用するラッパ関数。

    Parameters
    ----------
    raw : str
        正規化対象の住所文字列

    Returns
    -------
    str
        正規化後の住所文字列
    """
    if raw is None:
        return None

    # pandas の欠損（NaN）などにも対応
    try:
        import pandas as _pd

        if isinstance(raw, float) and _pd.isna(raw):
            return raw
        if _pd.isna(raw):
            return raw
    except Exception:
        # pandas が無い環境などでは単純チェックのみ
        pass

    # 文字列以外はそのまま返す
    if not isinstance(raw, str):
        return raw

    # ⑤, ⑭: Unicode 正規化（NFKC）で
    #   - 全角数字→半角数字
    #   - 半角カタカナ→全角カタカナ
    #   などを一括で揃える
    s = CleanData.normalize_text(raw)

    # カタカナをひらがな変換
    s = katakana_to_hiragana(s)
    # ②, ③, ①の一部（漢数字丁目, 北◯条西 など）
    # Run on IF001 and not run on IF005
    s = KanjiConverter.normalize_address(s)

    # ④: 単独ツ/ﾂ → つ
    s = CleanData.replace_single_katakana(s)

    # ⑤: 念のため、全角数字→半角数字をもう一度保証
    s = CleanData.convert_fullwidth_to_halfwidth_digits(s)

    # ⑥〜⑳: 都道府県名・市区町村名削除、丁目/番地/号/大字/字/ハイフン・助詞・記号などの細かい正規化
    s = CleanData.convert_address(s, municipality=municipality)

    return s


class DataProcessor:
    def __init__(self, input_paths, output_paths):
        """
        DataProcessorクラスの初期化メソッド

        Parameters
        ----------
        input_paths : dict
            入力ファイルのパスを含む辞書
        output_paths : dict
            出力ファイルのパスを含む辞書
        """
        # 入力ファイルのパスを設定
        self.INPUT_PATHS = input_paths
        # 出力ファイルのパスを設定
        self.OUTPUT_PATHS = output_paths

    @staticmethod
    def save_csv(df, path):
        """
        データフレームをCSVファイルとして保存する。
        Shift-JIS、CP932、UTF-8の順で保存を試みる。

        Parameters
        ----------
        df : pandas.DataFrame
            保存するデータフレーム
        path : str
            保存先のファイルパス
        """

        # エンコーディングの優先順位リスト
        encodings = ["utf-8-sig"]

        # 各エンコーディングで保存を試みる
        for encoding in encodings:
            try:
                # データフレームをCSVとして保存
                df.to_csv(
                    path, encoding=encoding, index=False, errors="replace"
                )
                return
            except Exception as e:
                # エラーが発生した場合、メッセージを表示して次のエンコーディングを試す
                set_error(ERROR_00001, path, encoding)
                raise Exception(e)

    def process(self):
        """
        データ処理を実行する抽象メソッド
        サブクラスでこのメソッドを実装する必要がある
        """
        raise NotImplementedError("Subclasses must implement this method")


# 各ファイルごとの処理クラス
class EachFileProcessor(DataProcessor):

    def __init__(
        self, input_paths, output_paths, input_columns=None, output_columns=None, output_columns_initial=None,
        municipality=None,
    ):
        super().__init__(input_paths, output_paths)
        self.input_columns = (
            input_columns if input_columns is not None else INPUT_COLUMNS
        )
        self.output_columns = (
            output_columns if output_columns is not None else OUTPUT_COLUMNS
        )
        self.output_columns_initial = (
            output_columns_initial if output_columns_initial is not None else OUTPUT_COLUMNS_INITIAL
        )
        self.municipality = municipality

    def process_file(self, file_key):
        """
        指定されたファイルキーに対応するファイルを処理する

        Parameters
        ----------
        file_key : str
            処理対象のファイルキー
        """

        cols = self.input_columns[file_key]

        # Apply step by step, tolerating non-strings
        df = read_file(
            self.INPUT_PATHS[file_key],
            file_key,
            output_columns=self.output_columns
        )
        # Rename columns
        rename_columns = {}
        for key, input_col in cols.items():
            new_col = self.output_columns_initial[file_key].get(key, input_col)
            rename_columns[input_col] = new_col
        if file_key == "suido_use":
            df = df.rename(columns=rename_columns)
            # 入力ファイルのすべてのカラム名を取得
            all_columns = set(df.columns)

            missing_cols = (
                set(self.output_columns_initial[file_key].values()) - all_columns
            )
            if missing_cols:
                set_error(ERROR_00035)
                missing_str = ", ".join(sorted(missing_cols))
                raise Exception(f"水道使用量のデータが異常です。: {missing_str}")

            self.save_csv(df, self.OUTPUT_PATHS[file_key])
        else:
            is_if005 = False
            if len(df.columns) == 1:
                is_if005 = True
            
            if not is_if005:
                df = df.dropna(subset=[cols[f"{file_key}_address"]])
                if df is None or len(df) == 0:
                    raise Exception("データが異常です。")

                if file_key == "geocoding":
                    if cols.get("level_geocoding") not in df.columns:
                        df[cols["level_geocoding"]] = None
                    if cols.get("confidency_geocoding") not in df.columns:
                        df[cols["confidency_geocoding"]] = None
                if file_key == "juki":
                    if cols.get("date_transfer") not in df.columns:
                        df[cols["date_transfer"]] = None
                if file_key == "touki":
                    if cols.get("registration_reason") not in df.columns:
                        df[cols["registration_reason"]] = None
                    if cols.get("registration_date") not in df.columns:
                        df[cols["registration_date"]] = None

            normalizer = partial(normalize_address_full, municipality=self.municipality)
            df["normalized_address"] = df[cols[f"{file_key}_address"]].apply(
                normalizer
            )
            df = df.rename(columns=rename_columns)
            # 入力ファイルのすべてのカラム名を取得
            all_columns = set(df.columns)

            missing_cols = (
                set(self.output_columns_initial[file_key].values()) - all_columns
            )
            file_name = FILE_NAME_JP[file_key]
            if missing_cols:
                set_error(ERROR_00036, file_name)
                missing_str = ", ".join(sorted(missing_cols))
                raise Exception(f"{file_name}のデータが異常です。: {missing_str}")
            self.save_csv(df, self.OUTPUT_PATHS[file_key])
        return


def _process(args):
    """
    Wrapper function for parallel file processing.
    """
    # Setup environment for PyInstaller compatibility
    setup_environment()

    file_key, input_path, output_path, input_columns, output_columns, output_columns_initial, municipality = args
    try:
        processor = EachFileProcessor(
            {file_key: input_path},
            {file_key: output_path},
            input_columns=input_columns,
            output_columns=output_columns,
            output_columns_initial=output_columns_initial,
            municipality=municipality,
        )
        processor.process_file(file_key)
        return (file_key, True, None)
    except Exception as e:
        # Ensure error message is not empty
        error_msg = str(e) if str(e) else f"Unknown error in {file_key}"
        # Include traceback for debugging
        error_detail = f"{error_msg}\n{traceback.format_exc()}"
        return (file_key, False, error_detail)


def set_output_column():
    global OUTPUT_COLUMNS
    OUTPUT = copy.deepcopy(INPUT_COLUMNS)
    OUTPUT["suido_status"]["convert_suido_address"] = "normalized_address"
    OUTPUT["juki"]["convert_juki_address"] = "normalized_address"
    OUTPUT["touki"]["convert_touki_address"] = "normalized_address"
    OUTPUT["geocoding"]["convert_geo_address"] = "normalized_address"
    OUTPUT_COLUMNS = OUTPUT


def set_columns(
    water_supply_number,
    suido_status_address,
    usage_start_date,
    usage_end_date,
    water_supply_number2,
    meter_reading_date,
    suido_usage,
    household_code,
    juki_address,
    birth,
    move_date,
    reason_transfer,
    date_transfer,
    touki_address,
    structure,
    registration_reason,
    registration_date,
    geocoding_address,
    geocoding_latitude,
    geocoding_longitude,
    level_geocoding,
    confidency_geocoding,
):
    """
    ユーザーが選択したカラムをINPUT_COLUMNSに反映
    """
    # suido_statusセクション
    INPUT_COLUMNS["suido_status"]["water_supply_number"] = water_supply_number
    INPUT_COLUMNS["suido_status"][
        "suido_status_address"
    ] = suido_status_address
    INPUT_COLUMNS["suido_status"]["usage_start_date"] = usage_start_date
    INPUT_COLUMNS["suido_status"]["usage_end_date"] = usage_end_date

    # suido_use
    INPUT_COLUMNS["suido_use"]["water_supply_number"] = water_supply_number2
    INPUT_COLUMNS["suido_use"]["meter_reading_date"] = meter_reading_date
    INPUT_COLUMNS["suido_use"]["suido_usage"] = suido_usage

    # jukiセクション
    INPUT_COLUMNS["juki"]["household_code"] = household_code
    INPUT_COLUMNS["juki"]["juki_address"] = juki_address
    INPUT_COLUMNS["juki"]["birth_date"] = birth
    INPUT_COLUMNS["juki"]["move_date"] = move_date
    INPUT_COLUMNS["juki"]["reason_transfer"] = reason_transfer
    INPUT_COLUMNS["juki"]["date_transfer"] = date_transfer
    # toukiセクション
    INPUT_COLUMNS["touki"]["touki_address"] = touki_address
    INPUT_COLUMNS["touki"]["structure"] = structure
    INPUT_COLUMNS["touki"]["registration_reason"] = registration_reason
    INPUT_COLUMNS["touki"]["registration_date"] = registration_date

    # geocodingセクション
    INPUT_COLUMNS["geocoding"]["geocoding_address"] = geocoding_address
    INPUT_COLUMNS["geocoding"]["geocoding_latitude"] = geocoding_latitude
    INPUT_COLUMNS["geocoding"]["geocoding_longitude"] = geocoding_longitude
    INPUT_COLUMNS["geocoding"]["level_geocoding"] = level_geocoding
    INPUT_COLUMNS["geocoding"]["confidency_geocoding"] = confidency_geocoding
    return INPUT_COLUMNS


def detect_encoding(p: Path, default="utf-8"):
    """
    ファイルのエンコーディングを検出する

    Parameters
    ----------
    file_path : str
        検出対象のファイルパス

    Returns
    -------
    encoding : str
        検出されたエンコーディング
    """
    try:
        with open(p, "rb") as f:
            raw = f.read(100000)  # 先頭10万バイトだけ見る
        guess = chardet.detect(raw)
        enc = guess.get("encoding") or default
        # Normalize common aliases
        enc = (
            enc.replace("SHIFT_JIS", "cp932").replace("SHIFT-JIS", "cp932")
            if isinstance(enc, str)
            else default
        )
        return enc
    except Exception:
        return default


def read_file(path, key, output_columns=None, keep_all_columns=False, **kwargs):
    """
    ファイルを読み込み、OUTPUT_COLUMNSに指定されたカラムのみを残す。
    keep_all_columns=True の場合はフィルタせず全カラムを返す（optional_data_source / vacant_house 用）。

    Parameters
    ----------
    path : str
        読み込むファイルのパス
    key : str
        OUTPUT_COLUMNSのキー（例: "suido_status"）。keep_all_columns=True の場合は未使用。
    output_columns : dict, optional
        OUTPUT_COLUMNS辞書。指定されない場合はグローバルOUTPUT_COLUMNSを使用
    keep_all_columns : bool, optional
        True のときカラムを絞らず全カラムのまま返す
    **kwargs : dict
        pandas.read_csv または pandas.read_excel に渡す追加のキーワード引数

    Returns
    -------
    df : pandas.DataFrame
        読み込まれたデータフレーム（指定されたカラムのみ、または keep_all_columns 時は全カラム）
    """
    try:
        # ファイルの拡張子を取得し、小文字に変換
        file_extension = os.path.splitext(path)[1].lower()

        if file_extension == ".csv":
            # CSVファイルの場合の処理
            encodings = ["utf-8-sig"]
            for encoding in encodings:
                try:
                    # 各エンコーディングでファイルの読み込みを試みる
                    df = pd.read_csv(
                        path,
                        encoding=encoding,
                        low_memory=False,
                        dtype=str,
                        **kwargs,
                    )
                    break  # 読み込み成功したらループを抜ける
                except UnicodeDecodeError:
                    continue
            else:
                # エンコーディングが見つからなかった場合
                detected_encoding = detect_encoding(path)
                df = pd.read_csv(
                    path, encoding=detected_encoding, dtype=str, **kwargs
                )

        elif file_extension in [".xlsx", ".xls"]:
            # Excelファイルを読み込む
            df = pd.read_excel(path, dtype=str, **kwargs)

        else:
            set_error(ERROR_00003)
            # サポートされていないファイル形式
            raise ValueError(
                f"サポートされていないファイル形式です: {file_extension}"
            )

        if keep_all_columns:
            return df

        # Use provided output_columns or fall back to global OUTPUT_COLUMNS
        columns_to_use = (
            output_columns if output_columns is not None else OUTPUT_COLUMNS
        )

        # 指定されたkeyのOUTPUT_COLUMNSに従ってカラムをフィルタリング
        if key in columns_to_use:
            output_cols = list(
                columns_to_use[key].values()
            )  # OUTPUT_COLUMNSのカラム名リスト
            # 存在しないカラムがあっても問題なく動作するように
            df = df[df.columns.intersection(output_cols)]
        else:
            raise ValueError(
                f"指定されたキー '{key}' が OUTPUT_COLUMNS に存在しません。"
            )

        return df

    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_00004)
            raise Exception(
                "CSV形式（UTF-8 BOM付き）のファイルを入力してください。"
            )
        raise Exception(e)


def handle_optional_file(file, key, main_df, main_address_col, INPUT_COLUMNS):
    """
    任意のファイルが指定されなかった場合、ダミーデータを生成し、ファイルが指定された場合はread_fileを使用する
    """
    if file is None or not os.path.exists(file):
        return generate_dummy_data(
            main_df, main_address_col, INPUT_COLUMNS[key]
        )
    else:
        return read_file(
            file, key
        )  # read_file関数を使用してファイルを読み込む


def generate_dummy_data(main_df, main_address_col, DATA_COLUMNS):
    """
    ダミーデータを生成する関数
    Parameters:
    - main_df: メインのデータフレーム
    - main_address_col: メインデータの住所カラム名
    - columns: 生成するダミーデータのカラム定義
    """

    columns = list(DATA_COLUMNS.keys())

    # 各カラムに対するデフォルト値の辞書
    default_values = {
        "structure": "木造",
        "registration_date": "1990/01/01",
        "suido_number": 999999,
        "usage_status": 1,
        "suido_status_address": "欠損",
        "usage_start_date": 20990331,
        "usage_end_date": "",
        "suido_number2": 999999,
        "meter_reading_date": 20230714,
        "suido_usage": 999,
        "setai_code": 999999,
        "juki_address": "欠損",
        "birth": 20100331,
        "move_date": "2010/01/01",
        "touki_address": "欠損",
        "inheritance_detail": "",
        "extension_detail": "",
    }

    dummy_data = {}
    for col in columns:
        if col == main_address_col:
            # 住所カラムはメインデータからコピー
            dummy_data[col] = main_df[main_address_col]
        else:
            output_col = DATA_COLUMNS[col]
            # default_values辞書にあればその値、なければ"1"を使う
            dummy_data[output_col] = [default_values.get(col, "1")] * len(
                main_df
            )

    return pd.DataFrame(dummy_data)


def process_data(
    input_files,
    output_directory,
    main_data_type,
    job_id,
    columns,
    db_path=None,
    logs_dir=None,
):
    """
    すべてのデータファイルを処理する

    Parameters
    ----------
    suido_status_file : file
        水道ステータスデータファイル
    suido_use_file : file
        水道使用量データファイル
    juki_file : file
        住基データファイル
    touki_file : file
        登記データファイル
    akiya_result_file : file
        空き家結果データファイル
    geocoding_file : file
        ジオコーディングデータファイル

    Returns
    -------
    list
        処理済みファイルのパスリスト
    """
    # 入力ファイルのパスを設定
    # 各ファイルオブジェクトから名前（パス）を取得し、辞書形式で保存
    task_id = None
    logger = None
    try:
        if logs_dir:
            logger = get_rotating_logger(logs_dir, logger_name="E012")
        else:
            logs_dir = os.path.join(output_dir, "logs")
            logger = get_rotating_logger(logs_dir, logger_name="E012")
        sqlite_enabled = False
        if db_path:
            try:
                connect_sqllite(db_path)
                sqlite_enabled = True
            except Exception as e:
                print(
                    f"SQLite接続に失敗しました: {e}. SQLiteを使用せずに続行します。"
                )

        progress_percent = 0
        if sqlite_enabled and job_id:
            task_id = create_or_update_job_task(
                job_id,
                progress_percent="0",
                preprocess_type="e012",
                error_code=None,
                error_msg=None,
                result=None,
            )

        if output_directory is None:
            output_directory = "./E012/outputs"

        os.makedirs(output_directory, exist_ok=True)
        # 出力ファイルのパスを設定
        # 処理後のファイルの保存先パスを辞書形式で定義
        output_paths = {
            "geocoding": f"{output_directory}/geocoding_cleaned.csv"
        }

        if input_files.get("suido_status"):
            output_paths["suido_status"] = (
                f"{output_directory}/suido_status_cleaned.csv"
            )

        if input_files.get("suido_use"):
            output_paths["suido_use"] = (
                f"{output_directory}/suido_use_cleaned.csv"
            )

        if input_files.get("juki"):
            output_paths["juki"] = f"{output_directory}/juki_cleaned.csv"

        if input_files.get("touki"):
            output_paths["touki"] = f"{output_directory}/touki_cleaned.csv"

        if input_files.get("optional_data_source"):
            output_paths["optional_data_source"] = (
                f"{output_directory}/optional_data_source_cleaned.csv"
            )
        if input_files.get("vacant_house"):
            output_paths["vacant_house"] = (
                f"{output_directory}/vacant_house_cleaned.csv"
            )

        OPTIONAL_SOURCE_KEYS = ("optional_data_source", "vacant_house")
        if columns:
            columns = json.loads(columns)
            # Exclude optional_data_source / vacant_house (only have "address", not fixed schema)
            all_values = [
                value
                for k, sub_dict in columns.items()
                if k not in OPTIONAL_SOURCE_KEYS
                for value in sub_dict.values()
            ]
            if all_values:
                set_columns(*all_values)
                set_output_column()

        suido_status_address = INPUT_COLUMNS.get("suido_status").get(
            "suido_status_address"
        )
        juki_address = INPUT_COLUMNS.get("juki").get("juki_address")
        # メインデータを決定
        if main_data_type == "suido_status":
            main_df = read_file(
                input_files.get("suido_status"), "suido_status"
            )
            main_address_col = suido_status_address
        elif main_data_type == "juki":
            main_df = read_file(input_files.get("juki"), "juki")
            main_address_col = juki_address

        if input_files.get("suido_use"):
            suido_use_df = handle_optional_file(
                input_files.get("suido_use"),
                "suido_use",
                main_df,
                main_address_col,
                INPUT_COLUMNS,
            )
        if input_files.get("touki"):
            touki_df = handle_optional_file(
                input_files.get("touki"),
                "touki",
                main_df,
                main_address_col,
                INPUT_COLUMNS,
            )

        if sqlite_enabled and job_id:
            create_or_update_job(job_id, "5")

        try:
            # ファイルを保存して、処理に反映
            if input_files.get("suido_use"):
                suido_use_df.to_csv(
                    f"{output_directory}/processed_suido_use.csv", index=False
                )
            if input_files.get("touki"):
                touki_df.to_csv(
                    f"{output_directory}/processed_touki.csv", index=False
                )
        except Exception as e:
            raise Exception(e)

        # 入力ファイルのパスを設定
        input_paths = {}
        if input_files.get("geocoding"):
            input_paths["geocoding"] = input_files.get("geocoding")

        if input_files.get("suido_status"):
            input_paths["suido_status"] = input_files.get("suido_status")
        if input_files.get("suido_use"):
            input_paths["suido_use"] = (
                f"{output_directory}/processed_suido_use.csv"
            )
        if input_files.get("juki"):
            input_paths["juki"] = input_files.get("juki")
        if input_files.get("touki"):
            input_paths["touki"] = f"{output_directory}/processed_touki.csv"
        if input_files.get("optional_data_source"):
            input_paths["optional_data_source"] = input_files["optional_data_source"]
        if input_files.get("vacant_house"):
            input_paths["vacant_house"] = input_files["vacant_house"]
        if sqlite_enabled and job_id:
            create_or_update_job(job_id, "10")

        # Process optional_data_source / vacant_house: only address column specified, keep all columns
        for opt_key in OPTIONAL_SOURCE_KEYS:
            if opt_key not in input_paths or opt_key not in output_paths:
                continue
            addr_col = (columns or {}).get(opt_key, {}).get("address")
            if not addr_col:
                raise ValueError(
                    f"{opt_key}: columns.address is required"
                )
            df_opt = read_file(input_paths[opt_key], opt_key, keep_all_columns=True)
            if addr_col not in df_opt.columns:
                raise ValueError(
                    f"{opt_key}: column '{addr_col}' not found in file"
                )
            df_opt["normalized_address"] = df_opt[addr_col].apply(
                normalize_address_full
            )
            EachFileProcessor.save_csv(df_opt, output_paths[opt_key])

        # Prepare arguments for parallel processing (exclude optional sources; they are already processed)
        input_paths_core = {
            k: v for k, v in input_paths.items()
            if k not in OPTIONAL_SOURCE_KEYS
        }
        process_args = [
            (
                file_key,
                input_paths_core[file_key],
                output_paths[file_key],
                INPUT_COLUMNS,
                OUTPUT_COLUMNS,
                OUTPUT_COLUMNS_INITIAL,
            )
            for file_key in input_paths_core.keys()
        ]
        num_files = len(process_args)
        n_workers = max(1, cpu_count() // 3)

        # Process files in parallel
        try:
            with ProcessPoolExecutor(max_workers=n_workers) as executor:
                results = list(
                    executor.map(_process, process_args)
                )

            # Check results and handle errors
            for file_key, success, error_msg in results:
                if not success:
                    # Ensure error_msg is a string, not None or list
                    if error_msg is None:
                        error_msg = f"処理中にエラーが発生しました: {file_key}"
                    elif isinstance(error_msg, list):
                        error_msg = str(error_msg) if error_msg else (
                            f"処理中にエラーが発生しました: {file_key}"
                        )
                    else:
                        error_msg = str(error_msg)

                    if "水道使用量" in error_msg:
                        set_error(ERROR_00035)
                    else:
                        file_name = FILE_NAME_JP.get(file_key, file_key)
                        set_error(ERROR_00036, file_name)
                    raise Exception(error_msg)

            # Update progress after all files processed
            progress_percent = 16 * num_files
            progress_percent_job = 10 + 2 * num_files
            if sqlite_enabled and job_id:
                create_or_update_job_task(
                    job_id,
                    progress_percent=str(progress_percent),
                    preprocess_type="e012",
                    error_code=None,
                    error_msg=None,
                    result=None,
                    id=task_id,
                )
                create_or_update_job(job_id, progress_percent_job)

        except Exception as parallel_error:
            if logger:
                logger.warning("Parallel failed:\n%s", traceback.format_exc())
            processor = EachFileProcessor(input_paths, output_paths)
            progress_percent_job = 10
            for file_key in input_paths.keys():
                progress_percent += 16
                progress_percent_job += 2
                processor.process_file(file_key)
                if sqlite_enabled and job_id:
                    create_or_update_job_task(
                        job_id,
                        progress_percent=str(progress_percent),
                        preprocess_type="e012",
                        error_code=None,
                        error_msg=None,
                        result=None,
                        id=task_id,
                    )
                    create_or_update_job(job_id, progress_percent_job)

        if sqlite_enabled and job_id:
            create_or_update_job_task(
                job_id,
                progress_percent="100",
                preprocess_type="e012",
                error_code=None,
                error_msg=None,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
        # 処理済みファイルのパスリストを返す
        # 出力パスのうち、実際にファイルが生成されたもののみをリストにして返す
        return [path for path in output_paths.values() if os.path.exists(path)]
    except Exception as e:
        print(e)
        traceback.print_exc()
        if logger:
            logger.error("E012 failed:\n%s", traceback.format_exc())
        if ERROR_CODE is None:
            set_error(ERROR_00005)
        if task_id is not None:
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type="e012",
                error_code=ERROR_CODE,
                error_msg=ERROR_MSG,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
        raise Exception("データクレンジング処理中にエラーが発生しました。")


def normalize_address(
    input_files,
    output_directory,
    job_id,
    columns,
    db_path=None,
    logs_dir=None,
    municipality=None,
):
    # 入力ファイルのパスを設定
    # 各ファイルオブジェクトから名前（パス）を取得し、辞書形式で保存
    task_id = None
    logger = None
    try:
        if logs_dir:
            logger = get_rotating_logger(logs_dir, logger_name="E012")
        else:
            logs_dir = os.path.join(output_dir, "logs")
            logger = get_rotating_logger(logs_dir, logger_name="E012")
        sqlite_enabled = False
        if db_path:
            try:
                connect_sqllite(db_path)
                sqlite_enabled = True
            except Exception as e:
                print(
                    f"SQLite接続に失敗しました: {e}. SQLiteを使用せずに続行します。"
                )

        progress_percent = 0
        if sqlite_enabled and job_id:
            task_id = create_or_update_job_task(
                job_id,
                progress_percent="0",
                preprocess_type="e012",
                error_code=None,
                error_msg=None,
                result=None,
            )

        if output_directory is None:
            output_directory = "./E012/outputs"

        os.makedirs(output_directory, exist_ok=True)
        # 出力ファイルのパスを設定
        # 処理後のファイルの保存先パスを辞書形式で定義
        output_paths = {}

        if input_files.get("geocoding"):
            output_paths["geocoding"] = (
                f"{output_directory}/geocoding_cleaned.csv"
            )

        if input_files.get("suido_status"):
            output_paths["suido_status"] = (
                f"{output_directory}/suido_status_cleaned.csv"
            )

        if input_files.get("juki"):
            output_paths["juki"] = f"{output_directory}/juki_cleaned.csv"

        if input_files.get("touki"):
            output_paths["touki"] = f"{output_directory}/touki_cleaned.csv"

        if input_files.get("building_type_determination"):
            output_paths["building_type_determination"] = f"{output_directory}/building_type_determination_cleaned.csv"

        if sqlite_enabled and job_id:
            create_or_update_job(job_id, "10")

        input_columns, output_columns = set_input_output_columns(columns)

        # Prepare arguments for parallel processing
        process_args = [
            (
                file_key,
                input_files[file_key],
                output_paths[file_key],
                input_columns,
                input_columns,
                output_columns,
                municipality,
            )
            for file_key in input_files.keys()
        ]
        num_files = len(process_args)
        n_workers = max(1, cpu_count() // 3)

        # Process files in parallel
        try:
            with ProcessPoolExecutor(max_workers=n_workers) as executor:
                results = list(
                    executor.map(_process, process_args)
                )

            # Check results and handle errors
            for file_key, success, error_msg in results:
                if not success:
                    # Ensure error_msg is a string, not None or list
                    if error_msg is None:
                        error_msg = f"処理中にエラーが発生しました: {file_key}"
                    elif isinstance(error_msg, list):
                        error_msg = str(error_msg) if error_msg else (
                            f"処理中にエラーが発生しました: {file_key}"
                        )
                    else:
                        error_msg = str(error_msg)

                    if "水道使用量" in error_msg:
                        set_error(ERROR_00035)
                    else:
                        file_name = FILE_NAME_JP.get(file_key, file_key)
                        set_error(ERROR_00036, file_name)
                    raise Exception(error_msg)

            # Update progress after all files processed
            progress_percent = 16 * num_files
            progress_percent_job = 10 + 2 * num_files
            if sqlite_enabled and job_id:
                create_or_update_job_task(
                    job_id,
                    progress_percent=str(progress_percent),
                    preprocess_type="e012",
                    error_code=None,
                    error_msg=None,
                    result=None,
                    id=task_id,
                )
                create_or_update_job(job_id, progress_percent_job)

        except Exception as parallel_error:
            if logger:
                logger.warning("Parallel failed:\n%s", traceback.format_exc())
            processor = EachFileProcessor(input_files, output_paths, municipality=municipality)
            progress_percent_job = 10
            for file_key in input_files.keys():
                progress_percent += 16
                progress_percent_job += 2
                processor.process_file(file_key)
                if sqlite_enabled and job_id:
                    create_or_update_job_task(
                        job_id,
                        progress_percent=str(progress_percent),
                        preprocess_type="e012",
                        error_code=None,
                        error_msg=None,
                        result=None,
                        id=task_id,
                    )
                    create_or_update_job(job_id, progress_percent_job)

        if sqlite_enabled and job_id:
            create_or_update_job_task(
                job_id,
                progress_percent="100",
                preprocess_type="e012",
                error_code=None,
                error_msg=None,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
        # 処理済みファイルのパスリストを返す
        # 出力パスのうち、実際にファイルが生成されたもののみをリストにして返す
        return [path for path in output_paths.values() if os.path.exists(path)]
    except Exception as e:
        print(e)
        traceback.print_exc()
        if logger:
            logger.error("E012 failed:\n%s", traceback.format_exc())
        if ERROR_CODE is None:
            set_error(ERROR_00005)
        if task_id is not None:
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type="e012",
                error_code=ERROR_CODE,
                error_msg=ERROR_MSG,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
        raise Exception("データクレンジング処理中にエラーが発生しました。")


def set_input_output_columns(columns):
    input_columns = {
        "suido_status": {
            "suido_status_address": columns.get("suido_status", {}).get("suido_status_address"),
            "normalized_address": "normalized_address",
        },
        "juki": {
            "juki_address": columns.get("juki", {}).get("juki_address"),
            "normalized_address": "normalized_address",
        },
        "touki": {
            "touki_address": columns.get("touki", {}).get("touki_address"),
            "normalized_address": "normalized_address",
        },
        "geocoding": {
            "geocoding_address": columns.get("geocoding", {}).get("geocoding_address"),
            "normalized_address": "normalized_address",
        },
        "building_type_determination": {
            "building_type_determination_address": (
                columns.get("building_type_determination", {}).get("building_type_determination_address")
            ),
            "normalized_address": "normalized_address",
        },
    }
    global INPUT_COLUMNS, OUTPUT_COLUMNS
    INPUT_COLUMNS = input_columns
    OUTPUT_COLUMNS = input_columns

    # 出力する各データのカラムを定義
    output_columns = {
        "suido_status": {
            "suido_status_address": "suido_status_address",
            "normalized_address": "normalized_address",
        },
        "juki": {
            "juki_address": "juki_address",
            "normalized_address": "normalized_address",
        },
        "touki": {
            "touki_address": "touki_address",
            "normalized_address": "normalized_address",
        },
        "building_type_determination": {
            "building_type_determination_address": "building_type_determination_address",
            "normalized_address": "normalized_address",
        },
        "geocoding": {
            "geocoding_address": "geocoding_address",
            "normalized_address": "normalized_address",
        },
    }
    global OUTPUT_COLUMNS_INITIAL
    OUTPUT_COLUMNS_INITIAL = output_columns
    return input_columns, output_columns

def set_error(value, param_st1=None, param_st2=None):
    global ERROR_CODE
    global ERROR_MSG
    ERROR_CODE = value["code"]
    if param_st1 is not None and param_st2 is not None:
        ERROR_MSG = value["message"].format(
            param_st1=param_st1, param_st2=param_st2
        )
    elif param_st1 is not None:
        ERROR_MSG = value["message"].format(param_st1=param_st1)
    else:
        ERROR_MSG = value["message"]