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
from shapely.geometry import Point

from E003_Summarization.E033 import export_data, rename_columns
from constants import COLUMNS_EXPORT_BUILDING_IF004


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


# ============================================================
# 出力対象カラムの網羅 テスト
# ============================================================


# 画面に出ていて出力にも必要な列と、その日本語名。
# 正本は app/src/shared/column-translations.json（building）。
EXPECTED_EXPORT_COLUMNS = {
    "is_vacant": "空き家",
    "vacant_type": "空き家区分",
    "vacant_source": "空き家調査元",
    "vacant_year": "空き家調査年度",
    "address_precision_flag": "調査住所精度不足フラグ",
    "predicted_probability_change_rate_from_oldest": "空き家推定確率の変化率（最古年度比）",
    "predicted_probability_change_rate_from_previous": "空き家推定確率の変化率（前年度比）",
    "storeys_above_ground": "地上階数",
    "num_cancellations": "職権消除数",
    "flag_zero_usage_over4consecutivemonths": "連続4か月使用量0フラグ",
}


@pytest.fixture
def gdf_building_full_columns():
    """EXPECTED_EXPORT_COLUMNS の全列を持つ building GeoDataFrame"""
    df = pd.DataFrame({
        "building_id": ["BLD001", "BLD002"],
        "normalized_address": ["東京都千代田区1-1", "東京都新宿区2-2"],
        "predicted_label": [1, 0],
        "predicted_probability": [0.85, 0.12],
        "is_vacant": [1, 0],
        "vacant_type": ["空き家", ""],
        "vacant_source": ["調査A", ""],
        "vacant_year": ["令和7年", ""],
        "address_precision_flag": [1, 0],
        "predicted_probability_change_rate_from_oldest": [0.1, -0.2],
        "predicted_probability_change_rate_from_previous": [0.3, -0.4],
        "storeys_above_ground": [2, 3],
        "num_cancellations": [0, 1],
        "flag_zero_usage_over4consecutivemonths": [1, 0],
    })
    df["bldg_geometry"] = [Point(139.76, 35.68), Point(139.78, 35.70)]
    return gpd.GeoDataFrame(df, geometry="bldg_geometry", crs="EPSG:4326")


class TestExportColumnCoverage:
    """COLUMNS_EXPORT_BUILDING_IF004 が出力対象カラムを取りこぼさないことを検証

    rename_columns() は辞書に載る列だけを残すホワイトリスト。DBとUIに列を足しても
    辞書へ登録しなければデータ出力から静かに消える（issue #1794）。
    """

    def test_csv_contains_expected_columns(
        self, tmp_path, gdf_building_full_columns
    ):
        """CSV出力に画面で選べる列が日本語名で含まれる"""
        out = tmp_path / "out.csv"
        export_data(gdf_building_full_columns, str(out), "csv", "building")

        header = pd.read_csv(str(out), nrows=0).columns.tolist()
        missing = [jp for jp in EXPECTED_EXPORT_COLUMNS.values() if jp not in header]
        assert not missing, f"CSV出力に含まれないカラム: {missing}"

    def test_geojson_contains_expected_columns(
        self, tmp_path, gdf_building_full_columns
    ):
        """GeoJSON出力のpropertiesに画面で選べる列が含まれる"""
        out = tmp_path / "out.geojson"
        export_data(gdf_building_full_columns, str(out), "geojson", "building")

        with open(out, encoding="utf-8") as f:
            data = json.load(f)
        props = data["features"][0]["properties"]
        missing = [jp for jp in EXPECTED_EXPORT_COLUMNS.values() if jp not in props]
        assert not missing, f"GeoJSON出力に含まれないカラム: {missing}"

    def test_dictionary_registers_expected_columns(self):
        """辞書のDBカラム名と日本語名がUIの表示名と一致する"""
        for en, jp in EXPECTED_EXPORT_COLUMNS.items():
            assert COLUMNS_EXPORT_BUILDING_IF004.get(en) == jp


# ============================================================
# 建物関連データの展開 テスト
# ============================================================


def _gdf_with_ods(ods_values):
    """optional_data_source を持つ building GeoDataFrame を組み立てる"""
    df = pd.DataFrame({
        "building_id": [f"BLD{i:03d}" for i in range(1, len(ods_values) + 1)],
        "normalized_address": [f"東京都千代田区{i}-1" for i in range(1, len(ods_values) + 1)],
        "predicted_label": [1] * len(ods_values),
        "predicted_probability": [0.5] * len(ods_values),
        "optional_data_source": ods_values,
    })
    df["bldg_geometry"] = [Point(139.76 + i / 100, 35.68) for i in range(len(ods_values))]
    return gpd.GeoDataFrame(df, geometry="bldg_geometry", crs="EPSG:4326")


ODS_JSON_A = '[{"name": "課税標準額", "value": "5000000"}, {"name": "評価額", "value": "35"}]'
ODS_JSON_B = '[{"name": "課税標準額", "value": "1200000"}, {"name": "評価額", "value": null}]'


class TestOptionalDataSourceExport:
    """建物関連データ（optional_data_source）の個別カラム展開を検証

    DBは1列のJSONで保持し、分析画面は個別カラムへ展開して表示する。
    データ出力も同じ表示名で展開する（issue #1794）。
    """

    def test_csv_expands_entries_into_columns(self, tmp_path):
        """CSV出力でエントリが「[追加] 名前」のカラムに展開される"""
        out = tmp_path / "out.csv"
        export_data(_gdf_with_ods([ODS_JSON_A, ODS_JSON_B]), str(out), "csv", "building")

        df = pd.read_csv(str(out), dtype=str)
        assert "[追加] 課税標準額" in df.columns
        assert "[追加] 評価額" in df.columns
        assert df["[追加] 課税標準額"].tolist() == ["5000000", "1200000"]
        # value が null のエントリは欠損として出す
        assert pd.isna(df["[追加] 評価額"].iloc[1])

    def test_csv_places_expanded_columns_last(self, tmp_path):
        """展開したカラムは既存カラムの後ろに並ぶ"""
        out = tmp_path / "out.csv"
        export_data(_gdf_with_ods([ODS_JSON_A]), str(out), "csv", "building")

        header = pd.read_csv(str(out), nrows=0).columns.tolist()
        assert header[-2:] == ["[追加] 課税標準額", "[追加] 評価額"]

    def test_csv_row_without_entries_is_blank(self, tmp_path):
        """建物関連データを結合していない行は空欄になる"""
        out = tmp_path / "out.csv"
        export_data(_gdf_with_ods([ODS_JSON_A, None]), str(out), "csv", "building")

        df = pd.read_csv(str(out), dtype=str)
        assert df["[追加] 課税標準額"].iloc[0] == "5000000"
        assert pd.isna(df["[追加] 課税標準額"].iloc[1])

    def test_csv_all_null_adds_no_columns(self, tmp_path):
        """全行 NULL のときは展開カラムを作らず、JSONの生カラムも出さない"""
        out = tmp_path / "out.csv"
        export_data(_gdf_with_ods([None, None]), str(out), "csv", "building")

        header = pd.read_csv(str(out), nrows=0).columns.tolist()
        assert not [col for col in header if col.startswith("[追加] ")]
        assert "optional_data_source" not in header

    def test_geojson_expands_entries_into_properties(self, tmp_path):
        """GeoJSON出力のpropertiesにも展開したカラムが出る"""
        out = tmp_path / "out.geojson"
        export_data(_gdf_with_ods([ODS_JSON_A]), str(out), "geojson", "building")

        with open(out, encoding="utf-8") as f:
            data = json.load(f)
        props = data["features"][0]["properties"]
        assert props["[追加] 課税標準額"] == "5000000"
        assert "optional_data_source" not in props

    def test_geopackage_expands_entries_into_columns(self, tmp_path):
        """GeoPackage出力でも展開したカラムが書き込まれる"""
        out = tmp_path / "out.gpkg"
        export_data(_gdf_with_ods([ODS_JSON_A]), str(out), "geopackage", "building")

        gdf = gpd.read_file(str(out))
        assert "[追加] 課税標準額" in gdf.columns
        assert gdf["[追加] 課税標準額"].iloc[0] == "5000000"

    def test_columns_are_union_across_rows(self, tmp_path):
        """年度で列の集合が違っても、後の年度にしかない列を落とさない

        複数年度の推定は1つの data_set_result_id に年度ごとの行を書き込む(IF003)。
        先頭行だけで列を決めると、後の年度の建物関連データが全行から消える。
        """
        first_year = '[{"name": "課税標準額", "value": "5000000"}]'
        second_year = '[{"name": "課税標準額", "value": "1200000"}, {"name": "評価額", "value": "800000"}]'
        out = tmp_path / "out.csv"
        export_data(_gdf_with_ods([first_year, second_year]), str(out), "csv", "building")

        df = pd.read_csv(str(out), dtype=str)
        assert "[追加] 評価額" in df.columns
        assert pd.isna(df["[追加] 評価額"].iloc[0])
        assert df["[追加] 評価額"].iloc[1] == "800000"

    def test_geopackage_null_geometry_keeps_expanded_columns(self, tmp_path):
        """全行ジオメトリなしでも attributes レイヤーに展開カラムが残る"""
        gdf = _gdf_with_ods([ODS_JSON_A])
        gdf["bldg_geometry"] = [None]
        out = tmp_path / "out.gpkg"
        export_data(gdf, str(out), "geopackage", "building")

        conn = sqlite3.connect(str(out))
        columns = [row[1] for row in conn.execute("PRAGMA table_info(attributes)")]
        conn.close()
        assert "[追加] 課税標準額" in columns

    def test_broken_json_is_treated_as_empty(self, tmp_path):
        """壊れたJSONの行は空として扱い、出力を止めない"""
        out = tmp_path / "out.csv"
        export_data(_gdf_with_ods([ODS_JSON_A, "{壊れた"]), str(out), "csv", "building")

        df = pd.read_csv(str(out), dtype=str)
        assert len(df) == 2
        assert pd.isna(df["[追加] 課税標準額"].iloc[1])
