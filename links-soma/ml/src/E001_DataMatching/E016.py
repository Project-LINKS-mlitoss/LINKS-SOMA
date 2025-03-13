"""
# E016 空間結合機能
* ２つ以上の地理的な位置情報を持つ異なるインプットデータに対して、地理的な重なり関係から結合処理を行う機能。

* インプットデータに対して緯度経度、地番住所、住居表示等を用いたジオコーディング処理（住所や地名から緯度経度といった地理座標を付与すること）を行い、これらを空間結合する機能.
* 空間結合ではポリゴンデータとポイントデータにおける結合を対象とし、交差結合を基本とする。位置精度によるずれを防ぐため、最近傍結合も考慮するものとする。
* 住居IDを付与する。住居IDは戸建と共同住宅の部屋を対象に付与される。IDの生成方法は空間結合先である空き家基盤データの建築物IDを基準とし、建築物IDに4桁からなるランダムな16進数の文字列をハイフンを入れて付与する。
* 結合処理後、空間結合の結合率を算出する。結合率は水道のポイントデータ件数を分母とし、そのポイントで建物データに結合されたものを分子として計算を行う。 

# 現在のスコープ
* plateuの建物データに水道利用量データ（ポイント）を空間結合する。（最近傍処理）
* 結合割合計算（水道データ）
"""

import json
import math
import os
import random
import string
import sys
import uuid
import chardet
import geopandas as gpd
import pandas as pd
import zipfile
import shutil
from shapely import wkt, wkb
from shapely.geometry import Point
from pyproj import CRS, Transformer
from shapely.ops import transform
from pandas.errors import ParserError
import fiona
import warnings

pd.set_option("display.max_columns", None)
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

pd.set_option("display.max_columns", None)

# 水道データ結合の際の、オプション。0；交差結合、1:最近傍結合
option = 0

PREF_TO_COORD_NUMBER = {
    "長崎県": 1,
    "福岡県": 2, "佐賀県": 2, "熊本県": 2, "大分県": 2, "宮崎県": 2,
    "山口県": 3, "島根県": 3, "広島県": 3,
    "香川県": 4, "愛媛県": 4, "徳島県": 4, "高知県": 4,
    "兵庫県": 5, "鳥取県": 5, "岡山県": 5,
    "京都府": 6, "大阪府": 6, "福井県": 6, "滋賀県": 6, "三重県": 6, "奈良県": 6, "和歌山県": 6,
    "石川県": 7, "富山県": 7, "岐阜県": 7, "愛知県": 7,
    "新潟県": 8, "長野県": 8, "山梨県": 8, "静岡県": 8,
    "福島県": 9, "栃木県": 9, "茨城県": 9, "埼玉県": 9, "千葉県": 9, "群馬県": 9, "神奈川県": 9,
    "青森県": 10, "秋田県": 10, "山形県": 10, "岩手県": 10, "宮城県": 10,
}

NUMBER_1_CITIES = {
    "十島村", "喜界町", "奄美市", "龍郷町", "大和村", "宇検村", "瀬戸内町","三島村","里村","上甑村","下甑村","鹿島村"
    "天城町", "徳之島町", "伊仙町", "和泊町", "知名町", "与論町","名瀬市","住用村","笠利町"
}

NUMBER_11_CITIES = {
    "小樽市", "函館市", "伊達市", "北斗市","大滝村","上磯町","大野町","郡戸井町","恵山町","椴法華村","南茅部町",
    "島牧村", "寿都町", "黒松内町", "蘭越町", "ニセコ町", "真狩村", "留寿都村", "喜茂別町", "京極町", "俱知安町", "共和町", "岩内町","倶知安町",
    "泊村", "神恵内村", "積丹町", "古平町", "仁木町", "余市町", "赤井川村",
    "豊浦町", "壮瞥町", "洞爺湖町","虻田町","洞爺村",
    "松前町", "福島町", "知内町", "木古内町", "七飯町", "鹿部町", "森町", "八雲町", "長万部町","熊石町","砂原町",
    "江差町", "上ノ国町", "厚沢部町", "乙部町", "奥尻町", "今金町", "せたな町","大成町","瀬棚町","北檜山町"
}

NUMBER_13_CITIES = {
    "北見市", "帯広市", "釧路市", "網走市", "根室市","端野町","留辺蘂町","常呂町","阿寒町","音別町",
    "美幌町", "津別町", "斜里町", "清里町", "小清水町", "訓子府町", "置戸町", "佐呂間町", "大空町","東藻琴村","女満別町", 
    "音更町", "士幌町", "上士幌町", "鹿追町", "新得町", "清水町", "芽室町", "中札内村", "更別村", "大樹町", "広尾町", "幕別町","忠類村",
    "池田町", "豊頃町", "本別町", "足寄町", "陸別町", "浦幌町",
    "釧路町", "厚岸町", "浜中町", "標茶町", "弟子屈町", "鶴居村", "白糠町",
    "別海町", "中標津町", "標津町", "羅臼町",
    "色丹村", "泊村", "留夜別村", "留別村", "紗那村", "蘂取村",
}

NUMBER_14_CITIES = {
    "小笠原村"
}

NUMBER_16_CITIES = {
    "宮古島市", "多良間村", "石垣市", "竹富町", "与那国町","平良市","城辺町","下地町","上野村","伊良部町"
}

NUMBER_17_CITIES = {
    "北大東村", "南大東村"
}

ERROR_CODE=None
ERROR_MSG=None

@staticmethod
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

def read_file(path: str, **kwargs) -> pd.DataFrame:
    """
    ファイルを読み込む
    
    Parameters
    ----------
    path : str
        読み込むファイルのパス
    **kwargs : dict
        pandas.read_csv に渡す追加のキーワード引数
    
    Returns
    -------
    pd.DataFrame
        読み込まれたデータフレーム、エラー時はNone
    """
    try:
        # ファイルの拡張子を取得し、小文字に変換
        file_extension = os.path.splitext(path)[1].lower()
        
        allowed_file_extension = ['.shp','.gpkg','.geojson','.csv']
        # allowed_file_extensionファイル以外の場合はエラーを発生させる
        if file_extension not in allowed_file_extension:
            set_error(ERROR_00021)
            raise ValueError(f"shapefile, GeoPackage, CSV形式以外のファイル形式には対応していません。: {file_extension}")
        
        # 複数のエンコーディングを試行                
        encodings = [
                        'utf-8-sig','euc_jp','shift_jis','cp932','shift_jis_2004','shift_jisx0213',
                        'euc_jis_2004','euc_jisx0213','iso2022_jp','iso2022_jp_1','iso2022_jp_2',
                        'iso2022_jp_2004','iso2022_jp_3','iso2022_jp_ext',
                    ]
        for encoding in encodings:
            try:
                # 各エンコーディングでファイルの読み込みを試みる
                if file_extension == '.csv':
                    return pd.read_csv(path, encoding=encoding, **kwargs)
                else:
                    with fiona.Env(encoding=encoding):
                        return gpd.read_file(path)
            except UnicodeDecodeError:
                # デコードエラーが発生した場合、次のエンコーディングを試す
                continue
            except ParserError:
                # ParserErrorが発生した場合、次のエンコーディングを試す
                continue
        
        # 自動でエンコーディングを検出し、再度読み込みを試みる
        detected_encoding = detect_encoding(path)
        if detected_encoding:
            return pd.read_csv(path, encoding=detected_encoding, **kwargs)
        
        # 適切なエンコーディングが見つからない場合、エラーを発生させる
        set_error(ERROR_00025, path)
        raise ValueError(f"適切なエンコーディングが見つかりませんでした: {path}")
    except Exception as e:
        # 何らかの例外が発生した場合、エラーメッセージを表示してNoneを返す
        if ERROR_CODE is None:
            set_error(ERROR_00014, path)
        raise

def load_and_process_data(file_path, crs, geometry, file_type, data_type):
    """
    ファイルを読み込み、ジオメトリデータを処理してGeoDataFrameを作成する。

    Parameters
    ----------
    file_path : str
        読み込むファイルのパス。

    Returns
    -------
    GeoDataFrame
        処理されたジオメトリデータを含むGeoDataFrame。
    """

    file_extension = file_type
    detect_ext = file_path.split('.')[-1].lower()
    if not file_extension:
        file_extension = detect_ext
    if detect_ext is not None and file_extension == "csv" and detect_ext != file_extension:
        set_error(ERROR_00041)
        raise KeyError("ファイル形式のデータが異常です。誤ったファイルを読み込んでいないかもう一度データを確認ください。")

    if file_extension == 'csv':
        # CSVファイルを読み込む
        df = read_file(file_path)
        if df is None:
            raise ValueError(f"ファイルの読み込みに失敗しました: {file_path}")

        if geometry in df.columns:
             # geometry列が文字列のデータのみを保持
            df = df[df[geometry].apply(lambda x: isinstance(x, str))]
            # geometry列をWKT形式からShapely geometryオブジェクトに変換
            df[geometry] = df[geometry].apply(parse_wkt)
        # geometry列が存在するか確認
        elif 'geometry' in df.columns:
            # geometry列が文字列のデータのみを保持
            df = df[df['geometry'].apply(lambda x: isinstance(x, str))]
            # geometry列をWKT形式からShapely geometryオブジェクトに変換
            df['geometry'] = df['geometry'].apply(parse_wkt)
        else:
            # lat/lon列からgeometry列を作成
            if 'lat_geocoding_cleaned' in df.columns and 'lon_geocoding_cleaned' in df.columns:
                df['geometry'] = df.apply(
                    lambda row: Point(row['lon_geocoding_cleaned'], row['lat_geocoding_cleaned'])
                    if pd.notna(row['lat_geocoding_cleaned']) and pd.notna(row['lon_geocoding_cleaned'])
                    else None, axis=1
                )
            else:
                set_error(ERROR_00024)
                raise KeyError("'geometry' 列または 'lat_geocoding_cleaned' と 'lon_geocoding_cleaned' 列が必要です")

        # 無効なジオメトリを除外
        df = df[df['geometry'].notnull()]
        if df is None:
            set_error(ERROR_00042)
            raise KeyError("ジオメトリーカラムのデータが異常です。誤ったファイルを読み込んでいないかもう一度データを確認ください。")
        if data_type == 'plateau':
            try:
                df['building_id'] = df['buildingID'].astype(str)
                del df['buildingID']
            except:
                set_error(ERROR_00030)
                raise
        else:
            if 'building_id' not in df.columns:
                df['building_id'] = df.index + 1
            df['building_id'] = df['building_id'].astype(str)

        # GeoDataFrameを作成
        gdf = gpd.GeoDataFrame(df, geometry='geometry', crs=4326)
        return gdf

    elif file_extension in ['zip', 'shp', 'shapefile'] or detect_ext == 'zip':
        # ZIPファイルかどうかを確認し、処理
        temp_folder = str(uuid.uuid4())
        temp_dir = os.path.join(os.getcwd(), temp_folder)
        os.makedirs(temp_dir, exist_ok=True)

        extracted_files = extract_zip(file_path, temp_dir)
        shp_file = extracted_files.get('shp', None)

        if not shp_file:
            set_error(ERROR_00033)
            raise KeyError("本処理でサポートしているファイルフォーマットは、shp形式(zip形式)、gpkg形式、csv形式（geometryカラム付）のみとなります。")
        else:
            # shapefileを読み込む
            gdf = read_file(shp_file)

        if gdf.crs is None:
            # データのCRSを指定（EPSG:4326）
            gdf.set_crs(crs, inplace=True)

        shutil.rmtree(temp_dir)
        # buildingID列を追加
        if data_type == 'plateau':
            try:
                gdf['building_id'] = gdf['buildingID'].astype(str)
                del gdf['buildingID']
            except:
                set_error(ERROR_00030)
                raise
        else:
            if 'building_id' not in gdf.columns:
                gdf['building_id'] = gdf.index + 1
            gdf['building_id'] = gdf['building_id'].astype(str)

        return gdf

    else:
        # その他の非CSVファイルを読み込む
        gdf = read_file(file_path)

        if gdf.crs is None:
            # データのCRSを指定（EPSG:4326）
            gdf.set_crs(crs, inplace=True)

        # buildingID列を追加
        if data_type == 'plateau':
            try:
                gdf['building_id'] = gdf['buildingID'].astype(str)
                del gdf['buildingID']
            except:
                set_error(ERROR_00030)
                raise
        else:
            if 'building_id' not in gdf.columns:
                gdf['building_id'] = gdf.index + 1
            gdf['building_id'] = gdf['building_id'].astype(str)

        return gdf


def get_transformer(pref: str, city: str) -> int:
    """
    自治体名から、使うべきEPSGコードを返す
    
    Parameters
    ----------
    pref : str
        都道府県名
    city : str
        市区町村名
        
    Returns
    -------
    int
        該当する地域のEPSGコード
    """
    # 都道府県名と市区町村名から座標系番号を取得
    number = get_coordinate_system_number(pref, city)
    # 座標系番号からEPSGコードを取得して返す
    return get_epsg(number)

def get_epsg(coordinate_system_number: int) -> int:
    """
    平面直角座標系の番号からEPSGコードを返す
    
    Parameters
    ----------
    coordinate_system_number : int
        平面直角座標系の番号 (1-19に対応するI-XIX)
        
    Returns
    -------
    int
        対応するEPSGコード
    """
    # 平面直角座標系の番号に6668を加算してEPSGコードを生成
    return 6668 + coordinate_system_number

def get_coordinate_system_number(pref: str, city: str) -> int:
    """
    自治体名から、使うべき平面直角座標系コード(I, II, III, ..., XIX)を返す
    
    Parameters
    ----------
    pref : str
        自治体の都道府県名
    city : str
        自治体の市区町村名
        
    Returns
    -------
    int
        該当する平面直角座標系コード
    """
    if result := PREF_TO_COORD_NUMBER.get(pref):
        return result

    if pref == "鹿児島県":
        if any(city_part in city for city_part in NUMBER_1_CITIES):
            return 1
        return 2
    if pref == "東京都":
        if any(city_part in city for city_part in NUMBER_14_CITIES):
            return 14
        return 9
        # 沖ノ鳥島(18), 南鳥島(19)は小笠原村だが、父島で代表させるので該当なし
    if pref == "北海道":
        if any(city_part in city for city_part in NUMBER_11_CITIES):
            return 11
        if any(city_part in city for city_part in NUMBER_13_CITIES):
            return 13
        return 12
    if pref == "沖縄県":
        if any(city_part in city for city_part in NUMBER_16_CITIES):
            return 16
        if any(city_part in city for city_part in NUMBER_17_CITIES):
            return 17
        return 15

def parse_wkt(wkt_str):
    """
    WKT (Well-Known Text) 文字列を解析してジオメトリオブジェクトを生成する
    
    Parameters
    ----------
    wkt_str : str
        解析するWKT文字列
        
    Returns
    -------
    Geometry
        WKT文字列から生成されたジオメトリオブジェクト
    """
    try:
        return wkt.loads(wkt_str)
    except Exception as e:
        set_error(ERROR_00015)
        raise

def extract_zip(zip_file, extract_to):
    """
    zipファイルを解凍し、解凍されたファイルのパスを返す関数。
    
    Parameters:
    -----------
    zip_file : str
        zipファイルのパス。
    extract_to : str
        解凍先のディレクトリ。

    Returns:
    --------
    dict
        解凍された各ファイルのパス。
    """
    with zipfile.ZipFile(zip_file, 'r') as zip_ref:
        zip_ref.extractall(extract_to)

    def find_shp_file_in_root(directory):
        for file in os.listdir(directory):
            if file.endswith(".shp"):
                return directory
        return None

    def find_shp_file_in_subfolders(directory):
        for root, dirs, files in os.walk(directory):
            for file in files:
                if file.endswith(".shp"):
                    return root
        return None

    temp_dir = find_shp_file_in_root(extract_to)
    if not temp_dir:
        temp_dir = find_shp_file_in_subfolders(extract_to)

    files = os.listdir(temp_dir)

    shp_files = [os.path.join(temp_dir, f) for f in files if f.endswith(".shp")]
    shx_files = [os.path.join(temp_dir, f) for f in files if f.endswith(".shx")]
    dbf_files = [os.path.join(temp_dir, f) for f in files if f.endswith(".dbf")]
    prj_files = [os.path.join(temp_dir, f) for f in files if f.endswith(".prj")]

    shp_file = shp_files[0] if shp_files else None
    shx_file = shx_files[0] if shx_files else None
    dbf_file = dbf_files[0] if dbf_files else None
    prj_file = prj_files[0] if prj_files else None

    return {
        "shp": shp_file,
        "shx": shx_file,
        "dbf": dbf_file,
        "prj": prj_file
    }

def transform_to_wgs84(geometries, source_crs):
    """
    GeoDataFrame全体のジオメトリをWGS84に変換する高速版
    Parameters
    ----------
    geometries : GeoSeries
        入力ジオメトリの列
    source_crs : int or str
        入力座標参照系 (EPSGコードなど)
    
    Returns
    -------
    GeoSeries
        WGS84に変換されたジオメトリの列
    """
    # Transformerを事前に作成
    transformer = Transformer.from_crs(source_crs, CRS.from_epsg(4326), always_xy=True)

    # shapelyのtransformを使って座標変換
    return geometries.apply(lambda geom: transform(transformer.transform, geom) if geom and not geom.is_empty else None)

def _drop_z(geom):
    if geom is not None and hasattr(geom, "is_empty") and not geom.is_empty:
        return wkb.loads(wkb.dumps(geom, output_dimension=2))
    return geom  # 無効なジオメトリまたは空のジオメトリはそのまま返す

def assign_points_to_buildings(buildings_gdf, points_gdf, mul, crs, point_selected_column, option):
    """
    建物のジオメトリとポイントのジオメトリを結合し、ポイントを建物に割り当てる
    
    Parameters
    ----------
    buildings_gdf : GeoDataFrame
        建物のジオメトリを含むGeoDataFrame
    points_gdf : GeoDataFrame
        ポイントのジオメトリを含むGeoDataFrame
    mul : float
        バッファ半径を計算するための乗数
    crs : int
        座標参照系
    point_selected_column : str
        ポイントの選択列名
    option : int
        結合オプション (1: 最近接結合, それ以外: 干渉結合)
        
    Returns
    -------
    tuple
        結合後のGeoDataFrameと結合率を含むタプル
    """
    # 結合するカラムを指定
    points_gdf = points_gdf[point_selected_column]

    # バッファ作成の準備
    # 重心の計算
    buildings_gdf["centroid"] = buildings_gdf["geometry"].centroid
    # 面積の計算
    buildings_gdf["area"] = buildings_gdf["geometry"].area
    
    # ここで面積の足切りを行う
    # 工場等との結合が行われないようにするために1000m2以上のものは削除する
    # 平面直角座標を用いて面積を取得しているのでそのまま足切りが行える
    buildings_gdf = buildings_gdf[buildings_gdf['area'] < 10000] 

    # 重心から面積と同サイズのバッファを生成
    rad = (mul * buildings_gdf["area"] / math.pi) ** 0.5

    # bufferをgeometryにする（空間結合の準備）
    buildings_gdf["buffer"] = buildings_gdf["centroid"].buffer(rad)
    buildings_gdf = buildings_gdf.set_geometry("buffer")

    # points_gdfにID付与（空間結合後の重複削除のために、重心との距離計算をするための準備）
    points_gdf['ID'] = range(1, len(points_gdf) + 1)
    # クイックルックアップのための辞書を作成する
    geometry_dict = points_gdf.set_index('ID')['geometry'].to_dict()

    # 結合オプションを設定（0: 交差結合、1: 最近傍結合）
    if option == 1:
        # 空間インデックスを作成
        if not points_gdf.has_sindex:
            points_gdf.sindex
        if not buildings_gdf.has_sindex:
            buildings_gdf.sindex
        joined = gpd.sjoin_nearest(points_gdf, buildings_gdf,  how='left', distance_col='distance')
        # 複数に結合しているものを削除
        joined = joined.sort_values(by='distance').drop_duplicates(subset='ID', keep='first')
        if 'geometry_right' in joined.columns:
            joined = joined.rename(columns={'geometry_left': 'geometry', 'geometry_right': 'geometry_plateau'})
        else:
            buildings_gdf = buildings_gdf.rename(columns={'geometry': 'geometry_plateau'})
            joined = joined.merge(buildings_gdf[['right_geometry']], left_on='index_right', right_index=True, how='left')
        # 不要な列を削除
        columns_to_drop = ["index_right", "buffer", "centroid", "area"]
        joined = joined.drop(columns=[col for col in columns_to_drop if col in joined.columns])
        combined_gdf = joined

        # geometry_plateau を GeoSeries として扱う
        combined_gdf['geometry_plateau'] = gpd.GeoSeries(
            combined_gdf['geometry_plateau'], crs=combined_gdf.crs
        ).transform(_drop_z)
        combined_gdf['geometry_plateau'] = transform_to_wgs84(
            gpd.GeoSeries(combined_gdf['geometry_plateau'], crs=combined_gdf.crs), crs
        )
        combined_gdf = gpd.GeoDataFrame(combined_gdf, geometry='geometry')
        if 'building_id_left' in combined_gdf.columns and 'building_id' not in combined_gdf.columns:
            combined_gdf.rename(columns={'building_id_left': 'building_id'}, inplace=True)

    else:
        # 空間結合(交差)の実行（ここで、水道のデータが2つ以上結合されている場合があるので、最も近いもののみを残す）
        joined = gpd.sjoin(points_gdf, buildings_gdf, how='left', predicate='intersects')
        
        # 距離を計算します。IDがNaNでない場合のみ計算します。
        joined["distance"] = joined.apply(lambda row: row["centroid"].distance(geometry_dict[row["ID"]]) if row["centroid"] is not None and row["ID"] in geometry_dict else None, axis=1)
        #　sjoinでindexが重複しているので、リセット
        joined = joined.reset_index(drop=True)
        if 'building_id_left' in joined.columns and 'building_id' not in joined.columns:
            if 'building_id_right' in joined.columns:
                joined = joined.rename(columns={'building_id_right': 'building_id'})
            else:
                joined = joined.rename(columns={'building_id_left': 'building_id'})

        # IDが存在する行
        filtered_gdf = joined.dropna(subset=['ID'])
        
        # IDが存在しない行
        dropped_rows = joined[joined['ID'].isna()]
        
        # IDが存在する行で'buildingID'をキーにして、'distance'が最小のものを抽出(空間結合による重複を削除)
        result_gdf = joined.loc[filtered_gdf.groupby('building_id')['distance'].idxmin().tolist()]
        
        # IDあり（重複解消済み）とIDなしの結合
        combined_gdf = pd.concat([dropped_rows, result_gdf])
        
        # 結合後にgeometryの列名が変わるので修正
        if 'geometry_right' in combined_gdf.columns:
            combined_gdf = combined_gdf.rename(columns={'geometry_left': 'geometry', 'geometry_right': 'geometry_plateau'})
        else:
            buildings_gdf = buildings_gdf.rename(columns={'geometry': 'geometry_plateau'})
            combined_gdf = combined_gdf.merge(buildings_gdf[['right_geometry']], left_on='index_right', right_index=True, how='left')

        combined_gdf['geometry_plateau'] = gpd.GeoSeries(
            combined_gdf['geometry_plateau'], crs=combined_gdf.crs
        ).transform(_drop_z)
        combined_gdf['geometry_plateau'] = transform_to_wgs84(
            gpd.GeoSeries(combined_gdf['geometry_plateau'], crs=combined_gdf.crs), crs
        )
        # 建物のジオメトリに設定しなおして、GeoDataFrameに変換
        combined_gdf = gpd.GeoDataFrame(combined_gdf, geometry='geometry')

        # 不要な列を削除
        columns_to_drop = ["centroid", "area", "index_left", "index_right", "buffer", "distance"]
        combined_gdf = combined_gdf.drop(columns=[col for col in columns_to_drop if col in combined_gdf.columns])
    
    combined_gdf.to_crs(4326, inplace=True)
    # 結合率の算出
    num_points = points_gdf.shape[0]
    unique_values_count = combined_gdf["ID"].nunique()
    join_ratio = round(unique_values_count/num_points*100, 2)
    combined_gdf = combined_gdf.drop(columns=["ID"])
    return combined_gdf, join_ratio

def generate_random_string(length=4):
    """
    指定された長さのランダムな文字列を生成する

    Parameters
    ----------
    length : int
        生成する文字列の長さ（デフォルトは4）

    Returns
    -------
    str
        ランダムに生成された文字列
    """
    # 使用する文字のセット（英数字）を定義
    characters = string.ascii_letters + string.digits
    # 指定された長さのランダムな文字列を生成して返す
    return ''.join(random.choice(characters) for i in range(length))

def add_residenceID(gdf):
    """
    GeoDataFrameにresidenceID列を追加する

    Parameters
    ----------
    gdf : GeoDataFrame
        GeoDataFrame、'buildingID'列を含む必要がある
    """
    # 'buildingID'列とランダムに生成された文字列を結合して'residenceID'列を作成
    gdf = gdf.reset_index(drop=True)
    gdf['residenceID'] = gdf['building_id'].astype(str) + '-' + gdf.apply(lambda _: generate_random_string(), axis=1)
    return gdf

def add_keycode(gdf, gpkg_path):
    """
    出力するデータに地域コードと町丁字名の付与を行う

    Args:
        gdf (GeoDataFrame): 建物データの情報を紐づけた
        shp (polygon): 国勢調査の町丁字ポリゴンデータ(現状はgpkg形式で対応)
    """
    try:
        shp = gpd.read_file(gpkg_path)
        shp = shp.to_crs(epsg=4326)
    except:
        set_error(ERROR_00044)
        raise
    try:
        shp = shp[['KEY_CODE','S_NAME','geometry']]
        gdf = gdf.to_crs(epsg=4326)
        gdf_add_keycode = gpd.sjoin(gdf, shp, how='left', predicate='within')
        if 'geometry_right' in gdf_add_keycode.columns:
                gdf_add_keycode = gdf_add_keycode.drop(columns=['geometry_right'])
                gdf_add_keycode = gdf_add_keycode.rename(columns={'geometry_left': 'geometry'})
        gdf_add_keycode.set_geometry("geometry")
        if gdf_add_keycode is None:
            raise
        return gdf_add_keycode
    except:
        set_error(ERROR_00032)
        raise
    
def save_geodataframe(gdf, output_path, output_type):
    """
    GeoDataFrameを指定された形式で保存する

    Parameters
    ----------
    gdf : GeoDataFrame
        保存するGeoDataFrame
    output_path : str
        出力ファイルのパス
    output_type : str
        出力形式（'gpkg'または'csv'）

    Raises
    ------
    ValueError
        サポートされていない出力形式が指定された場合
    """
    encodings = ['utf-8-sig']

    if output_type == 'gpkg':
        # GeoPackage形式で保存
        for encoding in encodings:
            try:
                gdf.to_file(output_path, driver="GPKG", encoding=encoding)
                return
            except Exception as e:
                set_error(ERROR_00016, output_path, encoding)
 
    elif output_type == 'csv':
        # CSV形式で保存 
        for encoding in encodings:
            try:
                gdf.to_csv(output_path, index=False, encoding=encoding)
                return
            except Exception as e:
                set_error(ERROR_00017, output_path, encoding)

    else:
        # サポートされていない出力形式が指定された場合、例外を発生させる
        set_error(ERROR_00018, output_type)
        raise ValueError(f"サポートされていない出力形式です: {output_type}")

def unzip_file(zip_file, extract_to):
    """
    指定されたZIPファイルを指定したディレクトリに解凍する。

    Parameters
    ----------
    zip_file : str
        ZIPファイルのパス。
    extract_to : str
        解凍先のディレクトリ。
    """
    with zipfile.ZipFile(zip_file, 'r') as zip_ref:
        zip_ref.extractall(extract_to)


def add_plateaugml_suffix(gdf):
    """
    GeoDataFrameのカラムに'_plateaugml'の接尾辞を追加する

    Parameters
    ----------
    gdf : GeoDataFrame
        変換対象のGeoDataFrame

    Returns
    -------
    GeoDataFrame
        接尾辞を追加したGeoDataFrame
    """
    gdf = gdf.rename(columns=lambda col: f"{col}_plateaugml" if col != 'geometry' else col)
    return gdf


def process_data(tatemono_path, e14_merged_path, gpkg_path, ken, sikuchoson, option, output_type, output_path=None, job_id=None, db_path=None, geometry='geometry', input_source=[], file_type='', data_type=''):
    try:
        if db_path:
            connect_sqllite(db_path)
        task_id = None
        if job_id:
            task_id = create_or_update_job_task(job_id, progress_percent="0", preprocess_type="e016", error_code=None, error_msg=None, result=None)
        # 座標系を設定
        crs = get_transformer(ken, sikuchoson)
        
        # 建物データと水道データを読み込み、処理
        try:
            tatemono = load_and_process_data(tatemono_path, crs, geometry, file_type, data_type)
        except Exception as e:
            if ERROR_CODE is None:
                set_error(ERROR_00043)
                raise Exception(f"建物ポリゴンのデータが異常です。もう一度データを確認ください。")
            raise Exception(e)
        e14_merged = load_and_process_data(e14_merged_path, crs, None, 'csv', None)

        if job_id:
            create_or_update_job(job_id, "80")
            create_or_update_job_task(job_id, progress_percent="20", preprocess_type="e016", error_code=None, error_msg=None, result=None, id= task_id)
        tatemono.to_crs(crs, inplace=True)
        e14_merged.to_crs(crs, inplace=True)
        
        # 水道データの全列を選択
        point_selected_column = e14_merged.columns

        # 建物データと水道データを結合
        try:
            tatemono_use_point, join_ratio = assign_points_to_buildings(tatemono, e14_merged, 2, crs, point_selected_column, option)
        except:
            set_error(ERROR_00031)
            raise
        if job_id:
            create_or_update_job(job_id, "85")
            create_or_update_job_task(job_id, progress_percent="50", preprocess_type="e016", error_code=None, error_msg=None, result=None, id= task_id)
        # 住居IDを追加
        tatemono_use_point = add_residenceID(tatemono_use_point)
        
        if job_id:
            create_or_update_job_task(job_id, progress_percent="70", preprocess_type="e016", error_code=None, error_msg=None, result=None, id= task_id)
        # 地域コードと町丁字名の付与
        try:
            tatemono_use_point_add_keycode = add_keycode(tatemono_use_point, gpkg_path)
        except Exception as e:
            if ERROR_CODE is None:
                set_error(ERROR_00034)
                raise Exception(f"建物ポリゴンデータもしくは国勢調査データのジオメトリが不正なため、エラーが発生しました。")
            raise

        # 集合住宅のBuildingIDを削除（水道番号が3つ以上紐づいているbuildingIDを削除）
        try:
            suido_col = [ col for col in tatemono_use_point_add_keycode.columns if "水道番号" in col ][0]
            bid_num_df = tatemono_use_point.groupby(['building_id'])[[suido_col]].count()
            bid_num_over3 = bid_num_df.loc[bid_num_df[suido_col]>2]
            tatemono_use_point_add_keycode = tatemono_use_point_add_keycode.loc[~tatemono_use_point_add_keycode['building_id'].isin(bid_num_over3.index)]
        except:
            pass

        # 結果を保存
        if output_path is None:
            output_path = os.path.join(os.getcwd(), f"D901.{output_type}")

        output_dir = os.path.dirname(output_path)

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        if job_id:
            create_or_update_job(job_id, "90")

        save_geodataframe(tatemono_use_point_add_keycode, output_path, output_type)

        if job_id:
            result = {
                "joining_rate": join_ratio,
                "input_source": input_source
            }
            create_or_update_job_task(job_id, progress_percent="100", preprocess_type="e016", error_code=None, error_msg=None, result=json.dumps(result, ensure_ascii=False), id= task_id, is_finish=True)

        return output_path, join_ratio
    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_00019)
        if task_id is not None:
            create_or_update_job_task(job_id, progress_percent="", preprocess_type="e016", error_code=ERROR_CODE, error_msg=ERROR_MSG, result=json.dumps({}), id= task_id, is_finish=True)
        raise Exception("空間結合処理中にエラーが発生しました。ジオメトリに不正がないか、ご確認ください。")

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
