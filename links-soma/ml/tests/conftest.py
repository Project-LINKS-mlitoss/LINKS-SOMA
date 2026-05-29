"""pytest共通設定・共通フィクスチャ"""

import pytest
import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, Polygon


def pytest_itemcollected(item):
    """テストのdocstringがあれば、verbose出力のテスト名部分に使用する。

    ファイル名・クラス名の階層は維持し、テスト関数名のみdocstringで置換する。
    例: tests/test_e017.py::TestFilter::旧字体の住所は類似候補として出力される

    注意: _nodeidはpytestの非公開属性。表示名の変更のみに使用しており、
    将来のpytestバージョンで破損してもテスト実行自体には影響しない。
    """
    docstring = item._obj.__doc__
    if docstring:
        first_line = docstring.strip().split("\n")[0]
        parent = item.parent
        if parent and parent.nodeid:
            item._nodeid = f"{parent.nodeid}::{first_line}"
        else:
            item._nodeid = first_line


# --- building 単位のテストデータ ---

def _building_base_columns():
    """COLUMNS_EXPORT_BUILDING_IF004 に存在する最小限のカラム"""
    return {
        "building_id": ["BLD001", "BLD002", "BLD003"],
        "building_structure_type": ["木造", "鉄骨", "RC"],
        "predicted_label": [1, 0, 1],
        "predicted_probability": [0.85, 0.12, 0.73],
        "lat_geocoding": [35.68, 35.69, None],
        "lon_geocoding": [139.76, 139.77, None],
        "normalized_address": ["東京都千代田区1-1", "東京都新宿区2-2", "東京都渋谷区3-3"],
    }


SAMPLE_POLYGON = Polygon([(139.7, 35.6), (139.8, 35.6), (139.8, 35.7), (139.7, 35.7)])


@pytest.fixture
def gdf_building_with_geom():
    """全行にジオメトリがある building GeoDataFrame（Point + Polygon 混在）"""
    cols = _building_base_columns()
    df = pd.DataFrame(cols)
    df["bldg_geometry"] = [Point(139.76, 35.68), SAMPLE_POLYGON, Point(139.78, 35.70)]
    return gpd.GeoDataFrame(df, geometry="bldg_geometry", crs="EPSG:4326")


@pytest.fixture
def gdf_building_all_null():
    """全行ジオメトリが None の building GeoDataFrame"""
    cols = _building_base_columns()
    df = pd.DataFrame(cols)
    df["bldg_geometry"] = [None, None, None]
    return gpd.GeoDataFrame(df, geometry="bldg_geometry", crs="EPSG:4326")


@pytest.fixture
def gdf_building_no_polygon_no_geocoding():
    """ポリゴンなし・ジオコーディングなしの building GeoDataFrame
    IF001でジオメトリなし実行 → DT213未提供 → 推定後のデータを再現"""
    cols = {
        "building_id": ["BLD001", "BLD002", "BLD003"],
        "building_structure_type": ["木造", "鉄骨", "RC"],
        "predicted_label": [1, 0, 1],
        "predicted_probability": [0.85, 0.12, 0.73],
        "lat_geocoding": [None, None, None],
        "lon_geocoding": [None, None, None],
        "normalized_address": ["東京都千代田区1-1", "東京都新宿区2-2", "東京都渋谷区3-3"],
    }
    df = pd.DataFrame(cols)
    df["bldg_geometry"] = [None, None, None]
    return gpd.GeoDataFrame(df, geometry="bldg_geometry", crs="EPSG:4326")


@pytest.fixture
def gdf_building_mixed_null():
    """一部ジオメトリが None の building GeoDataFrame"""
    cols = _building_base_columns()
    df = pd.DataFrame(cols)
    df["bldg_geometry"] = [Point(139.76, 35.68), None, SAMPLE_POLYGON]
    return gpd.GeoDataFrame(df, geometry="bldg_geometry", crs="EPSG:4326")


# --- area 単位のテストデータ ---

AREA_POLYGON_A = Polygon([(139.7, 35.6), (139.8, 35.6), (139.8, 35.7), (139.7, 35.7)])
AREA_POLYGON_B = Polygon([(139.8, 35.7), (139.9, 35.7), (139.9, 35.8), (139.8, 35.8)])


@pytest.fixture
def gdf_area_with_geom():
    """全行にジオメトリがある area GeoDataFrame"""
    cols = {
        "id": [1, 2],
        "vacant_house_count": [10, 5],
        "predicted_probability": [0.15, 0.08],
        "area_group": ["A地区", "B地区"],
    }
    df = pd.DataFrame(cols)
    df["geometry"] = [AREA_POLYGON_A, AREA_POLYGON_B]
    return gpd.GeoDataFrame(df, geometry="geometry", crs="EPSG:4326")


@pytest.fixture
def gdf_area_all_null():
    """全行ジオメトリが None の area GeoDataFrame"""
    cols = {
        "id": [1, 2],
        "vacant_house_count": [10, 5],
        "predicted_probability": [0.15, 0.08],
        "area_group": ["A地区", "B地区"],
    }
    df = pd.DataFrame(cols)
    df["geometry"] = [None, None]
    return gpd.GeoDataFrame(df, geometry="geometry", crs="EPSG:4326")


@pytest.fixture
def gdf_area_with_bytes_column():
    """カラム値に bytes が混入した area GeoDataFrame（SQLite BLOB由来を再現）"""
    cols = {
        "id": [1, 2],
        "vacant_house_count": [10, 5],
        "predicted_probability": [0.15, 0.08],
        "area_group": ["A地区", "B地区"],
        "created_at": [b"2024-01-01 00:00:00", b"2024-01-02 00:00:00"],
    }
    df = pd.DataFrame(cols)
    df["geometry"] = [AREA_POLYGON_A, AREA_POLYGON_B]
    return gpd.GeoDataFrame(df, geometry="geometry", crs="EPSG:4326")
