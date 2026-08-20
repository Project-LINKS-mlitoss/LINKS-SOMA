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
import re
import string
import sys
import uuid
from functools import partial
import chardet
import geopandas as gpd
import pandas as pd
import polars as pl
import zipfile
import shutil
from shapely import wkt, wkb
from shapely.geometry import Point
from pyproj import CRS, Transformer
from shapely.ops import transform
from pandas.errors import ParserError
import fiona
import warnings
import traceback
import numpy as np
import gc

pd.set_option("display.max_columns", None)
warnings.filterwarnings("ignore")

current_dir = os.path.dirname(os.path.abspath(__file__))
async_tasks_path = os.path.join(current_dir, "..", "async_tasks")
if async_tasks_path not in sys.path:
    sys.path.append(async_tasks_path)

# utils / constants と E012 は探索できるディレクトリが違うため、import を分ける。
# 1つの try にまとめると E012 の失敗で utils まで別経路へ倒れ、DB接続を持たない
# async_tasks.utils が束縛されて CSV 方式の建物種別判定が落ちる（issue #1966）。
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

try:
    from E012 import normalize_address_full
except ImportError:
    from src.E001_DataMatching.E012 import normalize_address_full

pd.set_option("display.max_columns", None)

# 水道データ結合の際の、オプション。0；交差結合、1:最近傍結合
option = 0

PREF_TO_COORD_NUMBER = {
    "長崎県": 1,
    "福岡県": 2,
    "佐賀県": 2,
    "熊本県": 2,
    "大分県": 2,
    "宮崎県": 2,
    "山口県": 3,
    "島根県": 3,
    "広島県": 3,
    "香川県": 4,
    "愛媛県": 4,
    "徳島県": 4,
    "高知県": 4,
    "兵庫県": 5,
    "鳥取県": 5,
    "岡山県": 5,
    "京都府": 6,
    "大阪府": 6,
    "福井県": 6,
    "滋賀県": 6,
    "三重県": 6,
    "奈良県": 6,
    "和歌山県": 6,
    "石川県": 7,
    "富山県": 7,
    "岐阜県": 7,
    "愛知県": 7,
    "新潟県": 8,
    "長野県": 8,
    "山梨県": 8,
    "静岡県": 8,
    "福島県": 9,
    "栃木県": 9,
    "茨城県": 9,
    "埼玉県": 9,
    "千葉県": 9,
    "群馬県": 9,
    "神奈川県": 9,
    "青森県": 10,
    "秋田県": 10,
    "山形県": 10,
    "岩手県": 10,
    "宮城県": 10,
}

NUMBER_1_CITIES = {
    "十島村",
    "喜界町",
    "奄美市",
    "龍郷町",
    "大和村",
    "宇検村",
    "瀬戸内町",
    "三島村",
    "里村",
    "上甑村",
    "下甑村",
    "鹿島村" "天城町",
    "徳之島町",
    "伊仙町",
    "和泊町",
    "知名町",
    "与論町",
    "名瀬市",
    "住用村",
    "笠利町",
}

NUMBER_11_CITIES = {
    "小樽市",
    "函館市",
    "伊達市",
    "北斗市",
    "大滝村",
    "上磯町",
    "大野町",
    "郡戸井町",
    "恵山町",
    "椴法華村",
    "南茅部町",
    "島牧村",
    "寿都町",
    "黒松内町",
    "蘭越町",
    "ニセコ町",
    "真狩村",
    "留寿都村",
    "喜茂別町",
    "京極町",
    "俱知安町",
    "共和町",
    "岩内町",
    "倶知安町",
    "泊村",
    "神恵内村",
    "積丹町",
    "古平町",
    "仁木町",
    "余市町",
    "赤井川村",
    "豊浦町",
    "壮瞥町",
    "洞爺湖町",
    "虻田町",
    "洞爺村",
    "松前町",
    "福島町",
    "知内町",
    "木古内町",
    "七飯町",
    "鹿部町",
    "森町",
    "八雲町",
    "長万部町",
    "熊石町",
    "砂原町",
    "江差町",
    "上ノ国町",
    "厚沢部町",
    "乙部町",
    "奥尻町",
    "今金町",
    "せたな町",
    "大成町",
    "瀬棚町",
    "北檜山町",
}

NUMBER_13_CITIES = {
    "北見市",
    "帯広市",
    "釧路市",
    "網走市",
    "根室市",
    "端野町",
    "留辺蘂町",
    "常呂町",
    "阿寒町",
    "音別町",
    "美幌町",
    "津別町",
    "斜里町",
    "清里町",
    "小清水町",
    "訓子府町",
    "置戸町",
    "佐呂間町",
    "大空町",
    "東藻琴村",
    "女満別町",
    "音更町",
    "士幌町",
    "上士幌町",
    "鹿追町",
    "新得町",
    "清水町",
    "芽室町",
    "中札内村",
    "更別村",
    "大樹町",
    "広尾町",
    "幕別町",
    "忠類村",
    "池田町",
    "豊頃町",
    "本別町",
    "足寄町",
    "陸別町",
    "浦幌町",
    "釧路町",
    "厚岸町",
    "浜中町",
    "標茶町",
    "弟子屈町",
    "鶴居村",
    "白糠町",
    "別海町",
    "中標津町",
    "標津町",
    "羅臼町",
    "色丹村",
    "泊村",
    "留夜別村",
    "留別村",
    "紗那村",
    "蘂取村",
}

NUMBER_14_CITIES = {"小笠原村"}

NUMBER_16_CITIES = {
    "宮古島市",
    "多良間村",
    "石垣市",
    "竹富町",
    "与那国町",
    "平良市",
    "城辺町",
    "下地町",
    "上野村",
    "伊良部町",
}

NUMBER_17_CITIES = {"北大東村", "南大東村"}

ERROR_CODE = None
ERROR_MSG = None


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
    with open(file_path, "rb") as file:
        raw_data = file.read(100)
    # エンコーディングを検出して返す
    result = chardet.detect(raw_data)
    return result["encoding"]


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

        allowed_file_extension = [".shp", ".gpkg", ".geojson", ".csv"]
        # allowed_file_extensionファイル以外の場合はエラーを発生させる
        if file_extension not in allowed_file_extension:
            set_error(ERROR_00021)
            raise ValueError(
                f"shapefile, GeoPackage, CSV形式以外のファイル形式には対応していません。: {file_extension}"
            )

        # 複数のエンコーディングを試行
        encodings = [
            "utf-8-sig",
            "euc_jp",
            "shift_jis",
            "cp932",
            "shift_jis_2004",
            "shift_jisx0213",
            "euc_jis_2004",
            "euc_jisx0213",
            "iso2022_jp",
            "iso2022_jp_1",
            "iso2022_jp_2",
            "iso2022_jp_2004",
            "iso2022_jp_3",
            "iso2022_jp_ext",
        ]
        for encoding in encodings:
            try:
                # 各エンコーディングでファイルの読み込みを試みる
                if file_extension == ".csv":
                    return read_large_csv(path, encoding=encoding)
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
            return read_large_csv(path, encoding=encoding)

        # 適切なエンコーディングが見つからない場合、エラーを発生させる
        set_error(ERROR_00025, path)
        raise ValueError(
            f"適切なエンコーディングが見つかりませんでした: {path}"
        )
    except Exception as e:
        # 何らかの例外が発生した場合、エラーメッセージを表示してNoneを返す
        if ERROR_CODE is None:
            set_error(ERROR_00014, path)
        raise Exception(e)


def read_large_csv(path: str, encoding: str = 'utf-8-sig') -> pd.DataFrame:
    """
    Read large CSV with memory optimization
    """
    # Step 1: Read sample
    try:
        sample = pd.read_csv(
            path,
            encoding=encoding,
            engine='pyarrow'
        ).head(1000)
    except Exception:
        try:
            sample = pd.read_csv(
                path,
                encoding=encoding,
                nrows=1000,
                engine='c'
            )
        except Exception:
            sample = pd.read_csv(
                    path,
                    encoding=encoding,
                    nrows=100
                )

    # Step 2: Optimize dtypes
    dtypes = {}

    for col in sample.columns:
        try:
            col_data = sample[col]
            # Check if it's DataFrame (duplicate names)
            if isinstance(col_data, pd.DataFrame):
                # Use first occurrence
                col_type = col_data.iloc[:, 0].dtype
            else:
                col_type = col_data.dtype
        except Exception:
            continue

        if col_type == 'object':
            dtypes[col] = 'string'

        elif col_type == 'float64':
            # YYYYMMDD 形式の8桁日付整数値（例: 20121001）は
            # float32（有効桁数約7桁）に落とすと精度ロスで値が変質する
            dtypes[col] = 'float64'

        elif col_type == 'int64':
            non_null = sample[col].dropna()
            if len(non_null) > 0:
                try:
                    pd.to_numeric(non_null, errors='raise', downcast='integer')
                    col_min = sample[col].min()
                    col_max = sample[col].max()

                    if col_min >= 0:
                        if col_max < 255:
                            dtypes[col] = 'uint8'
                        elif col_max < 65535:
                            dtypes[col] = 'uint16'
                        else:
                            dtypes[col] = 'uint32'
                    else:
                        if col_min > -128 and col_max < 127:
                            dtypes[col] = 'int8'
                        elif col_min > -32768 and col_max < 32767:
                            dtypes[col] = 'int16'
                        else:
                            dtypes[col] = 'int32'
                except (ValueError, TypeError):
                    pass

    del sample
    gc.collect()

    # Step 3: Read and concat in batches
    result_chunks = []
    batch_size = 20
    chunk_list = []

    for chunk in pd.read_csv(
        path,
        encoding=encoding,
        chunksize=5000,
        dtype=dtypes,
        engine='c'
    ):
        chunk_list.append(chunk)

        # Concat when batch is full
        if len(chunk_list) >= batch_size:
            batch_result = pd.concat(chunk_list, ignore_index=True)
            result_chunks.append(batch_result)

            # Release memory immediately
            del chunk_list, batch_result
            gc.collect()
            chunk_list = []

    # Concat remaining chunks
    if chunk_list:
        batch_result = pd.concat(chunk_list, ignore_index=True)
        result_chunks.append(batch_result)
        del chunk_list, batch_result
        gc.collect()

    # Step 4: Final concat
    if result_chunks:
        df = pd.concat(result_chunks, ignore_index=True)
        del result_chunks
        gc.collect()
        return df
    else:
        return pd.DataFrame()


def read_data(file_path, columns):
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

    file_extension = file_path.split(".")[-1].lower()
    if file_extension != "csv":
        set_error(ERROR_00048)
        raise KeyError(
            "建物ポリゴンデータ形式にCSV形式が指定されていますが、読み込まれたファイルはCSV形式ではありません。"
        )

    # CSVファイルを読み込む
    poly_gdf = read_file(file_path)
    if poly_gdf is None:
        raise ValueError(f"ファイルの読み込みに失敗しました: {file_path}")
    try:
        if columns and columns.get("geometry"):
            poly_gdf["geometry"] = poly_gdf[columns.get("geometry")].apply(
                parse_wkt
            )
        else:
            poly_gdf["geometry"] = poly_gdf["geometry"].apply(parse_wkt)
    except Exception as e:
        raise Exception(e)

    poly_gdf = gpd.GeoDataFrame(poly_gdf, geometry="geometry", crs="EPSG:4326")

    src_crs = poly_gdf.crs
    proj_crs = (
        poly_gdf.estimate_utm_crs()
        if src_crs and src_crs.is_geographic
        else src_crs
    )

    centroids_proj = poly_gdf.to_crs(proj_crs).centroid  # 投影座標系でcentroid
    centroids = gpd.GeoSeries(centroids_proj, crs=proj_crs).to_crs(
        src_crs
    )  # 元CRSへ戻す
    poly_gdf = poly_gdf.rename(
        columns={"geometry": "geometry_polygon"}, errors="ignore"
    )
    # 3. POINTレイヤを作成（属性は元Polygonのまま引き継ぐ）
    centroid_gdf = gpd.GeoDataFrame(poly_gdf, geometry=centroids, crs=src_crs)

    # 無効なジオメトリを除外
    centroid_gdf = centroid_gdf[centroid_gdf["geometry"].notnull()]
    if centroid_gdf is None:
        set_error(ERROR_00049)
        raise KeyError(
            "ジオメトリーカラムのデータが異常です。誤ったファイルを読み込んでいないかもう一度データを確認ください。"
        )
    centroid_gdf["building_id"] = centroid_gdf["buildingID"].astype(str)
    del centroid_gdf["buildingID"]
    # GeoDataFrameを作成
    gdf = gpd.GeoDataFrame(centroid_gdf, geometry="geometry", crs=4326)
    return gdf


def clean_geometry(gdf):
    """
    Clean geometry for Polygon/MultiPolygon only.
    If still invalid after cleaning, fallback to Point from lat/lon.
    """
    try:
        if len(gdf) == 0:
            return gdf

        # Only clean Polygon/MultiPolygon geometries
        geom_types = gdf.geometry.geom_type
        is_polygon = geom_types.isin(['Polygon', 'MultiPolygon'])

        if not is_polygon.any():
            # No polygons to clean, return as is
            return gdf

        # Check invalid geometries for polygons only
        polygon_mask = is_polygon
        invalid_mask = ~gdf.geometry.is_valid & polygon_mask

        if invalid_mask.any():
            # First, try to fix invalid polygons with buffer(0)
            # Use gdf.geometry to access the active geometry column
            gdf.loc[invalid_mask, gdf.geometry.name] = (
                gdf.loc[invalid_mask, gdf.geometry.name].buffer(0)
            )

            # Check if still invalid after buffer fix
            still_invalid_mask = ~gdf.geometry.is_valid & polygon_mask

            if still_invalid_mask.any():
                # If still invalid, fallback to Point from lat/lon if available
                if ("latitude_geocoding_cleaned" in gdf.columns and
                        "longitude_geocoding_cleaned" in gdf.columns):
                    invalid_rows = gdf[still_invalid_mask]
                    has_coords = (
                        invalid_rows["latitude_geocoding_cleaned"].notna() &
                        invalid_rows["longitude_geocoding_cleaned"].notna()
                    )

                    if has_coords.any():
                        # Create Point from lat/lon for rows with valid coords
                        valid_coord_mask = still_invalid_mask & has_coords
                        # Use gdf.geometry.name for active geometry column
                        gdf.loc[valid_coord_mask, gdf.geometry.name] = (
                            gdf.loc[valid_coord_mask].apply(
                                lambda row: Point(
                                    row["longitude_geocoding_cleaned"],
                                    row["latitude_geocoding_cleaned"]
                                ),
                                axis=1
                            )
                        )
                        # Update mask to exclude rows we just fixed
                        still_invalid_mask = still_invalid_mask & ~has_coords

        return gdf.reset_index(drop=True)
    except Exception as e:
        print(e)
        traceback.print_exc()
        return gdf


def load_and_process_data(
    file_path, crs, geometry, file_type, data_type, columns
):
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
    detect_ext = file_path.split(".")[-1].lower()
    if not file_extension:
        file_extension = detect_ext
    if (
        detect_ext is not None
        and file_extension == "csv"
        and detect_ext != file_extension
    ):
        set_error(ERROR_00048)
        raise KeyError(
            "建物ポリゴンデータ形式にCSV形式が指定されていますが、読み込まれたファイルはCSV形式ではありません。"
        )

    if file_extension == "csv":
        # CSVファイルを読み込む
        df = read_file(file_path)
        if df is None:
            raise ValueError(f"ファイルの読み込みに失敗しました: {file_path}")

        if geometry in df.columns:
            # Keep all rows, including null geometry
            # Only parse WKT for string values, keep null/other types as is
            def parse_geometry_safe(x):
                if isinstance(x, str):
                    return parse_wkt(x)
                # Keep null or already parsed geometry objects
                return x
            
            df["geometry"] = df[geometry].apply(parse_geometry_safe)
            df = df.drop(columns=[geometry])
        # geometry列が存在するか確認
        elif "geometry" in df.columns:
            # Keep all rows, including null geometry
            # Only parse WKT for string values, keep null/other types as is
            def parse_geometry_safe(x):
                if isinstance(x, str):
                    return parse_wkt(x)
                # Keep null or already parsed geometry objects
                return x
            
            df["geometry"] = df["geometry"].apply(parse_geometry_safe)
        else:
            # lat/lon列からgeometry列を作成
            if "latitude_geocoding_cleaned" in df.columns and "longitude_geocoding_cleaned" in df.columns:
                lat_col = "latitude_geocoding_cleaned"
                lon_col = "longitude_geocoding_cleaned"
                df["geometry"] = gpd.points_from_xy(
                    df[lon_col], df[lat_col], crs=4326
                )
                # Set invalid (NaN lat/lon) to None
                invalid_mask = df[lat_col].isna() | df[lon_col].isna()
                df.loc[invalid_mask, "geometry"] = None
            elif (
                columns.get("lat", None) in df.columns
                and columns.get("lon", None) in df.columns
            ):
                lat_col = columns["lat"]
                lon_col = columns["lon"]
                df["geometry"] = gpd.points_from_xy(
                    df[lon_col], df[lat_col], crs=4326
                )
                # Set invalid (NaN lat/lon) to None
                invalid_mask = df[lat_col].isna() | df[lon_col].isna()
                df.loc[invalid_mask, "geometry"] = None
            else:
                set_error(ERROR_00024)
                raise KeyError(
                    "'geometry' 列または 'lat' と 'lon' 列が必要です"
                )

        if df is None:
            set_error(ERROR_00042)
            raise KeyError(
                "建物ポリゴンデータ（CSV形式）のジオメトリーカラムのデータが異常です。"
            )

        if "buildingID" in df.columns:
            try:
                df["building_id"] = df["buildingID"].astype(str)
                del df["buildingID"]
            except Exception as e:
                set_error(ERROR_00030)
                raise Exception(e)
        else:
            # Set building_id only for records that have "正規化住所" data
            address_column = "normalized_address"
            if address_column in df.columns and "building_id" not in df.columns:
                # Extract only 正規化住所 column for Polars processing
                # This avoids compatibility issues with other columns
                addr_series = df[address_column]
                addr_pl = pl.DataFrame({address_column: addr_series})

                # Create building_id using Polars
                addr_pl = addr_pl.with_columns([
                    pl.when(pl.col(address_column).is_not_null())
                    .then(
                        pl.col(address_column)
                        .is_not_null()
                        .cast(pl.Int32)
                        .cum_sum()
                        .cast(pl.Utf8)
                    )
                    .otherwise(None)
                    .alias("building_id")
                ])

                # Convert back to Pandas and assign to df
                df["building_id"] = addr_pl["building_id"].to_pandas()

        # GeoDataFrameを作成
        gdf = gpd.GeoDataFrame(df, geometry="geometry", crs=4326)
        return gdf, crs

    elif file_extension in ["zip", "shp", "shapefile"] or detect_ext == "zip":
        # ZIPファイルかどうかを確認し、処理
        temp_folder = str(uuid.uuid4())
        temp_dir = os.path.join(os.getcwd(), temp_folder)
        os.makedirs(temp_dir, exist_ok=True)

        extracted_files = extract_zip(file_path, temp_dir)
        shp_file = extracted_files.get("shp", None)

        if not shp_file:
            set_error(ERROR_00033)
            raise KeyError(
                "本処理でサポートしているファイルフォーマットは、shp形式(zip形式)、gpkg形式、csv形式（geometryカラム付）のみとなります。"
            )
        else:
            # shapefileを読み込む
            gdf = read_file(shp_file)

        if gdf.crs is None:
            # データのCRSを指定（EPSG:4326）
            gdf.set_crs(crs, inplace=True)

        # Extract PREF and CITY from data (first row value)
        pref = None
        city = None
        if "PREF_NAME" in gdf.columns and len(gdf) > 0:
            pref = gdf["PREF_NAME"].iloc[0]
        if "CITY_NAME" in gdf.columns and len(gdf) > 0:
            city = gdf["CITY_NAME"].iloc[0]
        if pref and city:
            try:
                crs = get_transformer(pref, city)
            except Exception:
                pass

        shutil.rmtree(temp_dir)
        # buildingID列を追加
        if "buildingID" in gdf.columns:
            try:
                gdf["building_id"] = gdf["buildingID"].astype(str)
                del gdf["buildingID"]
            except Exception as e:
                set_error(ERROR_00030)
                raise Exception(e)
        else:
            if "building_id" not in gdf.columns:
                gdf["building_id"] = gdf.index + 1
            gdf["building_id"] = gdf["building_id"].astype(str)

        return gdf, crs

    else:
        # その他の非CSVファイルを読み込む
        gdf = read_file(file_path)

        if gdf.crs is None:
            # データのCRSを指定（EPSG:4326）
            gdf.set_crs(crs, inplace=True)

        # Extract PREF and CITY from data (first row value)
        pref = None
        city = None
        if "PREF_NAME" in gdf.columns and len(gdf) > 0:
            pref = gdf["PREF_NAME"].iloc[0]
        if "CITY_NAME" in gdf.columns and len(gdf) > 0:
            city = gdf["CITY_NAME"].iloc[0]
        if pref and city:
            try:
                crs = get_transformer(pref, city)
            except Exception:
                pass

        # buildingID列を追加
        if data_type == "plateau":
            try:
                gdf["building_id"] = gdf["buildingID"].astype(str)
                del gdf["buildingID"]
            except Exception as e:
                set_error(ERROR_00030)
                raise Exception(e)
        else:
            if "building_id" not in gdf.columns:
                gdf["building_id"] = gdf.index + 1
            gdf["building_id"] = gdf["building_id"].astype(str)

        return gdf, crs


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
        raise Exception(e)


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
    with zipfile.ZipFile(zip_file, "r") as zip_ref:
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

    shp_files = [
        os.path.join(temp_dir, f) for f in files if f.endswith(".shp")
    ]
    shx_files = [
        os.path.join(temp_dir, f) for f in files if f.endswith(".shx")
    ]
    dbf_files = [
        os.path.join(temp_dir, f) for f in files if f.endswith(".dbf")
    ]
    prj_files = [
        os.path.join(temp_dir, f) for f in files if f.endswith(".prj")
    ]

    shp_file = shp_files[0] if shp_files else None
    shx_file = shx_files[0] if shx_files else None
    dbf_file = dbf_files[0] if dbf_files else None
    prj_file = prj_files[0] if prj_files else None

    return {"shp": shp_file, "shx": shx_file, "dbf": dbf_file, "prj": prj_file}


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
    if not hasattr(geometries, 'crs') or geometries.crs is None:
        geometries = gpd.GeoSeries(geometries, crs=source_crs)
    return geometries.to_crs(4326)


def _drop_z(geom):
    """
    Drop Z coordinate from geometry to convert 3D to 2D
    """
    if geom is None:
        return geom

    if not hasattr(geom, "is_empty") or geom.is_empty:
        return geom

    # Only process if geometry actually has Z coordinate
    if not hasattr(geom, "has_z") or not geom.has_z:
        return geom

    try:
        # Use wkb to drop Z dimension
        return wkb.loads(wkb.dumps(geom, output_dimension=2))
    except Exception as e:
        # Fallback: return original geometry if conversion fails
        print(f"Warning: Failed to drop Z from geometry: {e}")
        return geom


# 重心バッファの半径を決める倍率。建物ポリゴン結合と家屋種別判定で同じ値を使う
BUILDING_BUFFER_MUL = 2

# 重心バッファの対象から外す建物の面積(m2)。半径は面積に比例して広がるため、
# 工場等の大きな建物のバッファは離れた無関係な点まで拾ってしまう
BUILDING_AREA_LIMIT = 10000

# 建物と点を重ねるときの座標系。面積と半径をメートルで扱うため投影座標系を使う
BUILDING_MATCH_CRS = 6675


def build_building_buffers(buildings_gdf, mul=BUILDING_BUFFER_MUL):
    """建物を重心中心の円に置き換えた GeoDataFrame を返す。

    住所から作った座標は建物の輪郭に収まるとは限らず、輪郭への内包判定では
    取りこぼす。建物を面積相当の円に広げてから重ねることでこのずれを吸収する。
    吸収できるずれは建物の大きさに比例し、面積 A の建物では重心から
    sqrt(mul * A / pi) メートルまで。

    地図表示の建物割り当て(assign_points_to_buildings)と家屋種別の判定
    (IF001.e015)は同じ建物データに同じ点を当てる。規則が食い違うと、地図には
    建物として出ているのに種別だけ判定できない行が生まれるため、両者はこの
    関数を共有する。

    前提: buildings_gdf は BUILDING_MATCH_CRS に変換済みであること。面積と
    半径をメートルで計算するため、緯度経度のまま渡すと半径が度として
    解釈される。

    副作用: buildings_gdf に centroid・area 列を書き込む。建物データは数十万
    行になるため複製せずに書き換える。呼び出し後も元の列構成が要る場合は
    複製を渡すこと。
    """
    buildings_gdf["centroid"] = buildings_gdf["geometry"].centroid
    buildings_gdf["area"] = buildings_gdf["geometry"].area
    buildings_gdf = buildings_gdf[buildings_gdf["area"] < BUILDING_AREA_LIMIT]

    rad = (mul * buildings_gdf["area"] / math.pi) ** 0.5
    buildings_gdf["buffer"] = buildings_gdf["centroid"].buffer(rad)
    return buildings_gdf.set_geometry("buffer")


def assign_polygon_to_points(
    buildings_gdf, points_gdf, mul, point_selected_column, option
):
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
    try:
        # 結合するカラムを指定
        points_gdf = points_gdf[point_selected_column]

        # Split buildings into valid geometry and null geometry groups
        # Keep buildings with null geometry separate
        # They will be added back later
        buildings_with_null_geom = buildings_gdf[
            buildings_gdf["geometry"].isnull()
        ].copy()
        buildings_gdf = buildings_gdf[
            buildings_gdf["geometry"].notnull()
        ].copy()

        # Filter out Point geometries only when option != 1
        # (sjoin with intersects)
        # When option == 1 (sjoin_nearest), Points work fine, so keep them
        point_buildings = None
        if option != 1:
            # Save Point buildings to add back to output later
            buildings_gdf["geom_type"] = buildings_gdf.geometry.geom_type
            point_buildings = buildings_gdf[
                buildings_gdf["geom_type"] == "Point"
            ].copy()
            buildings_gdf = buildings_gdf[
                buildings_gdf["geom_type"] != "Point"
            ].copy()

        buildings_gdf = build_building_buffers(buildings_gdf, mul)

        # Remove temporary geom_type column (only if it exists)
        if option != 1:
            buildings_gdf = buildings_gdf.drop(
                columns=["geom_type"], errors="ignore"
            )

        # points_gdfにID付与（空間結合後の重複削除のために、重心との距離計算をするための準備）
        points_gdf["ID"] = range(1, len(points_gdf) + 1)
        # クイックルックアップのための辞書を作成する
        geometry_dict = points_gdf.set_index("ID")["geometry"].to_dict()

        # 結合オプションを設定（0: 交差結合、1: 最近傍結合）
        if option == 1:
            # index_right列が存在する場合は削除
            if "index_right" in points_gdf.columns:
                points_gdf = points_gdf.drop(columns="index_right")
            if "index_right" in buildings_gdf.columns:
                buildings_gdf = buildings_gdf.drop(columns="index_right")

            # 空間インデックスを作成
            if not points_gdf.has_sindex:
                points_gdf.sindex
            if not buildings_gdf.has_sindex:
                buildings_gdf.sindex

            if "geometry_right" in points_gdf.columns:
                points_gdf["geometry_right"] = points_gdf.geometry

            joined = gpd.sjoin_nearest(
                buildings_gdf, points_gdf, how="left", distance_col="distance"
            )

            # 複数に結合しているものを削除
            joined = joined.sort_values(by="distance").drop_duplicates(
                subset="ID", keep="first"
            )
            joined = joined.rename(
                columns={
                    "geometry_left": "geometry",
                }
            )

            # 不要な列を削除
            columns_to_drop = ["index_right", "buffer", "centroid", "area"]
            joined = joined.drop(
                columns=[
                    col for col in columns_to_drop if col in joined.columns
                ]
            )
            combined_gdf = joined

            combined_gdf = gpd.GeoDataFrame(combined_gdf, geometry="geometry")
            if (
                "building_id_left" in combined_gdf.columns
                and "building_id" not in combined_gdf.columns
            ):
                combined_gdf.rename(
                    columns={"building_id_left": "building_id"}, inplace=True
                )

        else:
            # index_right列が存在する場合は削除
            if "index_right" in points_gdf.columns:
                points_gdf = points_gdf.drop(columns="index_right")
            if "index_right" in buildings_gdf.columns:
                buildings_gdf = buildings_gdf.drop(columns="index_right")

            # Ensure point layer is Point: convert Polygon/MultiPolygon to centroid
            if not points_gdf.empty:
                geom_types = points_gdf.geometry.geom_type
                if geom_types.isin(["Polygon", "MultiPolygon"]).any():
                    points_gdf = points_gdf.copy()
                    points_gdf["geometry"] = points_gdf.geometry.centroid

            # Align CRS: transform points to buildings CRS (if both defined)
            if buildings_gdf.crs is not None and points_gdf.crs is not None:
                if buildings_gdf.crs != points_gdf.crs:
                    points_gdf = points_gdf.to_crs(buildings_gdf.crs)

            # Extract lat/lon from geometry for building_type_determination
            if not points_gdf.empty:
                if "latitude_building_type_determination" not in points_gdf.columns:
                    points_gdf["latitude_building_type_determination"] = (
                        points_gdf.geometry.y
                    )
                if "longitude_building_type_determination" not in points_gdf.columns:
                    points_gdf["longitude_building_type_determination"] = (
                        points_gdf.geometry.x
                    )

            # 空間結合(交差)の実行（ここで、水道のデータが2つ以上結合されている場合があるので、最も近いもののみを残す）
            joined = gpd.sjoin(
                buildings_gdf, points_gdf, how="left", predicate="intersects"
            )

            joined['distance'] = joined.apply(
                lambda row: row['geometry'].distance(
                    points_gdf.loc[row['index_right'], 'geometry']
                ) if pd.notna(row['index_right']) else np.nan,
                axis=1
            )

            if (
                "building_id_left" in joined.columns
                and "building_id" not in joined.columns
            ):
                if "building_id_left" in joined.columns:
                    joined = joined.rename(
                        columns={"building_id_left": "building_id"}
                    )
                else:
                    joined = joined.rename(
                        columns={"building_id_right": "building_id"}
                    )
                # Reset index after rename to ensure it's unique
                joined = joined.reset_index(drop=True)

            # Keep the nearest point for each building
            combined_gdf = (
                joined.sort_values('distance')
                .drop_duplicates(subset=['building_id'], keep='first')
                .reset_index(drop=True)
            )

            combined_gdf = gpd.GeoDataFrame(combined_gdf, geometry="geometry")

            # 不要な列を削除
            columns_to_drop = [
                "centroid",
                "area",
                "index_left",
                "index_right",
                "buffer",
            ]
            combined_gdf = combined_gdf.drop(
                columns=[
                    col
                    for col in columns_to_drop
                    if col in combined_gdf.columns
                ]
            )
            if "distance_left" in combined_gdf.columns:
                combined_gdf = combined_gdf.rename(
                    columns={"distance_left": "distance"}
                )
                combined_gdf = combined_gdf.drop(
                    columns=["distance_right"], errors="ignore"
                )

        combined_gdf.to_crs(4326, inplace=True)
        # Reset index to ensure it's unique before concatenation
        combined_gdf = combined_gdf.reset_index(drop=True)

        # Add back Point buildings to output (only when option != 1)
        # When option == 1, Points are already included in the join result
        if option != 1 and point_buildings is not None and len(point_buildings) > 0:
            # Remove geom_type column from point_buildings if exists
            point_buildings = point_buildings.drop(
                columns=["geom_type"], errors="ignore"
            )
            # Convert to same CRS
            point_buildings.to_crs(4326, inplace=True)

            # Create DataFrame with matching columns
            point_buildings_gdf = point_buildings.copy()
            point_buildings_gdf["ID"] = None  # No point joined

            # Add missing columns from combined_gdf
            for col in combined_gdf.columns:
                if col not in point_buildings_gdf.columns:
                    point_buildings_gdf[col] = None

            # Reorder columns to match combined_gdf exactly
            point_buildings_gdf = point_buildings_gdf[combined_gdf.columns]
            point_buildings_gdf = gpd.GeoDataFrame(
                point_buildings_gdf, geometry="geometry", crs=4326
            )

            # Reset indices and concatenate
            combined_gdf = combined_gdf.reset_index(drop=True)
            point_buildings_gdf = point_buildings_gdf.reset_index(drop=True)

            combined_gdf = pd.concat(
                [combined_gdf, point_buildings_gdf], ignore_index=True, sort=False
            )
            combined_gdf = gpd.GeoDataFrame(
                combined_gdf, geometry="geometry"
            )

        combined_gdf.rename(
            columns={"geometry": "geometry_plateau"}, inplace=True
        )

        # Add back buildings with null geometry
        # (they were filtered out earlier)
        if not buildings_with_null_geom.empty:
            # Convert to same CRS
            buildings_with_null_geom.to_crs(4326, inplace=True)

            # Ensure consistent schema - add missing columns from combined_gdf
            for col in combined_gdf.columns:
                if col not in buildings_with_null_geom.columns:
                    buildings_with_null_geom[col] = None

            # Reorder columns to match combined_gdf
            buildings_with_null_geom = buildings_with_null_geom[
                combined_gdf.columns
            ]

            # Reset indices and concatenate
            combined_gdf = combined_gdf.reset_index(drop=True)
            buildings_with_null_geom = buildings_with_null_geom.reset_index(
                drop=True
            )

            combined_gdf = pd.concat(
                [combined_gdf, buildings_with_null_geom],
                ignore_index=True,
                sort=False
            )
            combined_gdf = gpd.GeoDataFrame(
                combined_gdf, geometry="geometry_plateau"
            )

        # 結合率の算出
        total_buildings = len(combined_gdf)
        matched_count = combined_gdf["ID"].notna().sum()
        join_ratio = (
            round(matched_count / total_buildings * 100, 2)
            if total_buildings > 0
            else 0
        )
        success_rate = f"{matched_count}件/{total_buildings}件中"

        # ID列を削除（最後に実行）-
        combined_gdf = combined_gdf.drop(columns=["ID"], errors="ignore")

        return combined_gdf, join_ratio, success_rate
    except Exception as e:
        raise Exception(e)


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
    return "".join(random.choice(characters) for i in range(length))


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

    # Only create residenceID if building_id exists
    if "building_id" in gdf.columns:
        # Initialize residenceID column with None
        gdf["residenceID"] = None

        # Create residenceID only for records with valid building_id
        mask = gdf["building_id"].notna()
        if mask.any():
            # Pre-generate random strings only for records with building_id
            n_valid = mask.sum()
            random_strings = [generate_random_string() for _ in range(n_valid)]
            building_suffix = (
                gdf.loc[mask, "building_id"].astype(str).str[-7:]
            )
            gdf.loc[mask, "residenceID"] = [
                f"{b}-{r}" for b, r in zip(building_suffix, random_strings)
            ]

    return gdf


def _is_readable_japanese(value) -> bool:
    """
    国勢調査ポリゴンの S_NAME 値が「可読な日本語」かどうかを判定する。

    GDAL/fiona は誤ったエンコーディングで .dbf を読んでも例外を出さず、
    生バイトを hex 文字列にしたり U+FFFD 置換文字を含む文字列を黙って返すことがある
    （SJIS 境界データで .cpg が無い場合に発生。GDAL バージョン差で崩れ方が変わる）。
    そのため「読めた文字列が妥当な日本語か」を内容で検証する。

    Parameters
    ----------
    value : Any
        判定対象の S_NAME 値

    Returns
    -------
    bool
        CJK 文字を含み、置換文字・hex 様文字列でなければ True
    """
    if not isinstance(value, str) or value == "":
        return False
    # U+FFFD（置換文字）を含む = デコード失敗
    if "�" in value:
        return False
    # 生バイトを hex 化したような文字列（例: "8adb82cc93e088ea"）を除外
    if re.fullmatch(r"[0-9a-fA-F]{6,}", value):
        return False
    # ひらがな・カタカナ・CJK統合漢字・互換漢字のいずれかを含むか
    cjk_pattern = re.compile(r"[぀-ヿ㐀-䶿一-鿿豈-﫿]")
    return bool(cjk_pattern.search(value))


def read_boundary_polygon(gpkg_path):
    """
    国勢調査の境界ポリゴン（GeoPackage / Shapefile）を読み込む。

    属性テーブル（.dbf）が Shift-JIS(cp932) で .cpg が無いケースに対応するため、
    「複数エンコーディングで読み取り → S_NAME が可読日本語か検証 → 妥当な結果を採用」
    という検出＋検証＋フォールバック方式をとる。cp932 を無条件ハードコードはしない
    （正当に UTF-8 や .cpg 付きの境界データもあるため）。

    Parameters
    ----------
    gpkg_path : str
        境界ポリゴンのパス（.gpkg / .shp 等）

    Returns
    -------
    GeoDataFrame
        読み込んだ境界ポリゴン
    """
    # 試行順: chardet 推定 → UTF-8 系 → 日本語系 → GDAL のデフォルト（.cpg / GPKG 用）
    candidate_encodings = []
    try:
        detected = detect_encoding(gpkg_path)
    except Exception:
        detected = None
    if detected:
        candidate_encodings.append(detected)
    for enc in ["utf-8", "cp932", "shift_jis", "euc_jp"]:
        if enc not in candidate_encodings:
            candidate_encodings.append(enc)
    # None = SHAPE_ENCODING を上書きしない（.cpg 付き・GeoPackage はこれで正しく読める）
    candidate_encodings.append(None)

    last_gdf = None
    for enc in candidate_encodings:
        try:
            if enc is None:
                gdf = gpd.read_file(gpkg_path)
            else:
                with fiona.Env(SHAPE_ENCODING=enc):
                    gdf = gpd.read_file(gpkg_path)
        except Exception:
            continue

        last_gdf = gdf
        # S_NAME が無い境界データはここで検証できないため、最初に読めたものを採用
        if "S_NAME" not in gdf.columns:
            return gdf

        sample = gdf["S_NAME"].dropna().head(50)
        if len(sample) == 0:
            # 名称が全て NULL の場合は検証不能。読めた結果をそのまま採用
            return gdf
        if sample.map(_is_readable_japanese).any():
            return gdf

    # どのエンコーディングでも可読日本語にならなかった場合は、
    # 最後に読めた結果を返す（読み込み自体が成功していれば後続処理は継続できる）
    if last_gdf is not None:
        return last_gdf

    set_error(ERROR_00044)
    raise ValueError(
        f"国勢調査ポリゴンの読み込みに失敗しました: {gpkg_path}"
    )


def add_keycode(gdf, gpkg_path):
    """
    出力するデータに地域コードと町丁字名の付与を行う

    Args:
        gdf (GeoDataFrame): 建物データの情報を紐づけた
        shp (polygon): 国勢調査の町丁字ポリゴンデータ(現状はgpkg形式で対応)
    """
    try:
        shp = read_boundary_polygon(gpkg_path)
        shp = shp.to_crs(epsg=4326)
    except Exception as e:
        set_error(ERROR_00044)
        raise Exception(e)
    try:
        shp = shp[["KEY_CODE", "S_NAME", "geometry"]]
        gdf = gdf.to_crs(epsg=4326)

        # Remember original geometry column name
        original_geom_col = gdf.geometry.name

        gdf_add_keycode = gpd.sjoin(gdf, shp, how="left", predicate="within")

        if "geometry_right" in gdf_add_keycode.columns:
            gdf_add_keycode = gdf_add_keycode.drop(columns=["geometry_right"])
            # Rename geometry_left back to original geometry column name
            if "geometry_left" in gdf_add_keycode.columns:
                gdf_add_keycode = gdf_add_keycode.rename(
                    columns={"geometry_left": original_geom_col}
                )

        # Set geometry to original column name (geometry or geometry_plateau)
        gdf_add_keycode = gdf_add_keycode.set_geometry(original_geom_col)

        if gdf_add_keycode is None:
            raise Exception("データが異常です。もう一度データを確認ください。")
        return gdf_add_keycode
    except Exception as e:
        set_error(ERROR_00032)
        raise Exception(e)


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
    encodings = ["utf-8-sig"]

    if output_type == "gpkg":
        # GeoPackage形式で保存
        for encoding in encodings:
            try:
                gdf.to_file(output_path, driver="GPKG", encoding=encoding)
                return
            except Exception as e:
                set_error(ERROR_00016, output_path, encoding)

    elif output_type == "csv":
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
    with zipfile.ZipFile(zip_file, "r") as zip_ref:
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
    gdf = gdf.rename(
        columns=lambda col: f"{col}_plateaugml" if col != "geometry" else col
    )
    return gdf


def extend_columns(path, columns):
    data = read_file(path)
    for col in columns:
        if col not in data.columns:
            data[col] = None
    data.to_csv(path)


def process_spatial_join(
    main_path,
    sub_path,
    option,
    output_path=None,
    columns=None,
    file_type="csv",
    building_type_values=[],
    job_id=None,
    task_id=None,
    db_path=None,
    task_id_summarization=None,
    result_summarization=None,
    label_E015="",
):
    result_summarization_updated = None
    column_building_type_determination = "usage_building_type_determination"
    try:
        if db_path:
            connect_sqllite(db_path)
        # 座標系を設定
        crs = 4326

        # 建物データと水道データを読み込み、処理
        try:
            point, _ = load_and_process_data(
                sub_path, crs, None, file_type, None, columns
            )

            # Rename columns based on the provided column mapping
            point.rename(
                columns={
                    columns.get(
                        "address"
                    ): "address_building_type_determination",
                    columns.get(
                        "building_type"
                    ): column_building_type_determination,
                },
                inplace=True,
            )
            
            # Keep only 3 columns: address, building_type, and geometry
            geometry_col_name = point.geometry.name
            cols_to_keep = [
                "address_building_type_determination",
                column_building_type_determination,
                geometry_col_name
            ]
            # Only keep columns that exist
            cols_to_keep = [col for col in cols_to_keep if col in point.columns]
            point = point[cols_to_keep]
        except Exception as e:
            if ERROR_CODE is None:
                set_error(ERROR_00046, "建物種別判定データ")
            raise Exception(e)
        point.to_crs(crs, inplace=True)
        # 水道データの全列を選択
        point_selected_column = point.columns

        polygon, _ = load_and_process_data(
            main_path, crs, "geometry_plateau", "csv", None, None
        )
        # 建物データと水道データを結合
        try:
            result, join_ratio, success_rate = assign_polygon_to_points(
                polygon, point, BUILDING_BUFFER_MUL, point_selected_column, option
            )
        except Exception as e:
            set_error(ERROR_00031)
            raise Exception(e)

        # 結果を保存
        if output_path is None:
            output_path = os.path.join(os.getcwd(), f"D901.csv")

        output_dir = os.path.dirname(output_path)

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        # Create building_type when run DT119 (建物種別判定データ)
        if column_building_type_determination in result.columns and len(building_type_values) > 0:
            # building_type_valuesに含まれていない値の行を削除（nullは保持）
            def should_keep_row(row):
                value = row[column_building_type_determination]
                # nullの場合は保持
                if pd.isna(value):
                    return True
                # building_type_valuesに含まれている場合は保持
                if value in building_type_values:
                    return True
                # それ以外は削除
                return False

            # 条件に合う行のみを保持
            result = result[
                result.apply(should_keep_row, axis=1)
            ].reset_index(drop=True)

        # Calculate building type breakdown statistics
        if task_id_summarization and job_id:
            # Check if result_summarization is string, then load it
            if isinstance(result_summarization, str):
                result_summarization = json.loads(result_summarization)
            elif not isinstance(result_summarization, dict):
                result_summarization = {}

            building_type_breakdown_total = len(result)

            # Check if 建物種別 column exists
            if column_building_type_determination in result.columns:
                # Count user_specified
                if building_type_values and len(building_type_values) > 0:
                    user_specified_count = result[
                        result[column_building_type_determination].isin(building_type_values)
                    ].shape[0]

                    # Count unknown: empty/null building type
                    unknown_count = result[
                        result[column_building_type_determination].isna() |
                        (result[column_building_type_determination] == '') |
                        (result[column_building_type_determination] == '不明')
                    ].shape[0]
                else:
                    user_specified_count = 0
                    unknown_count = building_type_breakdown_total
            else:
                user_specified_count = 0
                unknown_count = building_type_breakdown_total

            # Calculate percentages
            if building_type_breakdown_total > 0:
                user_specified_pct = (
                    user_specified_count / building_type_breakdown_total * 100
                )
                unknown_pct = (
                    unknown_count / building_type_breakdown_total * 100
                )
            else:
                user_specified_pct = 0.0
                unknown_pct = 0.0

            # Update result_summarization with new fields
            result_summarization['building_type_breakdown'] = {
                'user_specified': {
                    'percentage': user_specified_pct,
                    'count': int(user_specified_count)
                },
                'unknown': {
                    'percentage': unknown_pct,
                    'count': int(unknown_count)
                }
            }
            result_summarization['estimation_target_total_count'] = (
                building_type_breakdown_total
            )
            result_summarization['building_type_breakdown_total'] = (
                building_type_breakdown_total
            )

            # Save to database
            _, result_summarization_updated = (
                create_or_update_summarization_job_task(
                    job_id,
                    "100",
                    "preprocess_summary",
                    json.dumps(result_summarization),
                    id=task_id_summarization,
                    is_finish=True,
                )
            )

        result_job_task = {
            "joining_rate": user_specified_pct,
            "input_source": label_E015,
            "success_rate": f"{user_specified_count}件/{building_type_breakdown_total}件中",
        }

        create_or_update_job_task(
            job_id,
            progress_percent="40",
            preprocess_type="e015",
            error_code=None,
            error_msg=None,
            result=json.dumps(result_job_task, ensure_ascii=False),
            id=task_id,
        )

        save_geodataframe(result, output_path, "csv")

        return output_path, result_summarization_updated

    except Exception as e:
        print(e)
        if ERROR_CODE is None:
            set_error(ERROR_00047)

        if task_id is not None:
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type="e011",
                error_code=ERROR_CODE,
                error_msg=ERROR_MSG,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
        raise Exception(
            "空間結合処理中にエラーが発生しました。ジオメトリに不正がないか、ご確認ください。"
        )


def assign_points_to_buildings(
    buildings_gdf, points_gdf, mul, crs, point_selected_column, option, job_id, task_id_summarization, result_summarization
):
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

    # Split points into valid geometry and null geometry groups
    # Keep points with null geometry separate - they will be added back later
    points_with_null_geom = points_gdf[points_gdf["geometry"].isnull()].copy()
    points_gdf = points_gdf[points_gdf["geometry"].notnull()].copy()

    buildings_gdf = build_building_buffers(buildings_gdf, mul)

    # points_gdfにID付与（空間結合後の重複削除のために、重心との距離計算をするための準備）
    points_gdf["ID"] = range(1, len(points_gdf) + 1)
    # クイックルックアップのための辞書を作成する
    geometry_dict = points_gdf.set_index("ID")["geometry"].to_dict()

    # 結合オプションを設定（0: 交差結合、1: 最近傍結合）
    if option == 1:
        # 空間インデックスを作成
        if not points_gdf.has_sindex:
            points_gdf.sindex
        if not buildings_gdf.has_sindex:
            buildings_gdf.sindex
        joined = gpd.sjoin_nearest(
            points_gdf, buildings_gdf, how="left", distance_col="distance"
        )
        # 複数に結合しているものを削除
        joined = joined.sort_values(by="distance").drop_duplicates(
            subset="ID", keep="first"
        )
        if "geometry_right" in joined.columns:
            joined = joined.rename(
                columns={
                    "geometry_left": "geometry",
                    "geometry_right": "geometry_plateau",
                }
            )
        else:
            if "index_right" in joined.columns:
                buildings_gdf = buildings_gdf.rename(
                    columns={"geometry": "geometry_plateau"}
                )
                joined = joined.merge(
                    buildings_gdf[["geometry_plateau"]],
                    left_on="index_right",
                    right_index=True,
                    how="left",
                )
            else:
                # geometry全Nullでsjoinフォールバック経由の場合、index_rightが存在しない
                joined["geometry_plateau"] = None
        # 不要な列を削除
        columns_to_drop = ["index_right", "buffer", "centroid", "area"]
        joined = joined.drop(
            columns=[col for col in columns_to_drop if col in joined.columns]
        )
        combined_gdf = joined

        combined_gdf["geometry_plateau"] = combined_gdf[
            "geometry_plateau"
        ].fillna(combined_gdf["geometry"])

        # geometry_plateau を GeoSeries として扱う
        combined_gdf["geometry_plateau"] = gpd.GeoSeries(
            combined_gdf["geometry_plateau"], crs=combined_gdf.crs
        ).transform(_drop_z)
        combined_gdf["geometry_plateau"] = transform_to_wgs84(
            gpd.GeoSeries(
                combined_gdf["geometry_plateau"], crs=combined_gdf.crs
            ),
            crs,
        )
        combined_gdf = gpd.GeoDataFrame(combined_gdf, geometry="geometry")
        if (
            "building_id_left" in combined_gdf.columns
            and "building_id" not in combined_gdf.columns
        ):
            combined_gdf.rename(
                columns={"building_id_left": "building_id"}, inplace=True
            )

    else:
        # 空間結合(交差)の実行（ここで、水道のデータが2つ以上結合されている場合があるので、最も近いもののみを残す）
        # Chunk points_gdf to reduce RAM usage
        # Concat in batches to avoid storing all chunks in memory
        chunk_size = 5000  # Process 5000 points at a time
        batch_size = 2  # Concat every 2 chunks to reduce memory
        total_points = len(points_gdf)
        joined_chunks = []
        result_chunks = []  # Store concatenated batches

        for i in range(0, total_points, chunk_size):
            # Get chunk of points
            points_chunk = points_gdf.iloc[i:i + chunk_size].copy()
            
            # Perform spatial join on chunk
            joined_chunk = gpd.sjoin(
                points_chunk, buildings_gdf, how="left", predicate="intersects"
            )

            # Check if joined_chunk is empty
            if joined_chunk.empty:
                del points_chunk, joined_chunk
                gc.collect()
                continue

            # Find centroid column (could be "centroid" or "centroid_right" after sjoin)
            centroid_col = None
            for col in ["centroid", "centroid_right"]:
                if col in joined_chunk.columns:
                    centroid_col = col
                    break

            # Create GeoSeries of point geometries based on ID
            point_geometries = joined_chunk["ID"].map(geometry_dict)
            point_geoseries = gpd.GeoSeries(
                point_geometries, crs=joined_chunk.crs
            )

            # Calculate distance vectorized (only where both centroid and ID exist)
            if centroid_col:
                centroid_geoseries = gpd.GeoSeries(
                    joined_chunk[centroid_col], crs=joined_chunk.crs
                )
                valid_mask = (
                    joined_chunk[centroid_col].notna()
                    & joined_chunk["ID"].notna()
                    & joined_chunk["ID"].isin(geometry_dict.keys())
                )

                # Initialize distance column with NaN
                joined_chunk["distance"] = None
                # Calculate distance only for valid rows using vectorized operation
                if valid_mask.any():
                    distance_values = (
                        centroid_geoseries[valid_mask].distance(
                            point_geoseries[valid_mask]
                        ).values
                    )
                    joined_chunk.loc[valid_mask, "distance"] = distance_values
                del centroid_geoseries
            else:
                # No centroid column found, set distance to None
                joined_chunk["distance"] = None

            # Append to temporary list
            joined_chunks.append(joined_chunk)
            
            # Release memory for intermediate variables
            del points_chunk, point_geometries, point_geoseries
            
            # Concat batch when reaching batch_size
            if len(joined_chunks) >= batch_size:
                batch_result = pd.concat(joined_chunks, ignore_index=True)
                result_chunks.append(batch_result)
                del joined_chunks, batch_result
                joined_chunks = []
                gc.collect()

        # Concat remaining chunks
        if joined_chunks:
            batch_result = pd.concat(joined_chunks, ignore_index=True)
            result_chunks.append(batch_result)
            del joined_chunks, batch_result
            gc.collect()

        # Concatenate all result batches
        if result_chunks:
            joined = pd.concat(result_chunks, ignore_index=True)
            # Ensure it's a GeoDataFrame (concat may return DataFrame)
            if not isinstance(joined, gpd.GeoDataFrame):
                # Find geometry column (could be geometry_left or geometry)
                geom_col = None
                for col in ['geometry_left', 'geometry']:
                    if col in joined.columns:
                        geom_col = col
                        break
                if geom_col:
                    joined = gpd.GeoDataFrame(joined, geometry=geom_col, crs=points_gdf.crs)
            del result_chunks
            gc.collect()
        else:
            # Create empty GeoDataFrame with same structure
            points_col_set = set(points_gdf.columns)
            joined = gpd.GeoDataFrame(
                columns=points_gdf.columns.tolist() +
                [col for col in buildings_gdf.columns if col != 'geometry' and col not in points_col_set],
                geometry="geometry",
                crs=points_gdf.crs
            )
        
        # 　sjoinでindexが重複しているので、リセット
        joined = joined.reset_index(drop=True)
        if (
            "building_id_left" in joined.columns
            and "building_id" not in joined.columns
        ):
            if "building_id_right" in joined.columns:
                joined = joined.rename(
                    columns={"building_id_right": "building_id"}
                )
            else:
                joined = joined.rename(
                    columns={"building_id_left": "building_id"}
                )

        # Ensure building_id column exists
        if "building_id" not in joined.columns:
            # If building_id doesn't exist, create it as all NaN
            joined["building_id"] = None

        # Get matched and unmatched rows using query to avoid index issues
        matched = joined.dropna(subset=["building_id"]).copy()
        
        # For unmatched, use query or boolean indexing with iloc
        # First ensure index is definitely unique
        joined = joined.reset_index(drop=True)
        
        # Use query method which handles indexing better
        try:
            unmatched = joined.query("building_id.isna()").copy()
        except Exception:
            # Fallback: use boolean mask with iloc
            na_mask = joined["building_id"].isna().values
            unmatched = joined.iloc[na_mask].copy()

        # Generate custom building IDs for unmatched rows (those without building_id)
        # Format: cus_bldg_{incremental number starting from 10000}
        if not unmatched.empty:
            # Generate incremental IDs starting from 10000
            num_unmatched = len(unmatched)
            new_ids = [f"cus_bldg_{10000 + i}" for i in range(num_unmatched)]

            # Assign new IDs to unmatched rows
            unmatched = unmatched.copy()
            unmatched["building_id"] = new_ids

        # Count points that matched before grouping (for success_rate)
        # Count unique point IDs that have at least one building match
        matched_points_before_groupby = (
            matched["ID"].nunique() if not matched.empty else 0
        )

        if not matched.empty:
            result_gdf = matched.loc[
                matched.groupby("ID")["distance"].idxmin().tolist()
            ]

            combined_gdf = pd.concat([unmatched, result_gdf], ignore_index=True)
        else:
            combined_gdf = unmatched.copy()

        # 結合後にgeometryの列名が変わるので修正
        if "geometry_right" in combined_gdf.columns:
            combined_gdf = combined_gdf.rename(
                columns={
                    "geometry_left": "geometry",
                    "geometry_right": "geometry_plateau",
                }
            )
        else:
            if "index_right" in combined_gdf.columns:
                buildings_gdf = buildings_gdf.rename(
                    columns={"geometry": "geometry_plateau"}
                )
                combined_gdf = combined_gdf.merge(
                    buildings_gdf[["geometry_plateau"]],
                    left_on="index_right",
                    right_index=True,
                    how="left",
                )
            else:
                # geometry全Nullでsjoinフォールバック経由の場合、index_rightが存在しない
                combined_gdf["geometry_plateau"] = None

        combined_gdf["geometry_plateau"] = combined_gdf[
            "geometry_plateau"
        ].fillna(combined_gdf["geometry"])

        combined_gdf["geometry_plateau"] = gpd.GeoSeries(
            combined_gdf["geometry_plateau"], crs=combined_gdf.crs
        ).transform(_drop_z)
        combined_gdf["geometry_plateau"] = transform_to_wgs84(
            gpd.GeoSeries(
                combined_gdf["geometry_plateau"], crs=combined_gdf.crs
            ),
            crs,
        )
        # 建物のジオメトリに設定しなおして、GeoDataFrameに変換
        combined_gdf = gpd.GeoDataFrame(combined_gdf, geometry="geometry_plateau")

        # 不要な列を削除
        columns_to_drop = [
            "centroid",
            "area",
            "index_left",
            "index_right",
            "buffer",
            "distance",
        ]
        combined_gdf = combined_gdf.drop(
            columns=[
                col for col in columns_to_drop if col in combined_gdf.columns
            ]
        )

    combined_gdf.to_crs(4326, inplace=True)

    # Add back points with null geometry (they were filtered out earlier)
    if not points_with_null_geom.empty:
        # Convert geometry column to WGS84 first (before using it)
        if "geometry" in points_with_null_geom.columns:
            # Check if it has valid geometries that need CRS transform
            has_valid_geom = points_with_null_geom["geometry"].notna().any()
            if has_valid_geom and points_with_null_geom.crs is not None:
                points_with_null_geom = points_with_null_geom.to_crs(4326)
            else:
                points_with_null_geom = points_with_null_geom.set_crs(
                    4326, allow_override=True
                )

        # Ensure consistent schema - add missing columns from combined_gdf
        for col in combined_gdf.columns:
            if col not in points_with_null_geom.columns:
                points_with_null_geom[col] = None

        # Fill geometry_plateau with geometry (points_with_null_geom has geometry,
        # but combined_gdf uses geometry_plateau as main geometry)
        if "geometry_plateau" in points_with_null_geom.columns:
            points_with_null_geom["geometry_plateau"] = (
                points_with_null_geom["geometry_plateau"]
                .fillna(points_with_null_geom["geometry"])
            )
        else:
            # If geometry_plateau doesn't exist, create it from geometry
            points_with_null_geom["geometry_plateau"] = (
                points_with_null_geom["geometry"]
            )

        # Drop old "geometry" column to avoid CRS mismatch during concat
        # (keep only geometry_plateau as the main geometry)
        if "geometry" in combined_gdf.columns:
            combined_gdf = combined_gdf.drop(columns=["geometry"], errors="ignore")
        if "geometry" in points_with_null_geom.columns:
            points_with_null_geom = points_with_null_geom.drop(columns=["geometry"], errors="ignore")

        # Reorder columns to match combined_gdf
        points_with_null_geom = points_with_null_geom[combined_gdf.columns]

        # Ensure geometry_plateau column has correct CRS
        points_with_null_geom = gpd.GeoDataFrame(
            points_with_null_geom, geometry="geometry_plateau", crs=4326
        )

        # Concatenate back the null geometry points
        combined_gdf = pd.concat(
            [combined_gdf, points_with_null_geom], ignore_index=True
        )
        combined_gdf = gpd.GeoDataFrame(
            combined_gdf, geometry="geometry_plateau", crs=4326
        )

    combined_gdf = clean_geometry(combined_gdf)

    # 結合率の算出
    # Total points includes both valid and null geometry points
    num_points = points_gdf.shape[0] + points_with_null_geom.shape[0]

    # Count points that successfully joined
    # For option != 1 (intersect join), use the count before groupby
    if option == 1:
        # For nearest join, count from final result
        if "building_id" in combined_gdf.columns:
            matched_points = combined_gdf[
                combined_gdf["building_id"].notna()
            ]["ID"].nunique()
        else:
            matched_points = 0
    else:
        matched_points = matched_points_before_groupby

    join_ratio = (
        round(matched_points / num_points * 100, 2) if num_points > 0 else 0
    )

    success_rate = f"{matched_points}件/{num_points}件中"

    combined_gdf = combined_gdf.drop(
        columns=["ID"], errors="ignore"
    )
    result_summarization_updated = None

    # Count records with null geometry_plateau
    excluded_from_display_count = len(points_with_null_geom)

    # Calculate building polygon breakdown statistics (after all data merged)
    if task_id_summarization and job_id:
        # Check if result_summarization is string, then load it
        if isinstance(result_summarization, str):
            result_summarization = json.loads(result_summarization)
        elif not isinstance(result_summarization, dict):
            result_summarization = {}

        building_polygon_breakdown_total = len(combined_gdf)

        # Check if geometry_plateau exists
        if 'geometry_plateau' in combined_gdf.columns:
            # Count buildings with actual polygon (vectorized)
            # Check: is Polygon/MultiPolygon (not Point or null)
            geom_types = combined_gdf['geometry_plateau'].geom_type
            is_polygon = geom_types.isin(['Polygon', 'MultiPolygon'])
            is_point = geom_types == 'Point'

            # building_polygon_display: has Polygon/MultiPolygon geometry
            building_polygon_display_count = is_polygon.sum()

            # point_display: has Point geometry
            point_display_count = is_point.sum()
        else:
            # If no geometry_plateau column
            building_polygon_display_count = 0
            point_display_count = building_polygon_breakdown_total - excluded_from_display_count

        # Calculate percentages
        if building_polygon_breakdown_total > 0:
            building_polygon_display_pct = round(
                building_polygon_display_count / building_polygon_breakdown_total * 100, 2
            )
            point_display_pct = round(
                point_display_count / building_polygon_breakdown_total * 100, 2
            )
            excluded_from_display_pct = round(
                excluded_from_display_count / building_polygon_breakdown_total * 100, 2
            )
        else:
            building_polygon_display_pct = 0.0
            point_display_pct = 0.0
            excluded_from_display_pct = 0.0

        # Update result_summarization with new fields
        result_summarization['building_polygon_breakdown'] = {
            'with_polygon': {
                'percentage': building_polygon_display_pct,
                'count': int(building_polygon_display_count)
            },
            'without_polygon': {
                'percentage': point_display_pct,
                'count': int(point_display_count)
            },
            'excluded_from_display': {
                'percentage': excluded_from_display_pct,
                'count': int(excluded_from_display_count)
            }
        }
        result_summarization['estimation_target_total_count'] = (
            building_polygon_breakdown_total
        )
        result_summarization['building_polygon_breakdown_total'] = (
            building_polygon_breakdown_total
        )

        _, result_summarization_updated = (
            create_or_update_summarization_job_task(
                job_id,
                "70",
                "preprocess_summary",
                json.dumps(result_summarization),
                id=task_id_summarization,
                is_finish=False,
            )
        )

    return combined_gdf, join_ratio, success_rate, result_summarization_updated


def process_data(
    tatemono_path,
    e14_merged_path,
    gpkg_path,
    option,
    output_type,
    output_path=None,
    job_id=None,
    db_path=None,
    geometry="geometry",
    input_source="",
    file_type="",
    data_type="",
    columns=None,
    logs_dir=None,
    task_id_summarization=None,
    result_summarization=None,
    municipality=None,
):
    logger = None
    # task_id は except でも参照する。try の内側で束縛すると、ロガー初期化や接続で
    # 失敗したときに except 自身が UnboundLocalError で落ち、エラーを記録できなくなる。
    task_id = None
    try:
        if logs_dir:
            logger = get_rotating_logger(logs_dir, logger_name="E016")
        else:
            logs_dir = os.path.join(output_path, "logs")
            logger = get_rotating_logger(logs_dir, logger_name="E016")
        if db_path:
            connect_sqllite(db_path)
        if job_id:
            task_id = create_or_update_job_task(
                job_id,
                progress_percent="0",
                preprocess_type="e016",
                error_code=None,
                error_msg=None,
                result=None,
            )
        # E014出力データを読み込み
        e14_merged, _ = load_and_process_data(
            e14_merged_path, None, None, "csv", None, columns
        )

        if tatemono_path:
            # === 建物ポリゴンあり: 空間結合を実行 ===
            try:
                tatemono, crs = load_and_process_data(
                    tatemono_path, BUILDING_MATCH_CRS, geometry, file_type, data_type, columns
                )
                if "fid" not in tatemono.columns:
                    tatemono["fid"] = range(1, len(tatemono) + 1)
            except Exception as e:
                if ERROR_CODE is None:
                    set_error(ERROR_00043)
                    raise Exception(
                        f"建物ポリゴンのデータが異常です。もう一度データを確認ください。"
                    )
                raise Exception(e)

            # 建物ポリゴン読み込み成功後に進捗を記録（ポリゴンなしパスにも同様の記録あり）
            if job_id:
                create_or_update_job(job_id, "80")
                create_or_update_job_task(
                    job_id,
                    progress_percent="20",
                    preprocess_type="e016",
                    error_code=None,
                    error_msg=None,
                    result=None,
                    id=task_id,
                )
            tatemono.to_crs(crs, inplace=True)
            e14_merged.to_crs(crs, inplace=True)

            point_selected_column = e14_merged.columns

            try:
                tatemono_use_point, join_ratio, success_rate, result_summarization_updated = assign_points_to_buildings(
                    tatemono, e14_merged, BUILDING_BUFFER_MUL, crs, point_selected_column, option, job_id, task_id_summarization, result_summarization
                )
            except Exception as e:
                traceback.print_exc()
                set_error(ERROR_00031)
                raise Exception(
                    "CSV形式で建物ポリゴンデータを入力している場合、ジオメトリカラムの指定や記載に誤りがないかなどをご確認ください。ジオコーディング済みデータのファイル形式や緯度経度のカラム指定に誤りがないか、緯度経度データに不備がないかご確認ください。"
                )
        else:
            # === ポリゴンなしパス: ジオコーディング座標からポイントを生成 ===
            # ポリゴンありパスで建物に紐づかなかった未マッチレコードと同等のデータ構造を生成する。
            # 差分: 空間結合自体を行わない。
            logger.info("building_polygon が未指定のため空間結合をスキップし、ジオコーディング座標からポイントを生成")

            # 読み込みステップがないため即座に進捗を記録（ポリゴンありパスにも同様の記録あり）
            if job_id:
                create_or_update_job(job_id, "80")
                create_or_update_job_task(
                    job_id,
                    progress_percent="20",
                    preprocess_type="e016",
                    error_code=None,
                    error_msg=None,
                    result=None,
                    id=task_id,
                )

            tatemono_use_point = e14_merged.copy()

            # geometry_plateau を geometry（ジオコーディング座標の Point）から作成
            tatemono_use_point["geometry_plateau"] = tatemono_use_point["geometry"]
            if "geometry" in tatemono_use_point.columns:
                tatemono_use_point = tatemono_use_point.drop(columns=["geometry"])
            tatemono_use_point = gpd.GeoDataFrame(
                tatemono_use_point, geometry="geometry_plateau", crs=4326
            )

            # cus_bldg_* IDを付与（assign_points_to_buildings の未マッチと同等: E016.py:2020-2029）
            num_records = len(tatemono_use_point)
            tatemono_use_point["building_id"] = [
                f"cus_bldg_{10000 + i}" for i in range(num_records)
            ]

            join_ratio = 0
            success_rate = f"0件/{num_records}件中"

            # building_polygon_breakdown の統計を算出
            result_summarization_updated = None
            if task_id_summarization and job_id:
                if isinstance(result_summarization, str):
                    result_summarization = json.loads(result_summarization)
                elif not isinstance(result_summarization, dict):
                    result_summarization = {}

                excluded_from_display_count = int(
                    tatemono_use_point["geometry_plateau"].isna().sum()
                )
                point_display_count = num_records - excluded_from_display_count

                if num_records > 0:
                    point_display_pct = round(
                        point_display_count / num_records * 100, 2
                    )
                    excluded_pct = round(
                        excluded_from_display_count / num_records * 100, 2
                    )
                else:
                    point_display_pct = 0.0
                    excluded_pct = 0.0

                result_summarization['building_polygon_breakdown'] = {
                    'with_polygon': {
                        'percentage': 0.0, 'count': 0
                    },
                    'without_polygon': {
                        'percentage': point_display_pct,
                        'count': int(point_display_count),
                    },
                    'excluded_from_display': {
                        'percentage': excluded_pct,
                        'count': int(excluded_from_display_count),
                    },
                }
                result_summarization['estimation_target_total_count'] = (
                    num_records
                )
                result_summarization['building_polygon_breakdown_total'] = (
                    num_records
                )

                _, result_summarization_updated = (
                    create_or_update_summarization_job_task(
                        job_id,
                        "70",
                        "preprocess_summary",
                        json.dumps(result_summarization),
                        id=task_id_summarization,
                        is_finish=False,
                    )
                )
        if job_id:
            create_or_update_job(job_id, "85")
            create_or_update_job_task(
                job_id,
                progress_percent="50",
                preprocess_type="e016",
                error_code=None,
                error_msg=None,
                result=None,
                id=task_id,
            )
        # 住居IDを追加
        tatemono_use_point = add_residenceID(tatemono_use_point)

        if job_id:
            create_or_update_job_task(
                job_id,
                progress_percent="70",
                preprocess_type="e016",
                error_code=None,
                error_msg=None,
                result=None,
                id=task_id,
            )
        # 地域コードと町丁字名の付与。
        # 国勢調査データ未指定時は KEY_CODE/S_NAME を空列で補完する
        # （地域集計は推定側 E032 が area_grouping ポリゴンで再結合するため、
        # 名寄せ出力の KEY_CODE/S_NAME は後方互換目的の空列で足りる）。
        if gpkg_path:
            try:
                tatemono_use_point_add_keycode = add_keycode(
                    tatemono_use_point, gpkg_path
                )
            except Exception as e:
                if ERROR_CODE is None:
                    set_error(ERROR_00034)
                    raise Exception(
                        f"建物ポリゴンデータもしくは国勢調査データのジオメトリが不正なため、エラーが発生しました。"
                    )
                raise Exception(e)
        else:
            tatemono_use_point_add_keycode = tatemono_use_point
            for col in ("KEY_CODE", "S_NAME"):
                if col not in tatemono_use_point_add_keycode.columns:
                    tatemono_use_point_add_keycode[col] = None


        # 結果を保存
        if output_path is None:
            output_path = os.path.join(os.getcwd(), f"D901.{output_type}")

        output_dir = os.path.dirname(output_path)

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        if job_id:
            create_or_update_job(job_id, "90")

        save_geodataframe(
            tatemono_use_point_add_keycode, output_path, output_type
        )

        if job_id:
            result = {
                "joining_rate": join_ratio,
                "input_source": input_source,
                "success_rate": success_rate
            }
            create_or_update_job_task(
                job_id,
                progress_percent="100",
                preprocess_type="e016",
                error_code=None,
                error_msg=None,
                result=json.dumps(result, ensure_ascii=False),
                id=task_id,
                is_finish=True,
            )

        return output_path, result_summarization_updated
    except Exception as e:
        if logger:
            logger.error("E016 failed:\n%s", traceback.format_exc())
        # 記録より先にフォールバック(E-0019)を立てる。順序が逆だと想定外の例外で
        # ERROR_MSG が None のまま記録され、画面が原因を示せなくなる。
        is_fallback = ERROR_CODE is None
        if is_fallback:
            set_error(ERROR_00019)
        if task_id is not None:
            create_or_update_job_task(
                job_id,
                progress_percent="",
                preprocess_type="e016",
                error_code=ERROR_CODE,
                error_msg=ERROR_MSG,
                result=json.dumps({}),
                id=task_id,
                is_finish=True,
            )
        if is_fallback:
            raise Exception(
                "空間結合処理中にエラーが発生しました。ジオメトリに不正がないか、ご確認ください。"
            )
        raise Exception(e)


def merge_building_type_determination(
    main_file_path: str,
    sub_file_path: str,
    output_directory: str,
    columns: dict,
    building_type_values: list,
    job_id: int,
    task_id: int,
    task_id_summarization: int,
    result_summarization: dict,
    label_E015: str,
    municipality=None,
):
    building_type_df = read_file(sub_file_path)
    main_df = read_file(main_file_path)

    # Get column names from mapping
    addr_col = columns.get("address", "地番住所")
    building_type_col = columns.get("building_type", "建物種別")
    right_key = "address_building_type_determination"
    building_usage_col = "usage_building_type_determination"

    # Rename columns
    building_type_df = building_type_df.rename(columns={
        addr_col: right_key,
        building_type_col: building_usage_col,
    })

    # Drop duplicates and normalize address
    building_type_df = building_type_df.drop_duplicates(
        right_key, keep=False
    )
    normalizer = partial(normalize_address_full, municipality=municipality)
    building_type_df["temp_addr"] = building_type_df[right_key].apply(normalizer)

    # Clean data before converting to Polars
    # Convert object columns to string explicitly
    # to avoid Arrow type errors
    object_cols_main = main_df.select_dtypes(include=['object']).columns
    object_cols_sub = building_type_df.select_dtypes(
        include=['object']
    ).columns

    # Vectorized conversion: fillna then convert to string
    if len(object_cols_main) > 0:
        main_df[object_cols_main] = (
            main_df[object_cols_main].fillna('').astype(str)
        )
    if len(object_cols_sub) > 0:
        building_type_df[object_cols_sub] = (
            building_type_df[object_cols_sub].fillna('').astype(str)
        )

    # Convert to Polars
    main_pl = pl.from_pandas(main_df)
    sub_pl = pl.from_pandas(building_type_df)
    del main_df, building_type_df
    result_pl = main_pl.join(
        sub_pl,
        left_on="normalized_address",
        right_on="temp_addr",
        how="left",
    )
    del main_pl, sub_pl

    # Drop temp column
    if "temp_addr" in result_pl.columns:
        result_pl = result_pl.drop("temp_addr")

    building_type_breakdown_total = result_pl.height

    if building_usage_col in result_pl.columns and len(result_pl.columns) > 0:
        # Fill null with empty string
        result_pl = result_pl.with_columns(
            pl.col(building_usage_col).fill_null("").alias(building_usage_col)
        )

        if building_type_values:
            # Filter: keep specified types + empty/null
            result_pl = result_pl.filter(
                pl.col(building_usage_col).is_in(building_type_values) |
                (pl.col(building_usage_col) == "") |
                pl.col(building_usage_col).is_null()
            )

            # Add flag for empty building type
            result_pl = result_pl.with_columns(
                (pl.col(building_usage_col) == "").cast(pl.Int64)
                .alias("buildingtype_determination_not_possible_flag")
            )

            building_type_breakdown_total = result_pl.height
    else:
        result_pl = result_pl.with_columns(
            pl.lit(1).alias("buildingtype_determination_not_possible_flag")
        )

    # Calculate building type breakdown statistics (using polars for speed)
    result_summarization_updated = None
    if task_id_summarization and job_id:
        # Check if result_summarization is string, then load it
        if isinstance(result_summarization, str):
            result_summarization = json.loads(result_summarization)
        elif not isinstance(result_summarization, dict):
            result_summarization = {}

        # Check if 建物種別 column exists
        if building_usage_col in result_pl.columns:
            # Count user_specified: buildings with type in building_type_values
            if building_type_values and len(building_type_values) > 0:
                user_specified_count = result_pl.filter(
                    pl.col(building_usage_col).is_in(building_type_values)
                ).height

                # Count unknown: buildings with empty/null building type
                unknown_count = result_pl.filter(
                    pl.col(building_usage_col).is_null() |
                    (pl.col(building_usage_col) == '') |
                    (pl.col(building_usage_col) == '不明')
                ).height

            else:
                user_specified_count = 0
                unknown_count = building_type_breakdown_total
            
        else:
            user_specified_count = 0
            unknown_count = building_type_breakdown_total

        # Calculate percentages
        if building_type_breakdown_total > 0:
            user_specified_pct = (
                user_specified_count / building_type_breakdown_total * 100
            )
            unknown_pct = (
                unknown_count / building_type_breakdown_total * 100
            )
        else:
            user_specified_pct = 0.0
            unknown_pct = 0.0

        # Update result_summarization with new fields
        result_summarization['building_type_breakdown'] = {
            'user_specified': {
                'percentage': user_specified_pct,
                'count': int(user_specified_count)
            },
            'unknown': {
                'percentage': unknown_pct,
                'count': int(unknown_count)
            }
        }
        result_summarization['estimation_target_total_count'] = (
            building_type_breakdown_total
        )
        result_summarization['building_type_breakdown_total'] = (
            building_type_breakdown_total
        )

        # Save to database
        _, result_summarization_updated = (
            create_or_update_summarization_job_task(
                job_id,
                "100",
                "preprocess_summary",
                json.dumps(result_summarization),
                id=task_id_summarization,
                is_finish=True,
            )
        )

    # Convert back to pandas for saving
    result = result_pl.to_pandas()
    del result_pl

    output_path = f"{output_directory}/DT119.csv"
    save_geodataframe(result, output_path, "csv")

    result_job_task = {
        "joining_rate": user_specified_pct,
        "input_source": label_E015,
        "success_rate": f"{user_specified_count}件/{building_type_breakdown_total}件中",
    }

    create_or_update_job_task(
        job_id,
        progress_percent="40",
        preprocess_type="e015",
        error_code=None,
        error_msg=None,
        result=json.dumps(result_job_task, ensure_ascii=False),
        id=task_id,
    )

    return output_path, result_summarization_updated


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