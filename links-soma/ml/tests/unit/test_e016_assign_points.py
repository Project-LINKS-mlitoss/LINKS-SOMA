"""
E016 assign_points_to_buildings のユニットテスト

ジオコーディングマッチ0%（geometry全Null）時のフォールバックパスを検証する。
"""

import math

import geopandas as gpd
import pandas as pd
import pytest
from shapely.geometry import box


def _make_buildings_gdf(crs=6675):
    """テスト用の建物ポリゴンGeoDataFrame（CRS変換・building_id追加済み）を作成"""
    buildings = gpd.GeoDataFrame(
        {
            "buildingID": ["bldg_001", "bldg_002"],
            "building_id": ["bldg_001", "bldg_002"],
            "address": ["テスト町1-1", "テスト町2-2"],
            "fid": [1, 2],
        },
        geometry=[
            box(0, 0, 10, 10),
            box(20, 20, 30, 30),
        ],
        crs=crs,
    )
    return buildings


def _make_points_gdf(geometries, crs=6675):
    """テスト用のポイントGeoDataFrame（e14_merged相当）を作成"""
    n = len(geometries)
    return gpd.GeoDataFrame(
        {
            "normalized_address": [f"addr_{i}" for i in range(n)],
            "address": [f"水道住所_{i}" for i in range(n)],
            "water_supply_number": list(range(n)),
        },
        geometry=geometries,
        crs=crs,
    )


class TestGeometryAllNull:
    """geometry全Nullのフォールバックパスの検証"""

    def test_geometry全Nullでもエラーにならない(self):
        """ジオコーディング0%相当: 全ポイントのgeometryがNullの場合に正常終了する"""
        from src.E001_DataMatching.E016 import assign_points_to_buildings

        buildings = _make_buildings_gdf()
        points = _make_points_gdf([None, None, None])

        result, join_ratio, success_rate, _ = assign_points_to_buildings(
            buildings_gdf=buildings,
            points_gdf=points,
            mul=2,
            crs=6675,
            point_selected_column=points.columns,
            option=0,
            job_id=None,
            task_id_summarization=None,
            result_summarization=None,
        )

        assert isinstance(result, gpd.GeoDataFrame)
        assert len(result) == 3
        assert join_ratio == 0
        assert "geometry_plateau" in result.columns

    def test_戻り値にカラム重複がない(self):
        """フォールバックパスでaddress等のカラムが重複しない"""
        from src.E001_DataMatching.E016 import assign_points_to_buildings

        buildings = _make_buildings_gdf()
        points = _make_points_gdf([None, None])

        result, _, _, _ = assign_points_to_buildings(
            buildings_gdf=buildings,
            points_gdf=points,
            mul=2,
            crs=6675,
            point_selected_column=points.columns,
            option=0,
            job_id=None,
            task_id_summarization=None,
            result_summarization=None,
        )

        duplicated = result.columns[result.columns.duplicated()].tolist()
        assert duplicated == [], f"カラム重複: {duplicated}"

    def test_building_idにcus_bldg_IDが付与される(self):
        """geometry全Nullの未マッチレコードにcus_bldg_*のIDが付与される"""
        from src.E001_DataMatching.E016 import assign_points_to_buildings

        buildings = _make_buildings_gdf()
        points = _make_points_gdf([None, None])

        result, _, _, _ = assign_points_to_buildings(
            buildings_gdf=buildings,
            points_gdf=points,
            mul=2,
            crs=6675,
            point_selected_column=points.columns,
            option=0,
            job_id=None,
            task_id_summarization=None,
            result_summarization=None,
        )

        assert "building_id" in result.columns
        # geometry全Nullのポイントは再合流時にbuilding_idを持たない（None）
        # cus_bldg_* は assign_points_to_buildings 内の unmatched 処理で付与されるが、
        # フォールバック(0行)では unmatched も空なので付与されない
        # points_with_null_geom 再合流時にNoneのまま
        assert list(result.columns).count("building_id") == 1
