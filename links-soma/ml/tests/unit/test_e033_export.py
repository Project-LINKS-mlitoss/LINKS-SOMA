"""E033 export_data() のテスト

export_data() を job_id=None で呼び出し、DB依存なしで
GeoJSON / GeoPackage / CSV の出力を検証する。
"""

import json
import sqlite3
from unittest.mock import patch

import fiona
import geopandas as gpd
import pandas as pd
import pytest

from E003_Summarization.E033 import export_data, rename_columns


# ============================================================
# GeoJSON テスト
# ============================================================


class TestGeoJSON:
    """GeoJSON 出力の検証"""

    def test_geojson_with_geometry(self, tmp_path, gdf_building_with_geom):
        """Point + Polygon 混在、NULLなし → 全件出力、geometry 非 null"""
        out = tmp_path / "out.geojson"
        export_data(gdf_building_with_geom, str(out), "geojson", "building")

        with open(out, encoding="utf-8") as f:
            data = json.load(f)

        features = data["features"]
        assert len(features) == 3
        for feat in features:
            assert feat["geometry"] is not None
        # カラム名が日本語に翻訳されている
        assert "建物ID" in features[0]["properties"]

    def test_geojson_all_null_geometry(self, tmp_path, gdf_building_all_null):
        """全行 None → 全件出力、全 Feature の geometry が null"""
        out = tmp_path / "out.geojson"
        export_data(gdf_building_all_null, str(out), "geojson", "building")

        with open(out, encoding="utf-8") as f:
            data = json.load(f)

        features = data["features"]
        assert len(features) == 3
        for feat in features:
            assert feat["geometry"] is None

    def test_geojson_no_polygon_no_geocoding(self, tmp_path, gdf_building_no_polygon_no_geocoding):
        """ポリゴンなし・ジオコーディングなし → 全件出力、geometry/緯度/経度が全てnull"""
        out = tmp_path / "out.geojson"
        export_data(gdf_building_no_polygon_no_geocoding, str(out), "geojson", "building")

        with open(out, encoding="utf-8") as f:
            data = json.load(f)

        features = data["features"]
        assert len(features) == 3
        for feat in features:
            assert feat["geometry"] is None
            assert feat["properties"]["緯度"] is None
            assert feat["properties"]["経度"] is None
            # 属性データは保持されている
            assert feat["properties"]["建物ID"] is not None
            assert feat["properties"]["正規化住所"] is not None

    def test_geojson_mixed_null(self, tmp_path, gdf_building_mixed_null):
        """一部 None → 件数一致、null 件数が正しい"""
        out = tmp_path / "out.geojson"
        export_data(gdf_building_mixed_null, str(out), "geojson", "building")

        with open(out, encoding="utf-8") as f:
            data = json.load(f)

        features = data["features"]
        assert len(features) == 3
        null_count = sum(1 for f in features if f["geometry"] is None)
        assert null_count == 1


# ============================================================
# GeoPackage テスト
# ============================================================


class TestGeoPackage:
    """GeoPackage 出力の検証"""

    def test_gpkg_point_polygon_split(self, tmp_path, gdf_building_with_geom):
        """Point + Polygon、NULLなし → point, polygon 2レイヤー"""
        out = tmp_path / "out.gpkg"
        export_data(gdf_building_with_geom, str(out), "geopackage", "building")

        layers = fiona.listlayers(str(out))
        assert "point" in layers
        assert "polygon" in layers

        gdf_point = gpd.read_file(str(out), layer="point")
        gdf_polygon = gpd.read_file(str(out), layer="polygon")
        # gdf_building_with_geom は Point 2件 + Polygon 1件
        assert len(gdf_point) == 2
        assert len(gdf_polygon) == 1

    def test_gpkg_all_null_geometry(self, tmp_path, gdf_building_all_null):
        """全行 None → attributes レイヤーのみ、空間レイヤーなし"""
        out = tmp_path / "out.gpkg"
        export_data(gdf_building_all_null, str(out), "geopackage", "building")

        # fiona は非空間レイヤーを listlayers で返さない場合がある
        # sqlite3 で gpkg_contents を直接確認
        conn = sqlite3.connect(str(out))
        rows = conn.execute(
            "SELECT table_name, data_type FROM gpkg_contents"
        ).fetchall()
        conn.close()

        table_names = [r[0] for r in rows]
        data_types = {r[0]: r[1] for r in rows}

        assert "attributes" in table_names
        assert data_types["attributes"] == "attributes"
        # 空間レイヤーは存在しない
        spatial_layers = [r[0] for r in rows if r[1] == "features"]
        assert len(spatial_layers) == 0

    def test_gpkg_no_polygon_no_geocoding(self, tmp_path, gdf_building_no_polygon_no_geocoding):
        """ポリゴンなし・ジオコーディングなし → attributesレイヤーのみ、緯度経度はNULL"""
        out = tmp_path / "out.gpkg"
        export_data(gdf_building_no_polygon_no_geocoding, str(out), "geopackage", "building")

        conn = sqlite3.connect(str(out))
        rows = conn.execute(
            "SELECT table_name, data_type FROM gpkg_contents"
        ).fetchall()

        table_names = [r[0] for r in rows]
        data_types = {r[0]: r[1] for r in rows}

        # 空間レイヤーなし、attributesのみ
        assert "attributes" in table_names
        assert data_types["attributes"] == "attributes"
        spatial_layers = [r[0] for r in rows if r[1] == "features"]
        assert len(spatial_layers) == 0

        # 全行出力され、緯度経度はNULL
        df_attrs = pd.read_sql("SELECT * FROM attributes", conn)
        conn.close()
        assert len(df_attrs) == 3
        assert df_attrs["緯度"].isna().all()
        assert df_attrs["経度"].isna().all()
        # 属性データは保持されている
        assert df_attrs["建物ID"].notna().all()

    def test_gpkg_mixed_null(self, tmp_path, gdf_building_mixed_null):
        """Point + None 混在 → point + polygon + attributes"""
        out = tmp_path / "out.gpkg"
        export_data(gdf_building_mixed_null, str(out), "geopackage", "building")

        conn = sqlite3.connect(str(out))
        rows = conn.execute(
            "SELECT table_name, data_type FROM gpkg_contents"
        ).fetchall()
        conn.close()

        table_names = [r[0] for r in rows]
        assert "attributes" in table_names

        # 空間レイヤーの件数確認（Point 1件 + Polygon 1件）
        spatial_count = 0
        if "point" in table_names:
            gdf_pt = gpd.read_file(str(out), layer="point")
            spatial_count += len(gdf_pt)
        if "polygon" in table_names:
            gdf_pg = gpd.read_file(str(out), layer="polygon")
            spatial_count += len(gdf_pg)
        assert spatial_count == 2

        # attributes レイヤーに NULL ジオメトリ 1件
        conn = sqlite3.connect(str(out))
        attr_count = conn.execute("SELECT COUNT(*) FROM attributes").fetchone()[0]
        conn.close()
        assert attr_count == 1

    def test_gpkg_no_append_mode(self, tmp_path, gdf_building_with_geom):
        """to_file() に mode='a' を渡さない（fiona 1.9.6 + PyInstaller で NULL pointer error になるため）"""
        out = tmp_path / "out.gpkg"
        original_to_file = gpd.GeoDataFrame.to_file
        captured_calls = []

        def spy_to_file(self_gdf, *args, **kwargs):
            captured_calls.append(kwargs.copy())
            return original_to_file(self_gdf, *args, **kwargs)

        with patch.object(gpd.GeoDataFrame, "to_file", spy_to_file):
            export_data(gdf_building_with_geom, str(out), "geopackage", "building")

        # mode='a' が使用されていないことを確認
        for call_kwargs in captured_calls:
            assert call_kwargs.get("mode") != "a", (
                "mode='a' は fiona 1.9.6 + PyInstaller で NULL pointer error を引き起こす"
            )

    def test_gpkg_attributes_layer_schema(self, tmp_path, gdf_building_all_null):
        """attributes テーブルに fid・日本語カラム名が存在"""
        out = tmp_path / "out.gpkg"
        export_data(gdf_building_all_null, str(out), "geopackage", "building")

        conn = sqlite3.connect(str(out))
        cursor = conn.execute("PRAGMA table_info(attributes)")
        col_names = [row[1] for row in cursor.fetchall()]
        conn.close()

        assert "fid" in col_names
        # 日本語カラム名が存在する（rename_columns による翻訳結果）
        assert "建物ID" in col_names
        assert "空き家推定結果" in col_names


# ============================================================
# area 単位テスト
# ============================================================


class TestAreaExport:
    """area 単位のエクスポート検証"""

    def test_area_gpkg_with_geometry(self, tmp_path, gdf_area_with_geom):
        """area 単位・ジオメトリあり → GeoPackage に全件出力"""
        out = tmp_path / "out.gpkg"
        export_data(gdf_area_with_geom, str(out), "geopackage", "area")

        gdf_result = gpd.read_file(str(out))
        assert len(gdf_result) == 2
        assert gdf_result.geometry.notnull().all()

    def test_area_gpkg_all_null(self, tmp_path, gdf_area_all_null):
        """area 単位・全行None → attributes レイヤーのみ"""
        out = tmp_path / "out.gpkg"
        export_data(gdf_area_all_null, str(out), "geopackage", "area")

        conn = sqlite3.connect(str(out))
        rows = conn.execute(
            "SELECT table_name, data_type FROM gpkg_contents"
        ).fetchall()
        conn.close()

        table_names = [r[0] for r in rows]
        assert "attributes" in table_names
        spatial_layers = [r[0] for r in rows if r[1] == "features"]
        assert len(spatial_layers) == 0

    def test_area_geojson_with_geometry(self, tmp_path, gdf_area_with_geom):
        """area 単位・ジオメトリあり → GeoJSON に全件出力"""
        out = tmp_path / "out.geojson"
        export_data(gdf_area_with_geom, str(out), "geojson", "area")

        with open(out, encoding="utf-8") as f:
            data = json.load(f)

        features = data["features"]
        assert len(features) == 2
        for feat in features:
            assert feat["geometry"] is not None

    def test_area_csv_with_geometry(self, tmp_path, gdf_area_with_geom):
        """area 単位・ジオメトリあり → CSV に全件出力"""
        out = tmp_path / "out.csv"
        export_data(gdf_area_with_geom, str(out), "csv", "area")

        df = pd.read_csv(str(out))
        assert len(df) == 2
        # カラム名が日本語
        assert "地域名称" in df.columns

    def test_area_gpkg_with_bytes_column_fiona(self, tmp_path, gdf_area_with_bytes_column):
        """area 単位・bytes型カラムあり → fionaエンジンでも正常出力（bytes→str変換）

        SQLiteのBLOB由来でbytes型カラムが混入した場合、
        fionaエンジンでは ValueError: Invalid field type <class 'bytes'> が発生する。
        PyInstaller環境ではpyogrioが利用できずfionaにフォールバックするため、
        export_data()内でbytes→str変換を行う必要がある。
        """
        out = tmp_path / "out.gpkg"

        # PyInstaller環境を再現: to_file()にengine='fiona'を強制注入
        original_to_file = gpd.GeoDataFrame.to_file

        def fiona_to_file(self_gdf, *args, **kwargs):
            kwargs["engine"] = "fiona"
            return original_to_file(self_gdf, *args, **kwargs)

        with patch.object(gpd.GeoDataFrame, "to_file", fiona_to_file):
            export_data(gdf_area_with_bytes_column, str(out), "geopackage", "area")

        gdf_result = gpd.read_file(str(out))
        assert len(gdf_result) == 2
        # bytes が文字列に変換されている
        assert isinstance(gdf_result["作成日"].iloc[0], str)


# ============================================================
# CSV テスト
# ============================================================


class TestCSV:
    """CSV 出力の検証"""

    def test_csv_no_polygon_no_geocoding(self, tmp_path, gdf_building_no_polygon_no_geocoding):
        """ポリゴンなし・ジオコーディングなし → 全行出力、緯度経度は空"""
        out = tmp_path / "out.csv"
        export_data(gdf_building_no_polygon_no_geocoding, str(out), "csv", "building")

        df = pd.read_csv(str(out))
        assert len(df) == 3
        assert df["緯度"].isna().all()
        assert df["経度"].isna().all()
        # 属性データは保持されている
        assert df["建物ID"].notna().all()
        assert df["正規化住所"].notna().all()

    def test_csv_all_null_geometry(self, tmp_path, gdf_building_all_null):
        """全行 None → 全行出力、ジオメトリ列なし（CSVではgeometryカラムは除外）"""
        out = tmp_path / "out.csv"
        export_data(gdf_building_all_null, str(out), "csv", "building")

        df = pd.read_csv(str(out))
        assert len(df) == 3
        # カラム名が日本語
        assert "建物ID" in df.columns
        assert "空き家推定結果" in df.columns


# ============================================================
# rename_columns テスト
# ============================================================


class TestRenameColumns:
    """rename_columns() のジオメトリカラム再設定を検証"""

    def test_rename_columns_set_geometry(self, gdf_building_with_geom):
        """リネーム後に .geometry アクセサが正常動作する"""
        result = rename_columns(
            gdf_building_with_geom, "geojson", target_unit="building"
        )
        # set_geometry("geometry") により、アクティブジオメトリカラムが "geometry" になっている
        assert result.geometry.name == "geometry"
        # ジオメトリ値にアクセスできる
        assert result.geometry.notnull().all()
        # カラム名が日本語に翻訳されている
        assert "建物ID" in result.columns
