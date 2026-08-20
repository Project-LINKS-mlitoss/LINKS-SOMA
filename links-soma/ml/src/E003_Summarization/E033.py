import os
import sys
import sqlite3
import pandas as pd
import geopandas as gpd
from shapely import wkt
from shapely.geometry import MultiPolygon, Polygon
import json
import numpy as np

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

def _init_gpkg(output_path):
    """
    空のGeoPackageファイルを初期化する（OGC必須メタデータテーブルを作成）。
    全行NULLジオメトリの場合にgeopandasのto_file()が呼ばれないため、
    attributesレイヤー書き込み前にGeoPackageの骨格を用意する。
    """
    conn = sqlite3.connect(output_path)
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS gpkg_spatial_ref_sys (
                srs_name TEXT NOT NULL,
                srs_id INTEGER NOT NULL PRIMARY KEY,
                organization TEXT NOT NULL,
                organization_coordsys_id INTEGER NOT NULL,
                definition TEXT NOT NULL,
                description TEXT
            )
        """)
        conn.execute("""
            INSERT OR IGNORE INTO gpkg_spatial_ref_sys
            (srs_name, srs_id, organization, organization_coordsys_id, definition)
            VALUES ('WGS 84', 4326, 'EPSG', 4326,
                    'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]')
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS gpkg_contents (
                table_name TEXT NOT NULL PRIMARY KEY,
                data_type TEXT NOT NULL,
                identifier TEXT UNIQUE,
                description TEXT DEFAULT '',
                last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
                min_x DOUBLE,
                min_y DOUBLE,
                max_x DOUBLE,
                max_y DOUBLE,
                srs_id INTEGER,
                CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
            )
        """)
        conn.commit()
    finally:
        conn.close()


def _write_attributes_layer_to_gpkg(df, output_path, layer_name='attributes'):
    """
    NULLジオメトリのレコードをGeoPackageの非空間テーブルとして書き込む。
    OGC GeoPackage 1.2+ の data_type='attributes' に準拠。
    """
    if not os.path.exists(output_path):
        _init_gpkg(output_path)

    conn = sqlite3.connect(output_path)
    try:
        # ジオメトリカラムを除外してDataFrameとして書き込み
        df_attrs = df.drop(columns=['geometry'], errors='ignore')
        df_attrs['fid'] = range(1, len(df_attrs) + 1)
        df_attrs.to_sql(layer_name, conn, if_exists='replace', index=False)

        # gpkg_contents にレイヤーを登録（data_type='attributes'）
        conn.execute("""
            INSERT OR REPLACE INTO gpkg_contents
            (table_name, data_type, identifier, description, last_change, srs_id)
            VALUES (?, 'attributes', ?, '', datetime('now'), 4326)
        """, (layer_name, layer_name))
        conn.commit()
    finally:
        conn.close()


def _decode_bytes_columns(gdf):
    """
    bytes型カラムをstr(UTF-8)に変換する。
    PyInstaller環境ではpyogrioが利用できずfionaにフォールバックするが、
    fiona 1.9.6はbytes型カラムを扱えない（ValueError: Invalid field type <class 'bytes'>）。
    """
    for col in gdf.select_dtypes(include=["object"]).columns:
        if col != "geometry":
            gdf[col] = gdf[col].apply(
                lambda x: x.decode("utf-8") if isinstance(x, bytes) else x
            )
    return gdf


def read_input_data(result_views):
    try:
        df, columns_name, threshold = get_data_set_detail_buildings_or_area(result_views)

        if df is None:
            raise Exception("No data found")
        geometry = 'bldg_geometry'
        if 'bldg_geometry' not in df.columns:
            geometry = 'geometry'
            if 'geometry' not in df.columns:
                raise ValueError("'geometry' column is missing in the input data")
        if result_views.get('unit') == 'building':
            if threshold is not None:
                threshold = int(threshold.get('value'))
                if "predicted_label" in df.columns:
                    df["predicted_label"] = df[f"predicted_label_{threshold:02d}"]

            # Drop all predicted_label_XX columns
            columns_to_drop = [
                f"predicted_label_{threshold_percent:02d}"
                for threshold_percent in range(5, 96, 5)
            ]
            df.drop(columns=columns_to_drop, inplace=True, errors='ignore')
        else:
            if threshold is not None:
                threshold = int(threshold.get('value'))
                if "vacant_house_count" in df.columns:
                    df["vacant_house_count"] = df[f"vacant_house_count_{threshold:02d}"]
                if "predicted_probability" in df.columns:
                    df["predicted_probability"] = df[f"predicted_probability_{threshold:02d}"]
            
            # Drop all vacant_house_count_XX and predicted_probability_XX columns
            columns_to_drop = [
                f"vacant_house_count_{threshold_percent:02d}"
                for threshold_percent in range(5, 96, 5)
            ]
            columns_to_drop.extend([
                f"predicted_probability_{threshold_percent:02d}"
                for threshold_percent in range(5, 96, 5)
            ])
            df.drop(columns=columns_to_drop, inplace=True, errors='ignore')

        # Handle null values: convert only valid WKT strings
        df[geometry] = df[geometry].apply(
            lambda x: wkt.loads(x) if pd.notna(x) else None
        )
        # Remove Z coordinate, handle null geometries
        df[geometry] = df[geometry].apply(
            lambda x: remove_z_coordinate(x) if x is not None else None
        )

        gdf = gpd.GeoDataFrame(df, geometry=geometry)

        if gdf.crs is None:
            gdf.set_crs(epsg=4326, inplace=True)

        return gdf, columns_name
    except Exception as e:
        set_error(ERROR_30001)
        raise Exception(e)

ODS_EXPORT_PREFIX = "[追加] "


def _parse_ods_entries(value):
    """optional_data_source の1行分をエントリのリストに変換する。

    値は E022.collect_ods_to_json が書いた JSON 文字列。建物関連データを
    結合していない行は NULL になるため、リスト以外は空として扱う。
    """
    if not isinstance(value, str) or not value:
        return []
    try:
        entries = json.loads(value)
    except (ValueError, TypeError):
        return []
    if not isinstance(entries, list):
        return []
    return [entry for entry in entries if isinstance(entry, dict)]


def expand_optional_data_source(gdf):
    """建物関連データ(optional_data_source)を個別カラムへ展開する。

    列名は分析画面の表示名と揃える(app/src/shared/types/optional-data-source.ts の
    toOdsDisplayName)。`[追加] ` の接頭辞は、利用者CSVの見出しが既存の日本語列名と
    衝突するのを防ぐ。

    列の集合は全行の和集合。画面側(expand-optional-data-source.ts)はページ単位で
    先頭行から決めるが、出力は結果全体を1度に書くため同じ規則では取りこぼす。

    戻り値は (展開後の GeoDataFrame, 追加した列名のリスト)。
    """
    if "optional_data_source" not in gdf.columns:
        return gdf, []

    # 行ごとに name -> value の辞書を1度だけ作る。列ごとに線形探索すると
    # 列数の2乗に比例して遅くなるため（推定結果は数十万行になりうる）
    rows = [
        {
            entry.get("name"): entry.get("value")
            for entry in _parse_ods_entries(value)
            if entry.get("name")
        }
        for value in gdf["optional_data_source"]
    ]
    gdf = gdf.drop(columns=["optional_data_source"])

    # 列は全行の和集合を取る。複数年度の推定は1つの data_set_result_id に
    # 年度ごとの行を書き込むため(IF003)、年度で建物関連データの列が違いうる。
    # 先頭行だけで決めると、後の年度にしかない列が全行から消える。
    names = []
    seen = set()
    for row in rows:
        for name in row:
            if name not in seen:
                seen.add(name)
                names.append(name)

    ods_columns = []
    for name in names:
        column = f"{ODS_EXPORT_PREFIX}{name}"
        if column in gdf.columns or column in ods_columns:
            continue
        gdf[column] = [row.get(name) for row in rows]
        ods_columns.append(column)

    return gdf, ods_columns


def rename_columns(gdf, ext, job_id=None, target_unit="building", columns_name=None):
    if target_unit == "building":
        columns = COLUMNS_EXPORT_BUILDING_IF004
        # 展開後の列名は既に最終形のため rename_dict には入れず、選択リストにだけ足す
        gdf, ods_columns = expand_optional_data_source(gdf)
    else:
        columns = TRANSLATE_COLUMNS_AREA
        ods_columns = []

    if ext != "csv":
        rename_dict = {col: columns[col] for col in gdf.columns if col in columns and col != "geometry"}
        if target_unit == "building":
            selected_columns = list(rename_dict.keys()) + (["bldg_geometry"] if "bldg_geometry" in gdf.columns and "bldg_geometry" not in list(rename_dict.keys()) else [])
        else:
            selected_columns = list(rename_dict.keys()) + (["geometry"] if "geometry" in gdf.columns and "geometry" not in list(rename_dict.keys()) else [])
    else:
        rename_dict = {col: columns[col] for col in gdf.columns if col in columns}
        selected_columns = list(rename_dict.keys())

    selected_columns = selected_columns + ods_columns

    gdf = gdf[selected_columns]
    gdf = gdf.rename(columns=rename_dict)

    if ext == "csv":
        if target_unit != "building":
            # Reorder columns to match the order in the translation dictionary
            translation_order = list(TRANSLATE_COLUMNS_AREA.values())
        else:
            translation_order = list(COLUMNS_EXPORT_BUILDING_IF004.values())

        # Get the renamed columns that exist in our dataframe
        existing_renamed_columns = [col for col in translation_order if col in gdf.columns]

        # 建物関連データは辞書に無い動的な列。並べ替えで落ちないよう末尾に足す
        existing_renamed_columns = existing_renamed_columns + [
            col for col in ods_columns if col in gdf.columns
        ]

        # Reorder the dataframe columns
        gdf = gdf[existing_renamed_columns]
    else:
        gdf = gdf.rename(columns={
            "建物ポリゴンジオメトリ情報": "geometry"
        })
        # geopandasのrename()は_geometry_column_nameを更新しないため、
        # set_geometry()でアクティブジオメトリカラムを再設定する
        if "geometry" in gdf.columns:
            gdf = gdf.set_geometry("geometry")

    if job_id:
        create_or_update_job(job_id, 60)
    return gdf


def export_data(gdf, output_path, output_format, target_unit, job_id=None, columns_name=None):
    """
    データをエクスポートする関数
    """
    try:
        if job_id:
            create_or_update_job(job_id, 50)
        if output_format.lower() == 'csv':
            gdf = rename_columns(gdf, output_format.lower(), job_id, target_unit, columns_name)
            encodings = ['utf-8-sig']
            for encoding in encodings:
                try:
                    gdf.to_csv(output_path, index=False, encoding=encoding)
                    return output_path
                except Exception as e:
                    pass
            raise ValueError("Failed to export CSV with all attempted encodings.")
        elif output_format.lower() == 'geojson':
            # NULLジオメトリは geometry: null として出力（RFC 7946準拠）
            gdf_renamed = rename_columns(
                gdf, output_format.lower(), job_id, target_unit, columns_name
            )
            gdf_renamed = _decode_bytes_columns(gdf_renamed)
            gdf_renamed.to_file(output_path, driver='GeoJSON')
        elif output_format.lower() == 'geopackage':
            gdf_renamed = rename_columns(
                gdf, output_format.lower(), job_id, target_unit, columns_name
            )
            gdf_renamed = _decode_bytes_columns(gdf_renamed)

            # ジオメトリの有無で分割
            has_geom_mask = gdf_renamed.geometry.notnull()
            gdf_spatial = gdf_renamed[has_geom_mask].copy()
            gdf_null = gdf_renamed[~has_geom_mask].copy()

            if target_unit == "building":
                if not gdf_spatial.empty:
                    # ジオメトリタイプ別にレイヤ分離
                    geom_types = gdf_spatial["geometry"].geom_type

                    # Point レイヤ
                    point_mask = geom_types == 'Point'
                    if point_mask.any():
                        gdf_point = gdf_spatial[point_mask].copy()
                        gdf_point['fid'] = range(1, len(gdf_point) + 1)
                        gdf_point.to_file(output_path, layer='point', driver='GPKG')

                    # Polygon レイヤ（Polygon + MultiPolygon）
                    polygon_mask = geom_types.isin(['Polygon', 'MultiPolygon'])
                    if polygon_mask.any():
                        gdf_polygon = gdf_spatial[polygon_mask].copy()
                        gdf_polygon['fid'] = range(1, len(gdf_polygon) + 1)
                        # fiona 1.9.6 + GDAL 3.6.4 では mode='a' が NULL pointer error になる。
                        # mode='w'（デフォルト）+ layer指定 で既存レイヤーを保持したまま新規レイヤーを追加できる。
                        gdf_polygon.to_file(
                            output_path, layer='polygon', driver='GPKG'
                        )
            else:
                if not gdf_spatial.empty:
                    gdf_spatial['fid'] = range(1, len(gdf_spatial) + 1)
                    gdf_spatial.to_file(output_path, driver='GPKG')

            # NULLジオメトリのレコードをattributesレイヤーに出力
            if not gdf_null.empty:
                _write_attributes_layer_to_gpkg(gdf_null, output_path)
        else:
            set_error(ERROR_30004)
            raise ValueError("CSV形式、GeoPackage形式、GeoJSON形式のファイルを指定してください。")
        return output_path
    except Exception as e:
        if ERROR_CODE is None:
            set_error(ERROR_30002)
        raise Exception(e)

def processing(params, job_id=None, db_path=None):
    """
    メイン処理を行う関数
    """
    # task_id は except でも参照する。try の内側で束縛すると、接続やパラメータ解決で
    # 失敗したときに except 自身が UnboundLocalError で落ち、エラーを記録できなくなる。
    task_id = None
    try:
        if db_path:
            connect_sqllite(db_path)
        output_path = params['output_path']
        if job_id:
            task_id = create_or_update_job_task(job_id, progress_percent="0", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}))

        view_id = params.get("view_id", None)
        result_views = None
        if view_id is not None:
            result_views = get_data_result_views(view_id)
            result_views = result_views.to_dict(orient='records')
            if len(result_views):
                result_views = result_views[0]
        else:
            result_views = {
                "data_set_result_id": params.get("data_set_results_id", None),
                "unit": params.get("target_unit", None),
                "parameters": '[]',
                "reference_date": params.get("reference_date", None)
            }

        if job_id:
            create_or_update_job_task(job_id, progress_percent="20", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id=task_id)
            create_or_update_job(job_id, 20)

        gdf, columns_name = read_input_data(result_views)
        if job_id:
            create_or_update_job_task(job_id, progress_percent="30", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id)
            create_or_update_job(job_id, 30)
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
        target_unit = result_views.get('unit', None)
        output_file_path = export_data(gdf, output_path, params['output_format'], target_unit, job_id, columns_name)

        if job_id:
            create_or_update_job_task(job_id, progress_percent="100", preprocess_type=None, error_code=None, error_msg=None, result=json.dumps({}), id= task_id, is_finish=True)
            create_or_update_job(job_id, 80)
            
        return output_file_path
    except Exception as e:
        # 記録より先にフォールバック(E-30003)を立てる。順序が逆だと想定外の例外で
        # ERROR_MSG が None のまま記録され、画面が原因を示せなくなる。
        is_fallback = ERROR_CODE is None
        if is_fallback:
            set_error(ERROR_30003)
        if task_id is not None:
            create_or_update_job_task(job_id, progress_percent="", preprocess_type=None, error_code=ERROR_CODE, error_msg=ERROR_MSG, result=json.dumps({}), id= task_id, is_finish=True)
        if is_fallback:
            raise Exception("正しいCRS（参照座標系）になっているかご確認ください。")

        raise Exception(e)

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