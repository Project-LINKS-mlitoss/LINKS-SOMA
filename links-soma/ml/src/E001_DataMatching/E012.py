"""
# E012 名寄せ機能
* アップロードされた住所カラムに該当するすべての列の名寄せ（住所の正規化）をする機能
"""

import copy
import json
import os
import re
import sys
import unicodedata
import argparse
import chardet
import pandas as pd
import warnings

warnings.filterwarnings("ignore")
current_dir = os.path.dirname(os.path.abspath(__file__))
async_tasks_path = os.path.join(current_dir, '..', 'async_tasks')
if async_tasks_path not in sys.path:
    sys.path.append(async_tasks_path)

try:
    from utils import *
    from constants import *
except ImportError:
    sys.path.remove(async_tasks_path)
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))
    from async_tasks.utils import *
    from async_tasks.constants import *

# 入力する各データのカラムを定義
INPUT_COLUMNS = {
    "suido_status": {
        "suido_number": None,
        "usage_status": None,
        "suido_status_address": None,
        "usage_start_date": None,
        "usage_end_date": None
    },
    "suido_use": {
        "suido_number": None,
        "meter_reading_date": None,
        "suido_usage": None,
    },
    "juki": {
        "setai_code": None,
        "juki_address": None,
        "birth": None,
        "gender": None,
        "move_date": None
    },
    "touki": {
        "touki_address": None,
        "structure": None,
        "registration_date": None
    },
    "akiya_result": {
        "akiya_result_address": None,
    },
    "geocoding": {
        "geocoding_address": None,
        "geocoding_lat": None,
        "geocofing_lon": None
    }
}

#　出力する各データのカラムを定義
OUTPUT_COLUMNS = {
    "suido_status": {
        "suido_number": "水道番号",
        "usage_status": "開閉栓区分",
        "suido_status_address": "設置場所",
        "usage_start_date": "使用開始日",
        "usage_end_date": "使用中止日",
        "convert_suido_address": "正規化住所"
    },
    "suido_use": {
        "suido_number": "水道番号",
        "meter_reading_date": "検針年月日",
        "suido_usage": "使用水量",
    },
    "juki": {
        "setai_code": "世帯コード",
        "juki_address": "住所",
        "birth": "生年月日",
        "gender": "性別",
        "move_date":"住定異動年月日",
        "convert_juki_address": "正規化住所"
    },
    "touki": {
        "touki_address": "住所",
        "structure": "登記構造",
        "registration_date": "登記日付",
        "convert_touki_address": "正規化住所"
    },
    "akiya_result": {
        "akiya_result_address": "住所",
        "convert_akiya_address": "正規化住所"
    },
    "geocoding": {
        "geocoding_address": "住所",
        "geocoding_lat": "lat",
        "geocofing_lon": "lon",
        "convert_geo_address": "正規化住所"
    }
}
OUTPUT_COLUMNS_INITIAL = OUTPUT_COLUMNS

FILE_NAME_JP = {
     "suido_status": "水道閉開栓状況",
     "juki": "住民基本台帳",
     "touki": "建物情報",
     "geocoding": "ジオコーディング済みデータ",
     "akiya_result": "空き家調査結果",
}

# 変換用の漢数字と半角数字の対応辞書
kanji_to_number = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, 
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
}

ERROR_CODE=None
ERROR_MSG=None

# データ処理を行うための基本クラス
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
        encodings = ['utf-8-sig']

        # 各エンコーディングで保存を試みる
        for encoding in encodings:
            try:
                # データフレームをCSVとして保存
                df.to_csv(path, encoding=encoding, index=False, errors='replace')
                return
            except Exception as e:
                # エラーが発生した場合、メッセージを表示して次のエンコーディングを試す
                set_error(ERROR_00001, path, encoding)
                raise
    
    def process(self):
        """
        データ処理を実行する抽象メソッド
        サブクラスでこのメソッドを実装する必要がある
        """
        raise NotImplementedError("Subclasses must implement this method")


# データのクリーンアップ用のクラス
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
        # 単独の「ノ」「ケ」「ツ」を置換するための正規表現パターン
        single_no_pattern = r'(?<![ｦ-ﾟ])ﾉ(?![ｦ-ﾟ])|(?<![ァ-ン])ノ(?![ァ-ン])'
        single_ke_pattern = r'(?<![ｦ-ﾟ])ｹ(?![ｦ-ﾟ])|(?<![ァ-ン])ケ(?![ァ-ン])'
        single_tsu_pattern = r'(?<![ｦ-ﾟ])ﾂ(?![ｦ-ﾟ])|(?<![ァ-ン])ツ(?![ァ-ン])'
        if isinstance(text, str):
            text = re.sub(single_no_pattern, "の", text)
            text = re.sub(single_ke_pattern, "が", text)
            text = re.sub(single_tsu_pattern, "つ", text)
        return text
    
    @staticmethod
    def convert_fullwidth_to_halfwidth_digits(text):
        """
        全角数字を半角数字に変換する

        Parameters
        ----------
        text : str or any
            変換対象のテキスト

        Returns
        -------
        str or any
            全角数字が半角数字に変換されたテキスト。
            入力が文字列でない場合は元の値をそのまま返す。
        """
        if isinstance(text, str):
            # 全角数字から半角数字への変換マップ
            fullwidth_to_halfwidth = str.maketrans("０１２３４５６７８９", "0123456789")
            return text.translate(fullwidth_to_halfwidth)
        return text

    @staticmethod
    def convert_address(address):
        """
        住所のフォーマットを変換する。都道府県名、市名、半角と全角スペースを削除。丁目、番地をハイフンに変換。

        Parameters
        ----------
        address : str
            変換対象の住所

        Returns
        -------
        str
            変換された住所
        """
        if isinstance(address, str):        
            # 都道府県名リスト
            prefectures = [
                "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
                "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
                "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
                "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
                "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
                "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
                "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
            ]
            # 都道府県名を削除
            pattern = "^(" + "|".join(map(re.escape, prefectures)) + ")"
            address = re.sub(pattern, "", address)
            
            # 市名を削除（最初に出現する[市]で終わる部分）
            address = re.sub(r'[^\s]+?[市]', '', address, count=1)
            
            # 全角・半角スペースを削除
            address = re.sub(r'[\s　]+', '', address)
            
            # ハイフンを半角ハイフン（U+002D）に変換
            address = re.sub(r'[－—―−]', '-', address)
                
            # 丁目をハイフンに変換
            address = re.sub(r"(\d+)丁目", r"\1-", address)
            
            # 番地をハイフンに変換
            address = re.sub(r"(\d+)番地の(\d+号?)", r"\1-\2", address)
            address = re.sub(r"(\d+)番地?(\d+号?)", r"\1-\2", address)
            address = re.sub(r"(\d+)番地?$", r"\1", address)
            
            # 連続する半角ハイフンを一つに統合
            address = re.sub(r'-+', '-', address)
            
            # 末尾のハイフンを削除
            address = re.sub(r'-$', '', address)
            
            # すべてのピリオド（半角と全角）を削除
            address = re.sub(r'[\u002E\uFF0E]', '', address)
            
            # 「〇丁目」の漢数字部分を半角数字に変換
            address = re.sub(r'([一二三四五六七八九十]+)丁目', kanji_to_chome, address)

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
            変換対象のテキスト

        Returns
        -------
        str
            半角カタカナが全角カタカナに変換されたテキスト
        """
        half_to_full_katakana_map = str.maketrans(
            "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ",
            "ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン゛゜"
        )
        if pd.isna(text):
            return text
        if isinstance(text, str):
            # 半角カタカナを全角カタカナに変換
            text = text.translate(half_to_full_katakana_map)
            # 濁点と半濁点の処理
            text = re.sub(r'(\w゛)', lambda x: chr(ord(x.group(1)[0]) + 1), text)
            text = re.sub(r'(\w゜)', lambda x: chr(ord(x.group(1)[0]) + 2), text)
        return text 
    
    def convert_wareki_to_seireki(date_str):
        """
        和暦を西暦に変換する

        Parameters
        ----------
        date_str : str
            和暦表記の日付（例: "平成25年03月20日"）

        Returns
        -------
        str
            西暦形式に変換された日付（例: "20130320"）
        """
        try:
            # 和暦の元号と対応する西暦の開始年を辞書で定義
            era_dict = {
                '令和': 2019,
                '平成': 1989,
                '昭和': 1926,
                '大正': 1912,
                '明治': 1868
            }

            # 正規表現で和暦表記の日付を検出
            pattern = r'(?P<era>令和|平成|昭和|大正|明治)(?P<year>\d+)年(?P<month>\d{1,2})月(?P<day>\d{1,2})日'
            match = re.match(pattern, date_str)

            if match:
                era = match.group('era')
                year = int(match.group('year'))
                month = int(match.group('month'))
                day = int(match.group('day'))

                # 元号を西暦に変換
                seireki_year = era_dict[era] + year - 1
                return f"{seireki_year:04d}{month:02d}{day:02d}"

            return date_str  # 和暦表記でない場合はそのまま返す
        except:
            return date_str

    @staticmethod
    def convert_short_date_to_full_date(date_str):
        """
        6桁の短縮表記（例: "130320"）を8桁の西暦形式（例: "20130320"）に変換する

        Parameters
        ----------
        date_str : str
            6桁の短縮表記（例: "130320"）

        Returns
        -------
        str
            8桁の西暦形式（例: "20130320"）
        """
        # 6桁の短縮表記の場合（例: "130320"）
        if re.match(r'^\d{6}$', date_str):
            # 1900年代か2000年代かを推定して西暦を補完
            year_prefix = '20' if int(date_str[:2]) < 50 else '19'
            return f"{year_prefix}{date_str[:2]}{date_str[2:4]}{date_str[4:6]}"
        
        return date_str  # 6桁でない場合はそのまま返す

    @staticmethod
    def convert_date_to_seireki(date_str):
        """
        日付を統一して西暦8桁形式に変換する（和暦や短縮表記を対応）

        Parameters
        ----------
        date_str : str
            和暦や短縮表記の日付

        Returns
        -------
        str
            8桁の西暦形式の日付
        """
        try:
            if not isinstance(date_str, str):
                date_str = str(date_str)
            # 和暦をまず変換
            date_str = CleanData.convert_wareki_to_seireki(date_str)
            # 6桁の日付を8桁に変換
            return CleanData.convert_short_date_to_full_date(date_str)
        except:
            return date_str
    

# 各ファイルごとの処理クラス
class EachFileProcessor(DataProcessor):

    # 日付カラムの定義
    date_columns_mapping = {
        "suido_status": ["使用開始日", "使用中止日"],
        "juki": ["生年月日", "住定異動年月日"],
        "touki": ["登記日付"],
        "akiya_result": [],
        "geocoding": []
    }

    def __init__(self, input_paths, output_paths):
        super().__init__(input_paths, output_paths)

    def process_file(self, file_key):
        """
        指定されたファイルキーに対応するファイルを処理する

        Parameters
        ----------
        file_key : str
            処理対象のファイルキー
        """
        # ファイルを読み込む
        df = read_file(self.INPUT_PATHS[file_key], file_key)
        if df is None:
            return
        
        cols = INPUT_COLUMNS[file_key]

        # Rename columns
        rename_columns = {}
        for key, input_col in cols.items():
            new_col = OUTPUT_COLUMNS_INITIAL[file_key].get(key, input_col)
            rename_columns[input_col] = new_col

        if file_key == "suido_use":
            df = df.rename(columns=rename_columns)
            # 入力ファイルのすべてのカラム名を取得
            all_columns = set(df.columns)

            missing_cols = set(OUTPUT_COLUMNS_INITIAL[file_key].values()) - all_columns
            if missing_cols:
                set_error(ERROR_00035)
                raise Exception("水道使用量のデータが異常です。もう一度データを確認ください。")
            
            df = self.convert_japanese_era_to_gregorian(df, file_key)
            
            self.save_csv(df, self.OUTPUT_PATHS[file_key])
        else:
            # 住所列が欠損している行を削除
            df = df.dropna(subset=[cols[f"{file_key}_address"]])
            
            # 住所の正規化処理を適用
            df["正規化住所"] = (df[cols[f"{file_key}_address"]]
                        .apply(CleanData.normalize_text)
                        .apply(CleanData.convert_fullwidth_to_halfwidth_digits)
                        .apply(CleanData.convert_halfwidth_to_fullwidth)
                        .apply(CleanData.replace_single_katakana)
                        .apply(CleanData.convert_address))
            
            df = df.rename(columns=rename_columns)
            # 入力ファイルのすべてのカラム名を取得
            all_columns = set(df.columns)

            missing_cols = set(OUTPUT_COLUMNS_INITIAL[file_key].values()) - all_columns
            file_name = FILE_NAME_JP[file_key]
            if missing_cols:
                set_error(ERROR_00036, file_name)
                raise Exception(f"{file_name}のデータが異常です。もう一度データを確認ください。")
            
            df = self.convert_japanese_era_to_gregorian(df, file_key)
            # 処理結果をCSVファイルとして保存
            self.save_csv(df, self.OUTPUT_PATHS[file_key])

    def convert_japanese_era_to_gregorian(self, df, file_key):
        # 日付カラムの変換を実行
        if file_key in self.date_columns_mapping:
            for date_col in self.date_columns_mapping[file_key]:
                if date_col in df.columns:
                    df[date_col] = df[date_col].apply(CleanData.convert_date_to_seireki)
        
        return df

def set_output_column():
    global OUTPUT_COLUMNS 
    OUTPUT = copy.deepcopy(INPUT_COLUMNS)
    OUTPUT["suido_status"]["convert_suido_address"] = "正規化住所"
    OUTPUT["juki"]["convert_juki_address"] = "正規化住所"
    OUTPUT["touki"]["convert_touki_address"] = "正規化住所"
    OUTPUT["akiya_result"]["convert_akiya_address"] = "正規化住所"
    OUTPUT["geocoding"]["convert_geo_address"] = "正規化住所"
    OUTPUT_COLUMNS = OUTPUT


def set_columns(
    suido_number, usage_status, suido_status_address, usage_start_date, usage_end_date,
    suido_number2, meter_reading_date, suido_usage,
    setai_code, juki_address, birth, gender, move_date,
    touki_address, structure, registration_date,
    akiya_result_address,
    geocoding_address, geocoding_lat, geocoding_lon
):
    """
    ユーザーが選択したカラムをINPUT_COLUMNSに反映
    """
    # suido_statusセクション
    INPUT_COLUMNS["suido_status"]["suido_number"] = suido_number
    INPUT_COLUMNS["suido_status"]["usage_status"] = usage_status
    INPUT_COLUMNS["suido_status"]["suido_status_address"] = suido_status_address
    INPUT_COLUMNS["suido_status"]["usage_start_date"] = usage_start_date
    INPUT_COLUMNS["suido_status"]["usage_end_date"] = usage_end_date
    
    # suido_use
    INPUT_COLUMNS["suido_use"]["suido_number"] = suido_number2
    INPUT_COLUMNS["suido_use"]["meter_reading_date"] = meter_reading_date
    INPUT_COLUMNS["suido_use"]["suido_usage"] = suido_usage


    # jukiセクション
    INPUT_COLUMNS["juki"]["setai_code"] = setai_code
    INPUT_COLUMNS["juki"]["juki_address"] = juki_address
    INPUT_COLUMNS["juki"]["birth"] = birth
    INPUT_COLUMNS["juki"]["gender"] = gender
    INPUT_COLUMNS["juki"]["move_date"] = move_date
    
    # toukiセクション
    INPUT_COLUMNS["touki"]["touki_address"] = touki_address
    INPUT_COLUMNS["touki"]["structure"] = structure
    INPUT_COLUMNS["touki"]["registration_date"] = registration_date
    
    # akiya_resultセクション
    INPUT_COLUMNS["akiya_result"]["akiya_result_address"] = akiya_result_address
    
    # geocodingセクション
    INPUT_COLUMNS["geocoding"]["geocoding_address"] = geocoding_address
    INPUT_COLUMNS["geocoding"]["geocoding_lat"] = geocoding_lat
    INPUT_COLUMNS["geocoding"]["geocofing_lon"] = geocoding_lon
    
    return INPUT_COLUMNS

# 漢数字を数字に変換する関数
def kanji_to_arabic(kanji):
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

def detect_encoding(file_path):
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
    # ファイルの内容を読み込む
    with open(file_path, 'rb') as file:
        raw_data = file.read(100)
    # エンコーディングを検出して返す
    result = chardet.detect(raw_data)
    return result['encoding']


def read_file(path, key, **kwargs):
    """
    ファイルを読み込み、OUTPUT_COLUMNSに指定されたカラムのみを残す

    Parameters
    ----------
    path : str
        読み込むファイルのパス
    key : str
        OUTPUT_COLUMNSのキー（例: "suido_status"）
    **kwargs : dict
        pandas.read_csv または pandas.read_excel に渡す追加のキーワード引数

    Returns
    -------
    df : pandas.DataFrame
        読み込まれたデータフレーム（指定されたカラムのみ残す）、エラー時はNone
    """
    try:
        # ファイルの拡張子を取得し、小文字に変換
        file_extension = os.path.splitext(path)[1].lower()
        
        if file_extension == '.csv':
            # CSVファイルの場合の処理
            encodings = ['utf-8-sig']
            for encoding in encodings:
                try:
                    # 各エンコーディングでファイルの読み込みを試みる
                    df = pd.read_csv(path, encoding=encoding, low_memory=False, dtype=str, **kwargs)
                    break  # 読み込み成功したらループを抜ける
                except UnicodeDecodeError:
                    continue
            else:
                # エンコーディングが見つからなかった場合
                detected_encoding = detect_encoding(path)
                df = pd.read_csv(path, encoding=detected_encoding, dtype=str, **kwargs)
        
        elif file_extension in ['.xlsx', '.xls']:
            # Excelファイルを読み込む
            df = pd.read_excel(path, dtype=str, **kwargs)
        
        else:
            set_error(ERROR_00003)
            # サポートされていないファイル形式
            raise ValueError(f"サポートされていないファイル形式です: {file_extension}")

        # 指定されたkeyのOUTPUT_COLUMNSに従ってカラムをフィルタリング
        if key in OUTPUT_COLUMNS:
            output_columns = list(OUTPUT_COLUMNS[key].values())  # OUTPUT_COLUMNSのカラム名リスト
            # 存在しないカラムがあっても問題なく動作するように
            df = df[df.columns.intersection(output_columns)]
        else:
            raise ValueError(f"指定されたキー '{key}' が OUTPUT_COLUMNS に存在しません。")

        return df

    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_00004)
        raise


def handle_optional_file(file, key, main_df, main_address_col, INPUT_COLUMNS):
    """
    任意のファイルが指定されなかった場合、ダミーデータを生成し、ファイルが指定された場合はread_fileを使用する
    """
    if file is None or not os.path.exists(file):
        return generate_dummy_data(main_df, main_address_col, INPUT_COLUMNS[key])
    else:
        return read_file(file, key)  # read_file関数を使用してファイルを読み込む


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
        "suido_usage": 	999,
        "setai_code": 999999, 
        "juki_address": "欠損", 
        "birth": 20100331, 
        "gender": 1, 
        "move_date": "2010/01/01",
        "touki_address": "欠損"
    }
    
    dummy_data = {}
    for col in columns:
        if col == main_address_col:
            # 住所カラムはメインデータからコピー
            dummy_data[col] = main_df[main_address_col]
        else:
            output_col = DATA_COLUMNS[col]
            # default_values辞書にあればその値、なければ"1"を使う
            dummy_data[output_col] = [default_values.get(col, '1')] * len(main_df)

    return pd.DataFrame(dummy_data)



def process_data(input_files, output_directory, main_data_type, job_id, columns, db_path=None):
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
    try:
        if db_path:
            connect_sqllite(db_path)
        task_id = None
        progress_percent = 0
        if job_id:
            task_id = create_or_update_job_task(job_id, progress_percent="0", preprocess_type="e012", error_code=None, error_msg=None, result=None)

        if output_directory is None:
            output_directory = './E012/outputs'
        
        os.makedirs(output_directory, exist_ok=True)
        # 出力ファイルのパスを設定
        # 処理後のファイルの保存先パスを辞書形式で定義
        output_paths = {
            "akiya_result": f"{output_directory}/akiya_result_cleaned.csv",
            "geocoding": f"{output_directory}/geocoding_cleaned.csv"
        }
        
        if input_files.get('suido_status'):
            output_paths['suido_status'] = f"{output_directory}/suido_status_cleaned.csv"
        
        if input_files.get('suido_use'):
            output_paths['suido_use'] = f"{output_directory}/suido_use_cleaned.csv"
        
        if input_files.get('juki'):
            output_paths['juki'] = f"{output_directory}/juki_cleaned.csv"
            
        if input_files.get('touki'):
            output_paths['touki'] = f"{output_directory}/touki_cleaned.csv"

        if columns:
            columns = json.loads(columns)
            all_values = [value for sub_dict in columns.values() for value in sub_dict.values()]
            set_columns(*all_values)
            set_output_column()
        
        suido_status_address = INPUT_COLUMNS.get('suido_status').get('suido_status_address')
        juki_address = INPUT_COLUMNS.get('juki').get('juki_address')
        # メインデータを決定
        if main_data_type == "suido_status":
            main_df = read_file(input_files.get('suido_status'), "suido_status")
            main_address_col = suido_status_address
        elif main_data_type == "juki":
            main_df = read_file(input_files.get('juki'), "juki")
            main_address_col = juki_address

        if input_files.get('suido_use'):
            suido_use_df = handle_optional_file(input_files.get('suido_use'), "suido_use", main_df, main_address_col, INPUT_COLUMNS)
        if input_files.get('touki'):
            touki_df = handle_optional_file(input_files.get('touki'), "touki", main_df, main_address_col, INPUT_COLUMNS)
        akiya_result_df = handle_optional_file(input_files.get('akiya_result'), "akiya_result", main_df, main_address_col, INPUT_COLUMNS)
        geocoding_df = handle_optional_file(input_files.get('geocoding'), "geocoding", main_df, main_address_col, INPUT_COLUMNS)
        
        if job_id:
            create_or_update_job(job_id, "5")
            
        try:
            # ファイルを保存して、処理に反映
            if input_files.get('suido_use'):
                suido_use_df.to_csv(f"{output_directory}/processed_suido_use.csv", index=False)
            if input_files.get('touki'):
                touki_df.to_csv(f"{output_directory}/processed_touki.csv", index=False)
            geocoding_df.to_csv(f"{output_directory}/processed_geocoding.csv", index=False)
            akiya_result_df.to_csv(f"{output_directory}/processed_akiya_result.csv", index=False)
        except:
            raise

        # 入力ファイルのパスを設定
        input_paths = {
            "akiya_result": f"{output_directory}/processed_akiya_result.csv",
            "geocoding": f"{output_directory}/processed_geocoding.csv"
        }
        
        if input_files.get('suido_status'):
            input_paths['suido_status'] = input_files.get('suido_status')
        if input_files.get('suido_use'):
            input_paths['suido_use'] = f"{output_directory}/processed_suido_use.csv"
        if input_files.get('juki'):
            input_paths['juki'] = input_files.get('juki')
        if input_files.get('touki'):
            input_paths['touki'] = f"{output_directory}/processed_touki.csv"
        if job_id:
            create_or_update_job(job_id, "10")
        # EachFileProcessorインスタンスを作成
        # 入力パスと出力パスを引数として、ファイル処理用のオブジェクトを生成
        processor = EachFileProcessor(input_paths, output_paths)
        progress_percent_job = 10
        # 各データファイルを順番に処理
        for file_key in input_paths.keys():
            progress_percent += 16
            progress_percent_job += 2
            # EachFileProcessorのprocess_fileメソッドを呼び出して各ファイルを処理
            processor.process_file(file_key)
            if job_id:
                create_or_update_job_task(job_id, progress_percent=str(progress_percent), preprocess_type="e012", error_code=None, error_msg=None, result=None, id= task_id)
                create_or_update_job(job_id, progress_percent_job)
                
        if job_id:
            create_or_update_job_task(job_id, progress_percent="100", preprocess_type="e012", error_code=None, error_msg=None, result=json.dumps({}), id= task_id, is_finish=True)
        # 処理済みファイルのパスリストを返す
        # 出力パスのうち、実際にファイルが生成されたもののみをリストにして返す
        return [path for path in output_paths.values() if os.path.exists(path)]
    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_00005)
        if task_id is not None:
            create_or_update_job_task(job_id, progress_percent="", preprocess_type="e012", error_code=ERROR_CODE, error_msg=ERROR_MSG, result=json.dumps({}), id= task_id, is_finish=True)
        raise Exception("データクレンジング処理中にエラーが発生しました。")

def set_error(value, param_st1=None, param_st2=None):
    global ERROR_CODE
    global ERROR_MSG
    ERROR_CODE = value['code']
    if param_st1 is not None and param_st2 is not None:
        ERROR_MSG = value['message'].format(param_st1=param_st1, param_st2=param_st2)
    elif param_st1 is not None:
        ERROR_MSG = value['message'].format(param_st1=param_st1)
    else:
        ERROR_MSG = value['message']
        

        
