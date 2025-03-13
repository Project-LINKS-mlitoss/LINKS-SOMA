import os
import sys
import geopandas as gpd
from shapely import wkt
from shapely.geometry import MultiPolygon, Polygon
import json

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

def remove_z_coordinate(geometry):
    """
    ジオメトリからZ座標（高さ）を削除する関数
    """
    if geometry.geom_type == 'Polygon':
        return Polygon([(x, y) for x, y, *_ in geometry.exterior.coords])
    elif geometry.geom_type == 'MultiPolygon':
        new_polygons = [Polygon([(x, y) for x, y, *_ in poly.exterior.coords]) for poly in geometry.geoms]
        return MultiPolygon(new_polygons)
    else:
        return geometry

def read_input_data(data_set_results_id, reference_date, table_name):
    try:
        df = get_data_set_detail_buildings_or_area(data_set_results_id, reference_date, table_name)
        
        if df is None:
            raise Exception("No data found")
        if 'geometry' not in df.columns:
            raise ValueError("'geometry' column is missing in the input data")

        df['geometry'] = df['geometry'].apply(wkt.loads)
        df['geometry'] = df['geometry'].apply(remove_z_coordinate)

        gdf = gpd.GeoDataFrame(df, geometry='geometry')

        if gdf.crs is None:
            gdf.set_crs(epsg=4326, inplace=True)

        return gdf
    except Exception as e:
        set_error(ERROR_30001)
        raise

def rename_columns(gdf, ext, job_id=None, target_unit="building"):
    if target_unit == "building":
        columns = TRANSLATE_COLUMNS_BUILDING
    else:
        columns = TRANSLATE_COLUMNS_AREA

    if ext != "csv":
        rename_dict = {col: columns[col] for col in gdf.columns if col in columns and col != "geometry"}
        selected_columns = list(rename_dict.keys()) + (["geometry"] if "geometry" in gdf.columns else [])
    else:
        rename_dict = columns
        selected_columns = list(rename_dict.keys())

    gdf = gdf[selected_columns]
    gdf = gdf.rename(columns=rename_dict)
    if job_id:
        create_or_update_job(job_id, 60)
    return gdf


def export_data(gdf, output_path, output_format, target_unit, job_id=None):
    """
    データをエクスポートする関数
    """
    try:
        if job_id:
            create_or_update_job(job_id, 50)
        if output_format.lower() == 'csv':
            gdf = rename_columns(gdf, output_format.lower(), job_id, target_unit)
            encodings = ['utf-8-sig']
            for encoding in encodings:
                try:
                    gdf.to_csv(output_path, index=False, encoding=encoding)
                    return output_path
                except Exception as e:
                    pass
            raise ValueError("Failed to export CSV with all attempted encodings.")
        elif output_format.lower() == 'geojson':
            gdf = rename_columns(gdf, output_format.lower(), target_unit)
            gdf.to_file(output_path, driver='GeoJSON')
        elif output_format.lower() == 'geopackage':
            gdf = rename_columns(gdf, output_format.lower(), target_unit)
            gdf['fid'] = range(1, len(gdf) + 1)
            gdf.to_file(output_path, driver='GPKG')
        else:
            set_error(ERROR_30004)
            raise ValueError("CSV形式、GeoPackage形式、GeoJSON形式のファイルを指定してください。")
        return output_path
    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_30002)
        raise

def processing(params, job_id=None, db_path=None):
    """
    メイン処理を行う関数
    """
    try:
        if db_path:
            connect_sqllite(db_path)
        data_set_results_id = params['data_set_results_id']
        table_name = "data_set_detail_buildings"
        target_unit = params['target_unit']
        if (target_unit == 'area'):
            table_name = 'data_set_detail_areas'
            
        output_path = params['output_path']
        task_id = None
        if job_id:
            task_id = create_or_update_job_task(job_id, progress_percent="0", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}))

        gdf = read_input_data(data_set_results_id, params.get("reference_date"), table_name)
        if job_id:
            create_or_update_job_task(job_id, progress_percent="20", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id, 20)
        if params.get('target_crs'):
            target_crs = params['target_crs']
            if gdf.crs.to_string().upper() != target_crs.upper():
                target_crs = target_crs.split(':')
                if len(target_crs) > 1:
                    target_crs = target_crs[1].split(' ')[0]
                else:
                    target_crs = target_crs[0]
                target_crs_epsg = int(target_crs)
                gdf = gdf.to_crs(epsg=target_crs_epsg)

        if job_id:
            create_or_update_job_task(job_id, progress_percent="40", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id, 40)
        
        output_file_path = export_data(gdf, output_path, params['output_format'], target_unit, job_id)

        if job_id:
            create_or_update_job_task(job_id, progress_percent="100", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id, is_finish=True)
            create_or_update_job(job_id, 80)
            
        return output_file_path
    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_30003)
        if task_id is not None:
            create_or_update_job_task(job_id, progress_percent="", preprocess_type=None, error_code=ERROR_CODE, error_msg=ERROR_MSG, result=json.dumps({}), id= task_id, is_finish=True)

        raise Exception("変換処理中にエラーが発生しました。正しいCRS（参照座標系）になっているかご確認ください。")

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