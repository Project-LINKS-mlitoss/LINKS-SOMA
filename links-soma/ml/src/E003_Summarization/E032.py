"""
# E032 地域集計機能
* 町丁字単位等の地域単位での集計を実施。
* 空き家判定データとユーザーがアップロードした地域ポリゴンデータを結合し、地域単位で集計し、新規アセットとして保存する機能を提供する。この際、ポリゴンとポリゴンの交差判定を行い、複数のポリゴンにまたがる場合には建物ポリゴンと交差する面積の割合が多いポリゴンへ集計されることとする。
"""

import json
import sys
import traceback

import pandas as pd
import numpy as np
import geopandas as gpd
import os
import shutil
import zipfile 
from shapely.geometry import MultiPolygon, Polygon
from shapely.wkt import loads as load_wkt
from shapely import wkt
import chardet
from pandas.errors import ParserError
import fiona

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
    
ERROR_CODE=None
ERROR_MSG=None

class Summarization:
    def __init__(self, input_paths, output_path, key_column, data_set_result_id):
        # 入力ファイルのパスを設定
        self.INPUT_PATHS = input_paths
        # 出力ファイルのパスを設定
        self.OUTPUT_PATH = output_path
        # 集計に使用するカラム名を設定
        self.key_column = key_column
        key_code = key_column
        if isinstance(key_code, list):
            key_code = key_column[0]
            if key_column[0] == key_column[1]:
                self.key_column = [
                    key_column[0],
                    f"{key_column[1]}_S_NAME_TEMP"
                ]

        self.data_set_result_id = data_set_result_id
        # 各データで使用するカラムを定義
        # Create mappings for vacant_house_count columns (thresholds 5-95)
        predicted_label_mappings = {
            f"predicted_label_{threshold:02d}": (
                f"predicted_label_{threshold:02d}"
            )
            for threshold in range(5, 96, 5)
        }
        
        self.INPUT_COLUMNS = {
            "akiya_pred": {
                "predicted_label": "predicted_label",
                "geometry": "geometry",
                "household_size": "世帯人数",
                "members_under_15": "15歳未満人数",
                "members_over_65": "65歳以上人数",
                "normalized_address": "正規化住所",
                **predicted_label_mappings
            },
            "city_block": {
                "KEY_CODE": key_code,
                "city_block_geometry": "geometry"
            }
        }

    def summarize_city_block(self, gdf):
        """
        市区町村ブロックごとの集計を行う関数。

        Parameters:
        -----------
        gdf : GeoDataFrame
            空間結合されたGeoDataFrame。各建物情報と地域の情報を含む。

        Returns:
        --------
        GeoDataFrame
            地域ごとの住戸数、空き家数、空き家率、若年層率、高齢者率を集計したGeoDataFrame。
        """
        akiya_pred_cols = self.INPUT_COLUMNS["akiya_pred"]
        # 0 is key_code(KEY_CODE), 1 is area_group(S_NAME)
        key_col = self.key_column[0]
        area_group_col = self.key_column[1]

        # Create vacant_house_count aggregations for thresholds 5-95 (step 5)
        vacant_house_agg = {
            f"vacant_house_count_{threshold:02d}": (
                akiya_pred_cols[f"predicted_label_{threshold:02d}"],
                "sum"
            )
            for threshold in range(5, 96, 5)
        }
        
        grouped_by_area = gdf.groupby(area_group_col).agg(
            total_building_count=(akiya_pred_cols["normalized_address"], "count"),
            vacant_house_count=(akiya_pred_cols["predicted_label"], "sum"),
            **vacant_house_agg,
            total_household_size=(akiya_pred_cols["household_size"], "sum"),
            number_of_under_15_years_old=(akiya_pred_cols["members_under_15"], "sum"),
            number_of_over_65_years_old=(akiya_pred_cols["members_over_65"], "sum"),
            reference_date=("reference_date", "first")  
        )
        grouped_by_area.reset_index(inplace=True)

        # Calculate rates for grouped data
        grouped_by_area["predicted_probability"] = grouped_by_area.apply(
            lambda row: row["vacant_house_count"] / row["total_building_count"] if row["total_building_count"] != 0 else 0,
            axis=1
        )
        # Calculate predicted_probability for all thresholds (5-95, step 5)
        # Use np.where for better performance and clarity
        for threshold in range(5, 96, 5):
            col_name = f"predicted_probability_{threshold:02d}"
            vacant_col = f"vacant_house_count_{threshold:02d}"
            # Divide by zero handling: where 住戸数 is 0, result is 0
            grouped_by_area[col_name] = np.where(
                grouped_by_area["total_building_count"] != 0,
                grouped_by_area[vacant_col] / grouped_by_area["total_building_count"],
                0
            )
        grouped_by_area["young_population_ratio"] = (
            grouped_by_area["number_of_under_15_years_old"] / grouped_by_area["total_household_size"]
        )
        grouped_by_area["elderly_population_ratio"] = (
            grouped_by_area["number_of_over_65_years_old"] / grouped_by_area["total_household_size"]
        )

        # Get unique combinations of key_code and area_group
        unique_pairs = gdf[[key_col, area_group_col]].drop_duplicates()
        # Merge grouped values back to all key_code-area_group pairs
        summerized_gdf = pd.merge(
            unique_pairs,
            grouped_by_area,
            on=area_group_col,
            how="left"
        )

        return summerized_gdf
    
    def remove_z_coordinate(self, geometry):
        """
        ジオメトリからZ座標（高さ情報）を除去する関数。
    
        Parameters:
        -----------
        geometry : shapely.geometry
            Z座標を含む可能性のあるPolygonまたはMultiPolygonジオメトリ。
    
        Returns:
        --------
        shapely.geometry
            Z座標を除去したジオメトリ。
        """
        if geometry.geom_type == 'Polygon':
            return Polygon([(x, y) for x, y, z in geometry.exterior.coords])
        elif geometry.geom_type == 'MultiPolygon':
            new_polygons = []
            for poly in geometry.geoms:
                new_polygons.append(Polygon([(x, y) for x, y, z in poly.exterior.coords]))
            return MultiPolygon(new_polygons)
        else:
            return geometry
    
    

    def spatial_join(self, residence_gdf, city_block_gdf):
        """
        空き家判定データと市区町村ブロックデータを空間結合する関数。
        空間インデックスを利用し、residence_gdfのジオメトリの重心（centroid）で空間結合を行います。
        """
        
        # 重心（centroid）を計算する前に、投影座標系（EPSG:4326）に変換
        residence_gdf_projected = residence_gdf.to_crs(epsg=4326)

        # 重心（centroid）を計算し、新しい 'centroid_geometry' 列に格納
        residence_gdf_projected['centroid_geometry'] = residence_gdf_projected.centroid.to_crs(epsg=4326)

        # 重心の計算後、元の座標系（EPSG:4326）に戻す
        residence_gdf = residence_gdf_projected.to_crs(epsg=4326)

        # 空間インデックスを利用した結合
        if not residence_gdf.has_sindex:
            residence_gdf.sindex  # 空間インデックスを作成
        if not city_block_gdf.has_sindex:
            city_block_gdf.sindex  # 空間インデックスを作成

        # 空間結合を実施（centroid_geometry列を使用）
        spatial_join_gdf = gpd.sjoin(residence_gdf.set_geometry('centroid_geometry'), 
                                    city_block_gdf, how="inner", predicate="intersects", 
                                    lsuffix='left', rsuffix='right')

        # centroidではなく元のgeometry列を使用するため、元に戻す
        spatial_join_gdf = spatial_join_gdf.set_geometry('geometry')

        return spatial_join_gdf

    def insert_data_set_detail_areas(self, summerized_df, data_set_result_id, key_column):
        """
        集計結果をSQLiteデータベースに挿入する関数。
    
        Parameters:
        -----------
        summerized_df : DataFrame
            SQLiteデータベースに挿入するための集計済みデータ。
        """
        try:
            vacant_house_and_predicted_probability_mappings = {}
            for threshold in range(5, 96, 5):
                vacant_house_and_predicted_probability_mappings[
                    f"vacant_house_count_{threshold:02d}"
                ] = f"vacant_house_count_{threshold:02d}"
                vacant_house_and_predicted_probability_mappings[
                    f"predicted_probability_{threshold:02d}"
                ] = f"predicted_probability_{threshold:02d}"
            # カラム名の日本語を英語に変換
            mapping_header = {
                'total_building_count': 'total_building_count',
                'vacant_house_count': 'vacant_house_count',
                'young_population_ratio': 'young_population_ratio',
                'elderly_population_ratio': 'elderly_population_ratio',
                'predicted_probability': 'predicted_probability',
                **vacant_house_and_predicted_probability_mappings,
                'reference_date': 'reference_date',
                'AREA': 'area',
                'geometry': 'geometry'
            }

            if isinstance(key_column, list):
                mapping_header[key_column[0]] = 'key_code'
                mapping_header[key_column[1]] = 'area_group'
            else:
                mapping_header['KEY_CODE'] = 'key_code'
                mapping_header['S_NAME'] = 'area_group'
            
            summerized_df['geometry'] = summerized_df['geometry'].apply(lambda x: x.wkt if x else None)
            summerized_df = summerized_df.rename(columns=mapping_header)
            
            existing_columns = summerized_df.columns.tolist()
            mapped_columns = [col for col in mapping_header.values() if col in existing_columns]
            summerized_df = summerized_df[mapped_columns]
            # SQLiteに接続し、データを挿入            
            summerized_df['data_set_result_id'] = data_set_result_id 
            if 'reference_date' not in summerized_df.columns:
                summerized_df['reference_date'] = ""
            
            # Find the first valid reference_date that is not NaN, None, or empty
            reference_date_value = summerized_df.loc[
                summerized_df['reference_date'].notna() & (summerized_df['reference_date'] != ''), 
                'reference_date'
            ].iloc[0] if not summerized_df.loc[
                summerized_df['reference_date'].notna() & (summerized_df['reference_date'] != ''), 
                'reference_date'
            ].empty else ''

            # Replace NaN, None, and empty values with the found value (or leave it empty if no valid value is found)
            summerized_df['reference_date'] = summerized_df['reference_date'].fillna(reference_date_value).replace([None, '', pd.NA], reference_date_value)
            summerized_df['predicted_probability'] = summerized_df['predicted_probability'].fillna(0)
            summerized_df['vacant_house_count'] = summerized_df['vacant_house_count'].fillna(0)
            for threshold in range(5, 96, 5):
                vacant_house_count_col_name = f"vacant_house_count_{threshold:02d}"
                predicted_probability_col_name = f"predicted_probability_{threshold:02d}"
                summerized_df[vacant_house_count_col_name] = summerized_df[vacant_house_count_col_name].fillna(0)
                summerized_df[predicted_probability_col_name] = summerized_df[predicted_probability_col_name].fillna(0)
            summerized_df['total_building_count'] = summerized_df['total_building_count'].fillna(0)
            summerized_df['area'] = summerized_df['area'].fillna(0)
            summerized_df['young_population_ratio'] = summerized_df['young_population_ratio'].fillna(0)
            summerized_df['elderly_population_ratio'] = summerized_df['elderly_population_ratio'].fillna(0)

            # Group by area_group and sum metrics
            if 'area_group' in summerized_df.columns:
                agg_dict = {}
                for col in [
                    'area',  # 地域面積(Area size)
                ]:
                    if col in summerized_df.columns:
                        agg_dict[col] = 'sum'
                if agg_dict:
                    grouped = summerized_df.groupby('area_group').agg(agg_dict)

                    for col in grouped.columns:
                        summerized_df[col] = (
                            summerized_df['area_group'].map(grouped[col]).fillna(0)
                        )

            create_data_set_detail_buildings_or_area(summerized_df, 'data_set_detail_areas')
            
        except Exception as e:
            set_error(ERROR_20013)
            raise Exception(e)

    def read_file(self, path: str, **kwargs):
        """
        CSVファイルを読み込む
        
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
                set_error(ERROR_20014)
                raise ValueError(f"shapefile, GeoPackage, GeoJSON, CSV形式以外のファイル形式には対応していません。: {file_extension}")
            
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
                        try:
                            return gpd.read_file(path, encoding=encoding)
                        except:
                            with fiona.Env(encoding=encoding):
                                return gpd.read_file(path)

                except UnicodeDecodeError:
                    # デコードエラーが発生した場合、次のエンコーディングを試す
                    continue
                except ParserError:
                    # ParserErrorが発生した場合、次のエンコーディングを試す
                    continue

            detected_encoding = detect_encoding(path)
            if detected_encoding:
                if file_extension == '.csv':
                    return pd.read_csv(path, encoding=detected_encoding, **kwargs)
                else:
                    return gpd.read_file(path, encoding=encoding)
            
            # 適切なエンコーディングが見つからない場合、エラーを発生させる
            set_error(ERROR_00025, path)
            raise ValueError(f"適切なエンコーディングが見つかりませんでした: {path}")
        except Exception as e:
            # 何らかの例外が発生した場合、エラーメッセージを表示してNoneを返す
            if ERROR_CODE is None:
                set_error(ERROR_00014, path)
                raise Exception(f"ファイル {path} の読み込み中にエラーが発生しました")
            raise Exception(e)
    
    def process(self):
        residence_gdf = pd.read_csv(self.INPUT_PATHS["akiya_pred"], encoding='utf-8-sig')
        # 'geometry'列をWKT形式からジオメトリに変換
        column_bldg_geometry = "建物ポリゴンジオメトリ情報"
        if column_bldg_geometry in residence_gdf.columns:
            # Handle null values: convert only valid WKT strings
            residence_gdf['geometry'] = residence_gdf[
                column_bldg_geometry
            ].apply(lambda x: wkt.loads(x) if pd.notna(x) else None)
        else:
            # Handle null values: convert only valid WKT strings
            residence_gdf['geometry'] = residence_gdf['geometry'].apply(
                lambda x: wkt.loads(x) if pd.notna(x) else None
            )
        # GeoDataFrameに変換
        residence_gdf = gpd.GeoDataFrame(residence_gdf, geometry='geometry')
        # 投影法の指定 (必要に応じてEPSGコードを指定)
        residence_gdf.set_crs(epsg=4326, inplace=True)
        # city_block のファイル形式に応じて読み込み
        if "shp" in self.INPUT_PATHS["city_block"]:
            try:
                city_block_gdf = self.read_file(self.INPUT_PATHS["city_block"])
            except:
                set_error(ERROR_20017)
                raise("地域集計用データ（Shapefile形式）に不備がある場合")
        elif "gpkg" in self.INPUT_PATHS["city_block"]:
            try:
                city_block_gdf = self.read_file(self.INPUT_PATHS["city_block"])
            except:
                set_error(ERROR_20016)
                raise("地域集計用データ（gpkg形式）に不備がある場合")
        elif "geojson" in self.INPUT_PATHS["city_block"]:
            city_block_gdf = self.read_file(self.INPUT_PATHS["city_block"])
        elif "csv" in self.INPUT_PATHS["city_block"]:
            city_block_df = self.read_file(self.INPUT_PATHS["city_block"])

            if "geometry" in city_block_df.columns:
                city_block_df["geometry"] = city_block_df["geometry"].apply(load_wkt)  # WKT形式からジオメトリを生成
                city_block_gdf = gpd.GeoDataFrame(city_block_df, geometry="geometry", crs="EPSG:4326")
            else:
                set_error(ERROR_20009)
                raise ValueError("CSV does not contain a 'geometry' column with WKT data.")
        else:
            set_error(ERROR_20010)
            raise ValueError("本処理でサポートしているファイルフォーマットは、shp形式(zip形式)、gpkg形式、csv形式（geometryカラム付）のみとなります")

        if city_block_gdf is None:
            set_error(ERROR_20011)
            raise ValueError("地域集計用データが適切に読み込まれていません。")
        
        # 座標系変換
        residence_gdf = residence_gdf.to_crs("EPSG:4326")
        city_block_gdf = city_block_gdf.to_crs("EPSG:4326")

        if isinstance(self.key_column, list):
            if "_S_NAME_TEMP" in self.key_column[1]:
                city_block_gdf[self.key_column[1]] = city_block_gdf[self.key_column[0]]
 
        # 空間結合
        try:
            spatial_join_gdf = self.spatial_join(residence_gdf, city_block_gdf)

            # 小地域に集計
            summerized_gdf = self.summarize_city_block(spatial_join_gdf)

            # 小地域ポリゴンに集計結果を結合
            summerized_gdf = pd.merge(city_block_gdf, summerized_gdf, how="left", right_on=self.key_column,
                                      left_on=self.key_column)

            # insert sqlite
            if self.data_set_result_id != 0:
                self.insert_data_set_detail_areas(summerized_gdf, self.data_set_result_id, self.key_column)
            else:
                summerized_gdf.to_csv(self.OUTPUT_PATH, encoding="utf-8-sig", index=False)
        except Exception as e:
            print(e)
            traceback.print_exc()
            raise Exception(e)


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
        raw_data = file.read(1000)
    # エンコーディングを検出して返す
    result = chardet.detect(raw_data)
    return result['encoding']

def move_uploaded_file(file, save_dir):
    # 保存先のディレクトリを作成
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)

    # ファイルを一時ディレクトリに移動
    if isinstance(file, str):
        file_name = os.path.basename(file)  
        file_path = file 
    else:
        file_name = os.path.basename(file.name)  
        file_path = file.name

    destination_path = os.path.join(save_dir, file_name)
    shutil.copy2(file_path, destination_path)
    
    return destination_path


def extract_zip(zip_file, extract_to):
    """
    .zip ファイルを解凍し、Shapefile (.shp, .shx, .dbf, .prj) を抽出する。
    """
    try:
        with zipfile.ZipFile(zip_file, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
        files = os.listdir(extract_to)
        shp_file = [os.path.join(extract_to, f) for f in files if f.endswith(".shp")][0]
    except:
        set_error(ERROR_20015)
        raise Exception("地域集計用データ（shp形式）のデータが異常です。")
    return shp_file


def process_summarization(akiya_pred_file, spatial_file, output_dir, key_column, job_id=None, db_path=None, process=0, data_set_result_id=0, logs_dir=None):
    logger = None
    try:
        # Initialize logger if logs_dir is provided
        if logs_dir:
            logger = get_rotating_logger(logs_dir, logger_name="E032")
        elif output_dir:
            logs_dir = os.path.join(output_dir, "logs")
            os.makedirs(logs_dir, exist_ok=True)
            logger = get_rotating_logger(logs_dir, logger_name="E032")
        
        if db_path:
            connect_sqllite(db_path)
        task_id = None
        process = (process/3)
        process_init = process
        if job_id:
            task_id = create_or_update_job_task(job_id, progress_percent="0", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}))

        # 一時ディレクトリを作成
        if output_dir and len(output_dir) > 2:
            temp_dir = os.path.join(os.getcwd(), output_dir)
            parts = output_dir.split('/')
            file_name = parts[-1]
            joined_data = '/'.join(parts[:-1])
            output_path = f"{joined_data}/{file_name}.csv"
            akiya_pred_path = akiya_pred_file

        else:
            temp_dir = os.path.join(os.getcwd(), "temp_files/E032")
            output_path = os.path.join(temp_dir, "D903.csv")
            os.makedirs(temp_dir, exist_ok=True)
            # 空き家推定ファイルを移動
            akiya_pred_path = move_uploaded_file(akiya_pred_file, temp_dir)

        if job_id:
            create_or_update_job_task(job_id, progress_percent="20", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id, process)
            process += process_init
        # ファイル拡張子を取得
        file_ext = os.path.splitext(spatial_file)[1].lower()
     
        if file_ext == ".zip":
            # zipファイルを解凍
            extracted_files = extract_zip(spatial_file, temp_dir)
            input_paths = {
                "akiya_pred": akiya_pred_path,
                "city_block": extracted_files  # 解凍されたファイルを渡す
            }

        elif file_ext == ".gpkg":

            # GeoPackageファイルをそのまま使用
            gpkg_path = move_uploaded_file(spatial_file, temp_dir)
            input_paths = {
                "akiya_pred": akiya_pred_path,
                "city_block": gpkg_path
            }

        elif file_ext == ".geojson":
            # GeoJSONファイルをそのまま使用
            geojson_path = move_uploaded_file(spatial_file, temp_dir)
            input_paths = {
                "akiya_pred": akiya_pred_path,
                "city_block": geojson_path
            }

        elif file_ext == ".csv":
            # CSVファイルをそのまま使用（WKTフォーマット）
            csv_path = move_uploaded_file(spatial_file, temp_dir)
            input_paths = {
                "akiya_pred": akiya_pred_path,
                "city_block": csv_path
            }

        else:
            set_error(ERROR_20014)
            raise ValueError(f"Unsupported file format: {file_ext}")
        
        if job_id:
            create_or_update_job_task(job_id, progress_percent="40", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id, process)
            process += process_init

        # 集計に使用するカラム名も引数として渡す
        Summarization(input_paths, output_path, key_column, data_set_result_id).process()
        if job_id:
            create_or_update_job_task(job_id, progress_percent="100", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id, is_finish=True)
            create_or_update_job(job_id, process)
            process += process_init
            
        return output_path
    except Exception as e:
        if logger:
            logger.error("E032 failed:\n%s", traceback.format_exc())
        if ERROR_CODE is None:
            set_error(ERROR_20012)
        if task_id is not None:
            create_or_update_job_task(job_id, progress_percent="", preprocess_type=None, error_code=ERROR_CODE, error_msg=ERROR_MSG, result=json.dumps({}), id= task_id, is_finish=True)
        raise Exception("地域集計処理においてエラーが発生しています。")

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