"""IF001 名寄せ処理 — 統合テスト

データセット組み合わせごとの正常系・異常系を検証する。
検証対象: エントリポイント(IF001.py:main)からDB書き込みまでの一連処理。

期待値の根拠:
- docs/spec/interfaces/IF001-normalization.md（処理フロー・進捗レポート・エラーハンドリング）
- docs/spec/data-flow.md（カラム変換・フラグ定義）

検証しないもの（他レイヤーの責務）:
- パイプラインがUIから完了するか → E2E
- 各関数の内部ロジック → ユニットテスト
- 推定精度の妥当性 → EXR
"""

import importlib
import json
import os
import tempfile
import zipfile

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point, Polygon
from unittest.mock import patch

import pytest

from db_helpers import query_all
from constants import ERROR_00051, TRANSLATE_COLUMNS_IF001


# ============================================================
# ヘルパー
# ============================================================


def _get_jobs(db_path):
    return query_all(db_path, "jobs")


def _get_job_tasks(db_path):
    return query_all(db_path, "job_tasks")


def _get_job_results(db_path):
    return query_all(db_path, "job_results")


def _write_csv(path, df):
    """UTF-8 BOM付きCSVを書き出す（FEアップロード形式と同一）"""
    df.to_csv(path, index=False, encoding="utf-8-sig")


def _read_output_csv(db_path, data_dir):
    """job_resultsから出力CSVパスを取得して読み込む"""
    results = _get_job_results(db_path)
    assert len(results) >= 1, "job_resultsにレコードがない"
    csv_path = os.path.join(data_dir, results[0]["file_path"])
    assert os.path.exists(csv_path), f"出力CSV {csv_path} が見つからない"
    return pd.read_csv(csv_path)


def _run_if001(params):
    """IF001.main()を実行"""
    test_args = ["IF001.py", "--parameters", json.dumps(params)]
    with patch("sys.argv", test_args):
        import IF001
        importlib.reload(IF001)
        IF001.main()


def _create_base_data(data_dir):
    """全ケース共通: 水道閉開栓(DT105) + 水道使用量(DT104) + 住基(DT106) を生成

    テスト住所3件:
    - テスト市大手町1-1 (W001): 開栓中、使用量あり、住基あり(2人世帯)
    - テスト市駅前2-3 (W002): 閉栓済、使用量0、住基あり(1人世帯)
    - テスト市本町3-5 (W003): 開栓中、使用量あり、住基なし
    """
    _write_csv(os.path.join(data_dir, "water_status.csv"), pd.DataFrame({
        "水道番号": ["W001", "W002", "W003"],
        "住所": ["テスト市大手町1-1", "テスト市駅前2-3", "テスト市本町3-5"],
        "開栓日": ["2020-01-01", "2019-06-15", "2021-03-01"],
        "閉栓日": ["", "2022-06-30", ""],
    }))

    # spec: SuidoProcessor._create_period_usage で直近6期間(f1〜f6)を生成
    usage_rows = []
    dates = ["20220301", "20220501", "20220701", "20220901", "20221101", "20230101"]
    for wn in ["W001", "W002", "W003"]:
        for i, d in enumerate(dates):
            usage_rows.append({"水道番号": wn, "検針日": d, "使用量": (i + 1) * 3 if wn != "W002" else 0})
    _write_csv(os.path.join(data_dir, "water_usage.csv"), pd.DataFrame(usage_rows))

    _write_csv(os.path.join(data_dir, "juki.csv"), pd.DataFrame({
        "世帯番号": ["H001", "H001", "H002"],
        "住所": ["テスト市大手町1-1", "テスト市大手町1-1", "テスト市駅前2-3"],
        "生年月日": ["1960-01-15", "1990-05-20", "1985-11-03"],
        "住定日": ["2010-04-01", "2010-04-01", "2015-08-01"],
        "異動事由": ["転入", "転入", "転入"],
        "異動日": ["2010-04-01", "2010-04-01", "2015-08-01"],
    }))


def _create_census_dummy(data_dir):
    """E016スキップ時用: 空のZIP（中身は不問）"""
    census_path = os.path.join(data_dir, "census.zip")
    with zipfile.ZipFile(census_path, "w") as zf:
        zf.writestr("dummy.txt", "placeholder")


def _create_census_gpkg(data_dir):
    """E016実行時用: 国勢調査GeoPackage（KEY_CODE・S_NAME・geometry）

    spec (E016): 町丁字区画データ。KEY_CODEとS_NAMEを付与するために使用。
    テスト用に大手町・駅前・本町を含むポリゴンを1つ作成。
    """
    census_gdf = gpd.GeoDataFrame({
        "KEY_CODE": ["001"],
        "S_NAME": ["テスト町丁字"],
        "AREA": [1000.0],
    }, geometry=[
        # テスト住所の座標を包含する大きなポリゴン
        Polygon([(139.0, 35.0), (140.0, 35.0), (140.0, 36.0), (139.0, 36.0)])
    ], crs="EPSG:4326")
    census_path = os.path.join(data_dir, "census.gpkg")
    census_gdf.to_file(census_path, driver="GPKG")
    return census_path


def _create_geocoding_csv(data_dir):
    """ジオコーディング済データ(DT213): 住所→緯度経度

    spec (IF001 Step 4.5): geocoding_cleaned サフィックス付きカラムとしてLEFT JOIN。
    テスト住所3件に仮の座標を設定。
    """
    _write_csv(os.path.join(data_dir, "geocoding.csv"), pd.DataFrame({
        "住所": ["テスト市大手町1-1", "テスト市駅前2-3", "テスト市本町3-5"],
        "緯度": [35.68, 35.69, 35.70],
        "経度": [139.76, 139.77, 139.78],
    }))


def _create_building_polygon_gpkg(data_dir):
    """建物ポリゴン(DT501 plateau/gpkg): PLATEAU建物ポリゴン

    spec (E016): PLATEAUデータの場合、buildingIDカラムが必須（E016.py L831-834）。
    実データ（fixtures/建物ポリゴンデータ（PLATEAU）.gpkg）のカラム構造を参考に最小限のカラムを設定。
    テスト住所の座標付近に建物ポリゴンを3つ配置。
    """
    buildings = gpd.GeoDataFrame({
        "buildingID": ["BLD_001", "BLD_002", "BLD_003"],
        "usage": ["住宅", "住宅", "住宅"],
    }, geometry=[
        Polygon([(139.759, 35.679), (139.761, 35.679), (139.761, 35.681), (139.759, 35.681)]),
        Polygon([(139.769, 35.689), (139.771, 35.689), (139.771, 35.691), (139.769, 35.691)]),
        Polygon([(139.779, 35.699), (139.781, 35.699), (139.781, 35.701), (139.779, 35.701)]),
    ], crs="EPSG:4326")
    path = os.path.join(data_dir, "buildings.gpkg")
    buildings.to_file(path, driver="GPKG")
    return path


def _create_building_polygon_shp_plateau(data_dir):
    """建物ポリゴン(DT501 plateau/shp): Shapefile (zip) 形式の PLATEAU 建物ポリゴン

    spec (E016 L758-807): DT501 shp 経路は `extract_zip` で .shp/.shx/.dbf/.prj を
    展開後、`read_file` で読み込まれ、L795-798 で `buildingID` 列が `building_id`
    へ変換される。この buildingID 処理は shp ブランチ固有 (data_type 非参照) で、
    gpkg の plateau 分岐 (L831-837) とは別コード箇所である。

    gpkg 版 (`_create_building_polygon_gpkg`) とジオメトリ・カラム構造を完全一致させ、
    file format 以外の変数を固定する。配布形態は zip 圧縮バンドル。
    """
    buildings = gpd.GeoDataFrame({
        "buildingID": ["BLD_001", "BLD_002", "BLD_003"],
        "usage": ["住宅", "住宅", "住宅"],
    }, geometry=[
        Polygon([(139.759, 35.679), (139.761, 35.679), (139.761, 35.681), (139.759, 35.681)]),
        Polygon([(139.769, 35.689), (139.771, 35.689), (139.771, 35.691), (139.769, 35.691)]),
        Polygon([(139.779, 35.699), (139.781, 35.699), (139.781, 35.701), (139.779, 35.701)]),
    ], crs="EPSG:4326")

    with tempfile.TemporaryDirectory() as tmp_shp_dir:
        shp_path = os.path.join(tmp_shp_dir, "buildings.shp")
        buildings.to_file(shp_path, driver="ESRI Shapefile", encoding="utf-8")

        zip_path = os.path.join(data_dir, "buildings_plateau.zip")
        with zipfile.ZipFile(zip_path, "w") as zf:
            for ext in ("shp", "shx", "dbf", "prj"):
                f = os.path.join(tmp_shp_dir, f"buildings.{ext}")
                if os.path.exists(f):
                    zf.write(f, arcname=f"buildings.{ext}")

    return zip_path


def _create_building_polygon_gpkg_others(data_dir):
    """建物ポリゴン(DT501 others/gpkg): 非PLATEAUデータ

    spec (E016 L838-841): data_type != "plateau" の else 分岐では buildingID カラム不要。
    fixture は buildingID を持たず usage のみ保持し、load_and_process_data が
    gdf.index + 1 を building_id に自動付与する経路を発火させる。

    plateau fixture (`_create_building_polygon_gpkg`) から buildingID 列のみ除去した構成。
    ジオメトリ座標は plateau と同一 (テスト住所 W001/W002/W003 付近)。
    """
    buildings = gpd.GeoDataFrame({
        "usage": ["住宅", "住宅", "住宅"],
    }, geometry=[
        Polygon([(139.759, 35.679), (139.761, 35.679), (139.761, 35.681), (139.759, 35.681)]),
        Polygon([(139.769, 35.689), (139.771, 35.689), (139.771, 35.691), (139.769, 35.691)]),
        Polygon([(139.779, 35.699), (139.781, 35.699), (139.781, 35.701), (139.779, 35.701)]),
    ], crs="EPSG:4326")
    path = os.path.join(data_dir, "buildings_others.gpkg")
    buildings.to_file(path, driver="GPKG")
    return path


def _create_building_polygon_gpkg_plateau_no_buildingid(data_dir):
    """建物ポリゴン(DT501 plateau/gpkg) + buildingID 列欠損: E6 異常系用 fixture

    spec (E016 L831-837): data_type="plateau" では `gdf["buildingID"]` を参照するため
    buildingID 列欠損時は KeyError → `set_error(ERROR_00030)` → re-raise の経路を発火する。

    `_create_building_polygon_gpkg_others` と構造 (列・geometry) は同一だが、
    ファイル名と用途 (plateau 分岐の異常系 fixture) を明確化するため独立関数として定義する。
    """
    buildings = gpd.GeoDataFrame({
        "usage": ["住宅", "住宅", "住宅"],
    }, geometry=[
        Polygon([(139.759, 35.679), (139.761, 35.679), (139.761, 35.681), (139.759, 35.681)]),
        Polygon([(139.769, 35.689), (139.771, 35.689), (139.771, 35.691), (139.769, 35.691)]),
        Polygon([(139.779, 35.699), (139.781, 35.699), (139.781, 35.701), (139.779, 35.701)]),
    ], crs="EPSG:4326")
    path = os.path.join(data_dir, "buildings_plateau_no_buildingid.gpkg")
    buildings.to_file(path, driver="GPKG")
    return path


def _create_geocoding_csv_missing_latlng(data_dir):
    """ジオコーディング済データ(DT213) で lat/lng 列が欠損した異常系 fixture (E7 用)

    通常 `_create_geocoding_csv` から `緯度` / `経度` 列を完全に除去した構成。
    IF001.py:327-342 の rename_map は pandas rename の仕様で missing keys を
    silently ignore するため、本ファイルは中間 CSV に `*_geocoding_cleaned` 列が
    書き出されないまま E016 読込段階 (E016.py:710) で ERROR_00024 を誘発する。
    """
    _write_csv(os.path.join(data_dir, "geocoding_missing_latlng.csv"), pd.DataFrame({
        "住所": ["テスト市大手町1-1", "テスト市駅前2-3", "テスト市本町3-5"],
    }))


def _create_touki_csv(data_dir):
    """登記簿(DT107): 住所・構造・登記事由・登記日付

    spec (E013 TatemonoProcessor): events_json, structure_name を生成。
    spec (data-flow.md): touki_residence_flag=1 になる。
    """
    _write_csv(os.path.join(data_dir, "touki.csv"), pd.DataFrame({
        "住所": ["テスト市大手町1-1", "テスト市大手町1-1", "テスト市駅前2-3"],
        "構造": ["木造", "木造", "鉄骨造"],
        "登記事由": ["売買", "相続", "売買"],
        "登記日付": ["20150101", "20200601", "20180301"],
    }))


def _create_dt119_csv(data_dir):
    """建物種別判定用データ(DT119 CSV形式)

    spec (Step 9): CSVの場合 merge_building_type_determination() で住所結合。
    residential_valuesに含まれる建物種別のレコードと、未結合（空文字）のレコードが残る。
    """
    _write_csv(os.path.join(data_dir, "dt119.csv"), pd.DataFrame({
        "地番住所": ["テスト市大手町1-1", "テスト市駅前2-3", "テスト市本町3-5", "テスト市別町9-9"],
        "建物種別": ["住宅", "住宅", "店舗", "住宅"],
    }))


def _create_dt119_gpkg(data_dir, include_non_residential=True):
    """建物種別判定用データ(DT119 GeoPackage形式)

    spec (Step 9): GeoPackage/Shapefileの場合、ポイント→ポリゴンのwithin判定で
    非住宅を除外する。residential_valuesに含まれない建物種別のポリゴンに
    水道栓座標が含まれるレコードが除外される。
    """
    rows = [
        {"usage": "住宅", "geometry": Polygon([(139.759, 35.679), (139.761, 35.679), (139.761, 35.681), (139.759, 35.681)])},
        {"usage": "住宅", "geometry": Polygon([(139.769, 35.689), (139.771, 35.689), (139.771, 35.691), (139.769, 35.691)])},
    ]
    if include_non_residential:
        # W003(139.78, 35.70)を包含する非住宅ポリゴン
        rows.append(
            {"usage": "店舗", "geometry": Polygon([(139.779, 35.699), (139.781, 35.699), (139.781, 35.701), (139.779, 35.701)])}
        )
    gdf = gpd.GeoDataFrame(rows, crs="EPSG:4326")
    path = os.path.join(data_dir, "dt119.gpkg")
    gdf.to_file(path, driver="GPKG")
    return path


def _create_dt119_shp(data_dir, include_non_residential=True):
    """建物種別判定用データ(DT119 Shapefile形式)

    N16/N17 用。ポリゴン設計 (住宅2 + 店舗1) は `_create_dt119_gpkg` を踏襲し、
    file format 以外の変数を固定する。
    IF001.py:734-735 は `gpd.read_file(building_type_determination)` を直接呼び、
    DT501 の shp 経路と異なり extract_zip を通さない。そのため data_dir に
    非圧縮で `.shp` / `.shx` / `.dbf` / `.prj` を配置する。
    """
    rows = [
        {"usage": "住宅", "geometry": Polygon([(139.759, 35.679), (139.761, 35.679), (139.761, 35.681), (139.759, 35.681)])},
        {"usage": "住宅", "geometry": Polygon([(139.769, 35.689), (139.771, 35.689), (139.771, 35.691), (139.769, 35.691)])},
    ]
    if include_non_residential:
        rows.append(
            {"usage": "店舗", "geometry": Polygon([(139.779, 35.699), (139.781, 35.699), (139.781, 35.701), (139.779, 35.701)])}
        )
    gdf = gpd.GeoDataFrame(rows, crs="EPSG:4326")
    path = os.path.join(data_dir, "dt119.shp")
    gdf.to_file(path, driver="ESRI Shapefile", encoding="utf-8")
    return path


def _create_vacant_house_csv(data_dir):
    """空き家リスト: 住所のみ

    spec (Step 5): assign_labelsでis_vacantラベルを付与。
    """
    _write_csv(os.path.join(data_dir, "vacant_house.csv"), pd.DataFrame({
        "住所": ["テスト市駅前2-3"],
    }))


def _create_ods_csv(data_dir):
    """説明変数追加用データ(ODS): 住所 + 追加カラム

    spec (Step 4.6): merge_optional_data_sourceで住所結合。カラムに_odsサフィックス付与。
    """
    _write_csv(os.path.join(data_dir, "ods.csv"), pd.DataFrame({
        "住所": ["テスト市大手町1-1", "テスト市駅前2-3"],
        "追加指標": [100, 200],
    }))


def _base_params(test_db, data_dir):
    """全ケース共通のパラメータ構造（必須4データ）"""
    return {
        "database_path": test_db,
        "job_id": None,
        "output_path": data_dir,
        "data": {
            "water_status": {
                "path": "water_status.csv",
                "columns": {
                    "water_supply_number": "水道番号",
                    "address": "住所",
                    "water_connection_date": "開栓日",
                    "water_disconnection_date": "閉栓日",
                },
            },
            "water_usage": {
                "path": "water_usage.csv",
                "columns": {
                    "water_supply_number": "水道番号",
                    "water_recorded_date": "検針日",
                    "water_usage": "使用量",
                },
            },
            "resident_registry": {
                "path": "juki.csv",
                "columns": {
                    "household_code": "世帯番号",
                    "address": "住所",
                    "birth_date": "生年月日",
                    "resident_date": "住定日",
                    "reason_transfer": "異動事由",
                    "date_transfer": "異動日",
                },
            },
            "census": {"path": "census.zip"},
        },
        "settings": {
            "reference_date": "2023-06-01",
            "municipality": "テスト市",
            "advanced": {"joining_method": ""},
        },
    }


# ============================================================
# 正常系
# ============================================================


class TestIF001MinimalDataset:
    """N1: 最小構成（必須4データのみ、DT213なし）

    spec期待値:
    - ジョブステータスが "complete" になる（spec: 進捗レポート表）
    - job_resultsに出力CSVパスが記録される（spec: Step 11）
    - DT213未指定のためE016がスキップされ、
      building_id/residenceID/KEY_CODE/S_NAME/geometry_plateauがNone
      （spec: Step 8「DT213未指定時」）
    - DT107未提供のためtouki_residence_flag=0（spec: data-flow.md）
    - DT119未提供のためプレースホルダカラム4列が追加（spec: Step 9）
    - suido_residence_flag=1（全レコードが水道データ起点）（spec: data-flow.md）
    - 一時ディレクトリが削除される（spec: エラーハンドリング finally句）
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_census_dummy(data_dir)
        params = _base_params(test_db, data_dir)
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: 全処理完了時のstatusは "complete" """
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert len(jobs) >= 1
        assert jobs[0]["status"] == "complete"

    def test_job_results_has_output_csv(self, env):
        """spec: job_resultsに出力CSVのパスが記録される。CSVは空でない"""
        _run_if001(env["params"])
        results = _get_job_results(env["test_db"])
        assert len(results) >= 1
        assert results[0]["file_path"].endswith(".csv")
        df = _read_output_csv(env["test_db"], env["data_dir"])
        assert len(df) >= 1, "出力CSVが空（0行）"

    def test_output_csv_exists_then_cleaned_up(self, env):
        """spec: 一時ディレクトリはfinally句でshutil.rmtreeにより削除される"""
        _run_if001(env["params"])
        results = _get_job_results(env["test_db"])
        csv_path = os.path.join(env["data_dir"], results[0]["file_path"])
        assert os.path.exists(csv_path), f"出力CSV {csv_path} が見つからない"
        uuid_stem = results[0]["file_path"].replace(".csv", "")
        uuid_dir = os.path.join(env["data_dir"], uuid_stem)
        assert not os.path.exists(uuid_dir), f"一時ディレクトリ {uuid_dir} が残っている"

    def test_e016_skip_columns_are_none(self, env):
        """spec: DT213未指定時、E016スキップで代替カラム5列がNoneで追加される"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        e016_cols = ["building_id", "residenceID", "KEY_CODE", "S_NAME", "geometry_plateau"]
        for col in e016_cols:
            jp_name = TRANSLATE_COLUMNS_IF001.get(col, col)
            assert jp_name in df.columns, f"E016スキップ時の代替カラム{jp_name}が出力CSVにない"
            assert df[jp_name].isna().all(), f"DT213未指定なのに{jp_name}に非NaN値がある"

    def test_touki_flag_is_zero_without_dt107(self, env):
        """spec: DT107未提供時、touki_residence_flag=0（data-flow.md）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        flag_col = TRANSLATE_COLUMNS_IF001.get("touki_residence_flag", "touki_residence_flag")
        assert flag_col in df.columns
        assert (df[flag_col] == 0).all(), "DT107未提供なのにtouki_residence_flag≠0の行がある"

    def test_suido_flag_is_one(self, env):
        """spec: 全レコードが水道データ起点のためsuido_residence_flag=1（data-flow.md）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        flag_col = TRANSLATE_COLUMNS_IF001.get("suido_residence_flag", "suido_residence_flag")
        assert flag_col in df.columns
        assert (df[flag_col] == 1).all()

    def test_dt119_placeholder_columns_exist(self, env):
        """spec: DT119未提供時、プレースホルダカラム4列が追加される（Step 9）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        placeholder_cols = [
            "address_building_type_determination",
            "latitude_building_type_determination",
            "longitude_building_type_determination",
            "usage_building_type_determination",
        ]
        for col in placeholder_cols:
            jp_name = TRANSLATE_COLUMNS_IF001.get(col, col)
            assert jp_name in df.columns, f"DT119未提供時のプレースホルダ{jp_name}が出力CSVにない"
            assert df[jp_name].isna().all(), f"DT119未提供なのに{jp_name}に非NaN値がある"


class TestIF001SpatialJoinFull:
    """N2: 空間結合フル（DT107 + DT213 + DT501 plateau/gpkg）

    spec期待値:
    - E016が実行され、building_idが付与される（spec: E016 出力データ）
    - residenceIDが付与される（spec: E016 add_residenceID）
    - KEY_CODE・S_NAMEが国勢調査から付与される（spec: E016 add_keycode）
    - DT107提供のためtouki_residence_flag=1（spec: data-flow.md）
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg(data_dir)
        _create_touki_csv(data_dir)
        _create_census_gpkg(data_dir)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",
        }
        params["data"]["building_registry"] = {
            "path": "touki.csv",
            "columns": {
                "address": "住所",
                "structure_name": "構造",
                "registration_reason": "登記事由",
                "registration_date": "登記日付",
            },
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: 全処理完了時のstatusは "complete" """
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_building_id_is_assigned(self, env):
        """spec: E016実行時、building_idが付与される（E016 出力データ）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        bid_col = TRANSLATE_COLUMNS_IF001.get("building_id", "building_id")
        assert bid_col in df.columns, "building_idカラムが出力CSVにない"
        # 座標があるレコードにはbuilding_idが付与されるはず
        assert df[bid_col].notna().any(), "building_idが全てNaN（空間結合が実行されていない）"

    def test_residence_id_is_assigned(self, env):
        """spec: E016実行時、residenceIDが付与される（E016 add_residenceID）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        rid_col = TRANSLATE_COLUMNS_IF001.get("residenceID", "residenceID")
        assert rid_col in df.columns
        assert df[rid_col].notna().any(), "residenceIDが全てNaN"

    def test_key_code_is_assigned(self, env):
        """spec: E016実行時、KEY_CODEが国勢調査から付与される（E016 add_keycode）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        kc_col = TRANSLATE_COLUMNS_IF001.get("KEY_CODE", "KEY_CODE")
        assert kc_col in df.columns
        assert df[kc_col].notna().any(), "KEY_CODEが全てNaN（国勢調査結合が失敗）"

    @pytest.mark.xfail(
        reason="#1715: IF001.py L324でnormalize_seriesにmunicipalityが渡されないため、"
        "水道データ側は市名除去済み、ジオコーディング側は市名残りで不一致。結合率0%。"
    )
    def test_geocoding_match_rate_is_positive(self, env):
        """#1715: ジオコーディング結合率が0%より大きいこと（根本原因の直接検証）

        水道データは municipality="テスト市" で正規化→「大手町1-1」
        ジオコーディングは municipality=None で正規化→「テスト市大手町1-1」
        → normalized_addressが不一致、LEFT JOINで全てNaN
        """
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        lat_col = TRANSLATE_COLUMNS_IF001.get("latitude_geocoding_cleaned", "latitude_geocoding_cleaned")
        assert lat_col in df.columns, "ジオコーディング緯度カラムがない"
        n_matched = df[lat_col].notna().sum()
        assert n_matched > 0, (
            f"ジオコーディング結合率0%: {n_matched}/{len(df)}件マッチ。"
            "normalize_seriesにmunicipalityが渡されていない可能性（#1715）"
        )

    def test_touki_flag_is_one_with_dt107(self, env):
        """spec: DT107提供時、touki_residence_flag=1のレコードが存在する（data-flow.md）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        flag_col = TRANSLATE_COLUMNS_IF001.get("touki_residence_flag", "touki_residence_flag")
        assert flag_col in df.columns
        assert (df[flag_col] == 1).any(), "DT107提供なのにtouki_residence_flag=1の行がない"


class TestIF001DT501PlateauShp:
    """N10: 空間結合フル（DT107 + DT213 + DT501 plateau/shp）

    spec期待値 (E016 L758-807):
    - DT501 の shp 経路は `extract_zip` で .shp/.shx/.dbf/.prj を展開後、
      `read_file` で読み込まれる (L764-774)
    - L795-805 で buildingID 列の有無で分岐: 存在すれば `building_id` へ変換、
      無ければ `index+1` にフォールバック。本テストの fixture は buildingID 列を持つ
    - この shp ブランチは gpkg の plateau 分岐 (L831-837) とは別コード箇所で、
      `data_type` パラメータを参照しない

    N2 (TestIF001SpatialJoinFull, plateau/gpkg) とは file format のみ差分。
    fixture はポリゴン 3 個の座標と buildingID 値を完全一致させ、file format
    以外の変数を固定する。shp ブランチの実行証拠は `job=complete` + 下流カラム
    付与で担保する (shp ブランチ失敗時は ERROR_00033/ERROR_00030 で status=error)。

    なお BUG-1715 (`IF001.py:324`) により geocoding の municipality 未送信で
    sjoin 全 unmatched → building_id は `cus_bldg_*` fallback を通る。N2 も同状態
    のため、本テストも prefix 検証はせず `.notna()` のみ確認する (N2 踏襲)。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_shp_plateau(data_dir)
        _create_touki_csv(data_dir)
        _create_census_gpkg(data_dir)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings_plateau.zip",
            "input_file_type": "shapefile",
            "data_type": "plateau",
        }
        params["data"]["building_registry"] = {
            "path": "touki.csv",
            "columns": {
                "address": "住所",
                "structure_name": "構造",
                "registration_reason": "登記事由",
                "registration_date": "登記日付",
            },
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: shp 経路 (extract_zip → read_file → buildingID 変換) で正常完了

        shp ブランチが途中で失敗すれば ERROR_00033 (shp not found) または
        ERROR_00030 (buildingID 変換失敗) で status=error になる。job=complete は
        shp ブランチ全体の成功の背理法証拠。
        """
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_no_shp_branch_errors_recorded(self, env):
        """spec: shp ブランチ固有のエラーコードが job_tasks に記録されない

        ERROR_00033 = `extract_zip` 後に .shp ファイルが見つからない (L768)
        ERROR_00030 = `buildingID.astype(str)` 変換失敗 (L800)
        いずれも shp ブランチを通った場合に発火しうる特定コード。
        両方の非発火で L758-807 全体の正常通過を直接証明する。
        """
        from constants import ERROR_00030, ERROR_00033
        _run_if001(env["params"])
        tasks = _get_job_tasks(env["test_db"])
        recorded = {t["error_code"] for t in tasks if t["error_code"]}
        assert ERROR_00033["code"] not in recorded, (
            f"shp 抽出失敗の ERROR_00033 が記録された。extract_zip 経路が壊れている可能性。"
            f"recorded: {recorded}"
        )
        assert ERROR_00030["code"] not in recorded, (
            f"buildingID 変換失敗の ERROR_00030 が記録された。shp ブランチ L795-798 の"
            f" `buildingID.astype(str)` が失敗した可能性。recorded: {recorded}"
        )

    def test_building_id_is_assigned(self, env):
        """spec: E016 実行後 building_id カラムに値が入る (N2 踏襲)

        shp ブランチ L795-805 で building_id を生成 → sjoin で matched/unmatched
        いずれの経路でも値が入る。値が全 NaN なら shp 読み込み自体が失敗した
        可能性が高い。
        """
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        bid_col = TRANSLATE_COLUMNS_IF001.get("building_id", "building_id")
        assert bid_col in df.columns, "building_idカラムが出力CSVにない"
        assert df[bid_col].notna().any(), "building_idが全てNaN（shp読み込みまたは sjoin 未実行）"

    def test_touki_flag_is_one_with_dt107(self, env):
        """spec: DT107 提供時 touki_residence_flag=1 が存在 (N2 踏襲)

        shp 経路でも N2 と同じ下流 (touki merge) が動くことを確認。
        """
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        flag_col = TRANSLATE_COLUMNS_IF001.get("touki_residence_flag", "touki_residence_flag")
        assert flag_col in df.columns
        assert (df[flag_col] == 1).any(), "DT107提供なのにtouki_residence_flag=1の行がない"


class TestIF001GeocodingWithoutPolygon:
    """N4: DT213あり・DT501なし

    spec期待値:
    - E016はポリゴンなしパスを実行（spec: E016 ポリゴンなしパス）
    - building_idは cus_bldg_* 形式（spec: E016 ポリゴンなしパス）
    - KEY_CODE・S_NAMEは国勢調査から付与される（ポリゴンなしでも実行）
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_census_gpkg(data_dir)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        # building_polygonは未指定
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: ポリゴンなしパスでも正常完了"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_building_id_is_custom_format(self, env):
        """spec: ポリゴンなし時、building_idは cus_bldg_* 形式（E016 ポリゴンなしパス）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        bid_col = TRANSLATE_COLUMNS_IF001.get("building_id", "building_id")
        assert bid_col in df.columns
        non_null = df[bid_col].dropna()
        assert len(non_null) > 0
        for val in non_null:
            assert str(val).startswith("cus_bldg_"), f"ポリゴンなしなのに cus_bldg_ 形式でない: {val}"

    def test_key_code_is_assigned_without_polygon(self, env):
        """spec: ポリゴンなしでもKEY_CODEは国勢調査から付与される（E016 add_keycode）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        kc_col = TRANSLATE_COLUMNS_IF001.get("KEY_CODE", "KEY_CODE")
        assert kc_col in df.columns
        assert df[kc_col].notna().any(), "ポリゴンなしでもKEY_CODEは付与されるはず"


class TestIF001GeocodingDT119:
    """N14: DT501 なし + geocoding あり + DT119 gpkg(vals 有)

    spec 期待値 (N4 + N6 の差分検証):
    - DT501 なし経路: building_id は cus_bldg_* 形式 (N4 と同じ)
    - DT119 gpkg + vals 有: building_filter 経路で非住宅除外 (N6 と同じ)
    - この 2 つの性質が併存するのが N14 固有 (E016 側の DT501 分岐と
      IF001.py 側の building_filter 分岐の独立性を担保する回帰テスト)

    根拠コード:
    - ml/async_tasks/IF001.py:687-814 (building_type_determination ブロック全体)
    - ml/async_tasks/IF001.py:748-769 (geocoding 経路で _geo_lat/_geo_lon merge)
    - ml/async_tasks/IF001.py:787-803 (within 判定で非住宅除外)
    - ml/async_tasks/IF001.py:804 (non_res_ids による main_df フィルタ)
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_census_gpkg(data_dir)
        _create_dt119_gpkg(data_dir, include_non_residential=True)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        # building_polygon (DT501) は未指定 — N4 と同じ経路
        params["data"]["building_type_determination"] = {
            "path": "dt119.gpkg",
            "input_file_type": "geopackage",
            "columns": {"building_type": "usage"},
            "residential_values": ["住宅"],
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: DT501 なし + DT119 gpkg building_filter で正常完了"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_non_residential_removed(self, env):
        """spec: 非住宅ポリゴン (W003 店舗) 内の水道栓のみ除外され、行数が正確に 2 件になる

        N6 と同じ期待だが、DT501 なし経路でも building_filter (IF001.py:787-803) が
        独立に発火する事を実証する。
        入力 3 件中 W003 (本町3-5, 店舗ポリゴン内) だけが除外され、
        W001 (住宅ポリゴン内) と W002 (住宅ポリゴン内) が残るため結果は正確に 2 行。
        """
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        assert len(df) == 2, (
            f"非住宅除外後に{len(df)}行 (2 行を期待: W003 のみ除外されるはず)。"
            f"過剰除外か除外漏れの可能性。"
        )

    def test_building_id_is_custom_format(self, env):
        """spec: DT501 なし経路で building_id は cus_bldg_* 形式 (N4 と同じ、E016 ポリゴンなしパス)

        N4 の test_building_id_is_custom_format と同じ期待を、DT119 gpkg building_filter
        と共存する条件で確認する。E016 の DT501 分岐と IF001.py の building_filter 分岐が
        互いに独立していることを担保する。
        """
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        bid_col = TRANSLATE_COLUMNS_IF001.get("building_id", "building_id")
        assert bid_col in df.columns
        non_null = df[bid_col].dropna()
        assert len(non_null) > 0, "building_filter 後に building_id が全て NaN"
        for val in non_null:
            assert str(val).startswith("cus_bldg_"), (
                f"DT501 なしなのに building_id が cus_bldg_ 形式でない: {val}"
            )


class TestIF001DT119CSV:
    """N5: DT119 CSV形式（merge_building_type_determination）

    spec期待値 (Step 9):
    - CSVの場合: merge_building_type_determinationで住所結合
    - usage_building_type_determinationカラムが追加される
    - residential_valuesに含まれる建物種別のレコードと未結合レコードが残る
    - residential_valuesに含まれない建物種別のレコードが除外される
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg(data_dir)
        _create_census_gpkg(data_dir)
        _create_dt119_csv(data_dir)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",
        }
        params["data"]["building_type_determination"] = {
            "path": "dt119.csv",
            "input_file_type": "csv",
            "columns": {"address": "地番住所", "building_type": "建物種別"},
            "residential_values": ["住宅"],
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: DT119 CSV結合で正常完了"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_usage_building_type_column_has_values(self, env):
        """spec: usage_building_type_determinationカラムが追加され、結合された値を持つ"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        col = TRANSLATE_COLUMNS_IF001.get(
            "usage_building_type_determination", "usage_building_type_determination"
        )
        assert col in df.columns, f"DT119 CSV結合後に{col}カラムがない"
        non_empty = df[col].dropna()
        non_empty = non_empty[non_empty != ""]
        assert len(non_empty) > 0, f"DT119 CSV結合したが{col}の値が全て空"

    def test_non_residential_filtered_by_residential_values(self, env):
        """spec: residential_valuesに含まれない建物種別（店舗）のレコードが除外される"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        col = TRANSLATE_COLUMNS_IF001.get(
            "usage_building_type_determination", "usage_building_type_determination"
        )
        if col in df.columns:
            values = df[col].dropna().unique()
            assert "店舗" not in values, "residential_values=[住宅]なのに店舗が残っている"


class TestIF001DT119CSVEmptyValues:
    """N15: DT119 CSV形式 + residential_values 空リスト

    spec 期待値 (N5 との差分検証):
    - `residential_values=[]` の場合 E016.py:2626 の `if building_type_values:` が False で
      filter 処理ごとスキップされる
    - N5 (vals=["住宅"]) では除外される「店舗」(W003) が残存する
    - 行数が変化しない (3 件全て残る)

    N7 (`TestIF001DT119GeoPackageEmptyValues`) と同じ「vals 空の filter skip」性質を
    CSV 経路 (merge_building_type_determination) で確認する対応テスト。

    根拠コード:
    - ml/src/E001_DataMatching/E016.py:2620-2638 (`if building_type_values:` 分岐)
    - ml/async_tasks/IF001.py:712-726 (CSV 経路の merge_building_type_determination 呼び出し)
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg(data_dir)
        _create_census_gpkg(data_dir)
        _create_dt119_csv(data_dir)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",
        }
        params["data"]["building_type_determination"] = {
            "path": "dt119.csv",
            "input_file_type": "csv",
            "columns": {"address": "地番住所", "building_type": "建物種別"},
            "residential_values": [],  # 空リスト: N5 との唯一差分
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: residential_values 空でも CSV merge 経路で正常完了"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_non_residential_remains(self, env):
        """spec: residential_values 空で filter skip → 非住宅「店舗」が残存する

        N5 (vals=["住宅"]) では本テストと逆に「店舗」除外を検証している。
        vals=[] で filter スキップが発火したことの直接証拠。
        """
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        col = TRANSLATE_COLUMNS_IF001.get(
            "usage_building_type_determination", "usage_building_type_determination"
        )
        assert col in df.columns, f"CSV 結合後に {col} 列がない"
        values = df[col].dropna().unique()
        assert "店舗" in values, (
            f"residential_values=[] で filter skip なのに「店舗」が残っていない。"
            f"values={list(values)}"
        )

    def test_row_count_unchanged(self, env):
        """spec: vals 空で filter skip → 水道3件全てが残る (N5 では 店舗除外で減少)"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        assert len(df) == 3, (
            f"residential_values=[] で filter skip なのに行数が {len(df)} (3 を期待)"
        )


class TestIF001DT119GeoPackage:
    """N6: DT119 GeoPackage形式（sjoin + building_filter、residential_values有）

    spec期待値 (Step 9):
    - GeoPackage/Shapefile: ポイント→ポリゴンのwithin判定で非住宅を除外
    - residential_valuesに含まれない建物種別のポリゴンに含まれるレコードが除外される
    - 行数が減少する（非住宅除外）
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg(data_dir)
        _create_census_gpkg(data_dir)
        _create_dt119_gpkg(data_dir, include_non_residential=True)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",
        }
        params["data"]["building_type_determination"] = {
            "path": "dt119.gpkg",
            "input_file_type": "geopackage",
            "columns": {"building_type": "usage"},
            "residential_values": ["住宅"],
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: DT119 GeoPackage + building_filterで正常完了"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_non_residential_removed(self, env):
        """spec: 非住宅ポリゴン内の水道栓レコードが除外され、行数が減少する"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        # テストデータ: W003(本町3-5)が店舗ポリゴン内 → 除外されるはず
        # 3件中2件が残る
        assert len(df) < 3, f"非住宅除外後に{len(df)}行（3行未満を期待）"


class TestIF001DT119GeoPackageEmptyValues:
    """N7: DT119 GeoPackage形式 + residential_values空リスト

    spec期待値 (Step 9):
    - residential_values未指定時はフィルタをスキップ（IF001.py L730）
    - 行数が変化しない
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg(data_dir)
        _create_census_gpkg(data_dir)
        _create_dt119_gpkg(data_dir, include_non_residential=True)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",
        }
        params["data"]["building_type_determination"] = {
            "path": "dt119.gpkg",
            "input_file_type": "geopackage",
            "columns": {"building_type": "usage"},
            "residential_values": [],  # 空リスト
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: residential_values空でも正常完了"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_row_count_unchanged(self, env):
        """spec: residential_values空でフィルタスキップ → 行数3のまま"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        assert len(df) == 3, f"residential_values空でフィルタスキップなのに行数が{len(df)}（3を期待）"


class TestIF001DT119Shapefile:
    """N16: DT119 Shapefile形式（sjoin + building_filter、residential_values有）

    spec期待値 (Step 9):
    - GeoPackage と Shapefile は同じ `gpd.read_file` 経路で読み込まれる
      (IF001.py:734-735)。期待挙動は N6 (gpkg vals 有) と同一
    - 非住宅ポリゴン内のレコードが除外され、行数が減少する

    N6 との差分は input_file_type / 拡張子のみ。ポリゴン設計 (住宅2+店舗1)
    は `_create_dt119_gpkg` と完全一致させ、file format 以外の変数を固定する。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg(data_dir)
        _create_census_gpkg(data_dir)
        _create_dt119_shp(data_dir, include_non_residential=True)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",
        }
        params["data"]["building_type_determination"] = {
            "path": "dt119.shp",
            "input_file_type": "shapefile",
            "columns": {"building_type": "usage"},
            "residential_values": ["住宅"],
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: DT119 Shapefile + building_filterで正常完了"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_non_residential_removed(self, env):
        """spec: 非住宅ポリゴン内の水道栓レコードが除外され、行数が減少する

        N6 と同じ前提: W003 が店舗ポリゴンに含まれるため、3件中1件が除外される。
        """
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        assert len(df) < 3, f"非住宅除外後に{len(df)}行（3行未満を期待）"


class TestIF001DT119ShapefileEmptyValues:
    """N17: DT119 Shapefile形式 + residential_values空リスト

    spec期待値 (Step 9):
    - residential_values 未指定時はフィルタをスキップ (IF001.py:730-731)
    - Shapefile 経路でも同じスキップ分岐が発火する
    - 行数が変化しない

    N7 (gpkg vals 空) との差分は input_file_type / 拡張子のみ。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg(data_dir)
        _create_census_gpkg(data_dir)
        _create_dt119_shp(data_dir, include_non_residential=True)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",
        }
        params["data"]["building_type_determination"] = {
            "path": "dt119.shp",
            "input_file_type": "shapefile",
            "columns": {"building_type": "usage"},
            "residential_values": [],
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: residential_values空でも正常完了"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_row_count_unchanged(self, env):
        """spec: residential_values空でフィルタスキップ → 行数3のまま

        Shapefile 経路でも N7 (gpkg) と同じスキップ分岐が発火することを
        行数不変で確認する。
        """
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        assert len(df) == 3, f"residential_values空でフィルタスキップなのに行数が{len(df)}（3を期待）"


class TestIF001FullDataset:
    """N3: 全データ（DT107 + DT213 + DT501 others/shp + DT119 CSV + ODS + 空き家 + nearest）

    spec期待値:
    - joining_method=nearest で最近傍結合（spec: E016 空間結合方式 option=1）
    - ODS提供時、_odsサフィックス付きカラムが追加される（spec: Step 4.6）
    - 空き家リスト提供時、is_vacantラベルが付与される（spec: Step 5）
    - touki_residence_flag=1のレコードが存在する
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg(data_dir)
        _create_touki_csv(data_dir)
        _create_census_gpkg(data_dir)
        _create_dt119_csv(data_dir)
        _create_vacant_house_csv(data_dir)
        _create_ods_csv(data_dir)

        params = _base_params(test_db, data_dir)
        params["settings"]["advanced"]["joining_method"] = "nearest"
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",
        }
        params["data"]["building_registry"] = {
            "path": "touki.csv",
            "columns": {
                "address": "住所",
                "structure_name": "構造",
                "registration_reason": "登記事由",
                "registration_date": "登記日付",
            },
        }
        params["data"]["building_type_determination"] = {
            "path": "dt119.csv",
            "input_file_type": "csv",
            "columns": {"address": "地番住所", "building_type": "建物種別"},
            "residential_values": ["住宅"],
        }
        params["data"]["vacant_house"] = {
            "path": "vacant_house.csv",
            "columns": {"address": "住所"},
        }
        params["data"]["optional_data_source"] = {
            "path": "ods.csv",
            "columns": {"address": "住所"},
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: 全データ + nearest結合で正常完了"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_ods_columns_have_suffix(self, env):
        """spec: ODS由来カラムは_odsサフィックスが付与される（Step 4.6）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        ods_cols = [c for c in df.columns if c.endswith("_ods")]
        assert len(ods_cols) > 0, "ODS提供なのに_odsサフィックス付きカラムがない"
        # テストデータの「追加指標」カラムが_odsサフィックスで存在するはず
        assert any("追加指標" in c for c in ods_cols), (
            f"ODS入力の「追加指標」が_odsカラムに含まれていない: {ods_cols}"
        )

    def test_vacant_house_label_exists(self, env):
        """spec: 空き家リスト提供時、is_vacantラベルが付与される（Step 5）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        is_vacant_col = TRANSLATE_COLUMNS_IF001.get("is_vacant", "is_vacant")
        assert is_vacant_col in df.columns, "空き家リスト提供なのにis_vacantカラムがない"
        # テストデータで駅前2-3が空き家として指定されている → is_vacant=1が存在するはず
        assert (df[is_vacant_col] == 1).any(), "空き家リスト提供なのにis_vacant=1のレコードがない"

    def test_touki_flag_present(self, env):
        """spec: DT107提供時、touki_residence_flag=1のレコードが存在する"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        flag_col = TRANSLATE_COLUMNS_IF001.get("touki_residence_flag", "touki_residence_flag")
        assert (df[flag_col] == 1).any()


class TestIF001WithoutJuki:
    """N9: jukiなし構成

    コード事実:
    - juki_cfg.get("file")がFalsyの場合、juki_residence_flag=0を代入（IF001.py L277）
    - jukiデータなしでもパイプラインは正常完了する
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_census_dummy(data_dir)
        params = _base_params(test_db, data_dir)
        # jukiデータを除外してelse分岐（L277）を通す
        del params["data"]["resident_registry"]
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_completes(self, env):
        """jukiなしでもパイプラインは正常完了する"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_juki_residence_flag_is_zero(self, env):
        """spec: jukiデータ未提供時、juki_residence_flag=0（IF001.py L277）"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        flag_col = TRANSLATE_COLUMNS_IF001.get("juki_residence_flag", "juki_residence_flag")
        assert flag_col in df.columns
        assert (df[flag_col] == 0).all(), "jukiデータ未提供なのにjuki_residence_flag≠0の行がある"


class TestIF001ReferenceDateEmpty:
    """N8: reference_date空

    コード事実:
    - hensu_150()はreference_dateを基準日として使用（E014.py parse_base_date）
    - 空文字の場合ValueErrorでパイプラインがerrorになる
    - UIではreference_dateは必須フィールドのため、空文字でUIから到達することは通常ない
    - ただしFEバリデーションをすり抜けた場合のエラーパスとして検証する
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_census_dummy(data_dir)
        params = _base_params(test_db, data_dir)
        params["settings"]["reference_date"] = ""
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_error(self, env):
        """reference_date空はhensu_150でValueError → jobs.status="error" """
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "error"


class TestIF001DT501OthersGpkg:
    """N11: DT501 data_type="others" × input_file_type="gpkg"

    spec期待値 (E016.py L838-841):
    - data_type != "plateau" の else 分岐では buildingID 列不要
    - `building_id = gdf.index + 1` を自動付与し astype(str) する
    - 対比: data_type="plateau" で buildingID 欠損 → ERROR_00030 発火 (L831-837)

    本クラスは「others 分岐が実際に発火したこと」を以下の2点で実証する:
    1. buildingID 列が無い fixture で job が complete する (plateau 経路なら ERROR_00030)
    2. ERROR_00030 が job_tasks に記録されていない (分岐選択の直接検証)
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        """N2 (TestIF001SpatialJoinFull) と平行するデータ構成で data_type のみ差し替える。

        matrix 行定義: DT107=○, DT213=○, DT501=others/gpkg, joining=inter, ref_date=有。
        N2 (plateau/gpkg) との唯一の差分は building_polygon の data_type と fixture 内容。
        """
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg_others(data_dir)
        _create_touki_csv(data_dir)
        _create_census_gpkg(data_dir)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings_others.gpkg",
            "input_file_type": "geopackage",
            "data_type": "others",
        }
        params["data"]["building_registry"] = {
            "path": "touki.csv",
            "columns": {
                "address": "住所",
                "structure_name": "構造",
                "registration_reason": "登記事由",
                "registration_date": "登記日付",
            },
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: data_type="others" では buildingID 不要で正常完了する (E016 L838-841)

        plateau 経路 (L831-837) なら同じ fixture (buildingID 欠損) で KeyError → ERROR_00030
        になるため、complete 到達自体が else 分岐選択の間接証拠になる。
        """
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete"

    def test_no_error_00030_recorded(self, env):
        """spec: others 分岐 (L838-841) 選択の直接検証

        plateau 分岐 (L831-837) が選ばれた場合は buildingID 欠損により
        ERROR_00030 ("IF001_e016_err_building_id") が job_tasks に記録される。
        others 分岐では buildingID 参照自体が発生しないため記録されない。
        """
        from constants import ERROR_00030
        _run_if001(env["params"])
        tasks = _get_job_tasks(env["test_db"])
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_00030["code"]]
        recorded_codes = [t["error_code"] for t in tasks if t["error_code"]]
        assert len(error_tasks) == 0, (
            f"data_type=others なのに ERROR_00030 が記録された。"
            f"plateau 分岐が誤って選択された可能性。記録された error_code: {recorded_codes}"
        )

    def test_building_id_is_assigned(self, env):
        """spec: others 経路でも building_id カラムが付与される (L839-840: index+1 由来)"""
        _run_if001(env["params"])
        df = _read_output_csv(env["test_db"], env["data_dir"])
        bid_col = TRANSLATE_COLUMNS_IF001.get("building_id", "building_id")
        assert bid_col in df.columns, "building_idカラムが出力CSVにない"
        assert df[bid_col].notna().any(), "building_idが全てNaN (空間結合未発火の可能性)"


# ============================================================
# 異常系
# ============================================================


class TestIF001EntrypointValidation:
    """IF001のmain()で入力データが不正な場合のテスト

    spec: エラーハンドリング — ジョブステータス管理
    - 例外発生時: jobs.status = "error"
    - ERROR_00051: 水道データ未指定
    """

    def test_no_input_files_records_error(self, test_db, tmp_path):
        """spec: 水道データ未指定でERROR_00051がjob_tasksに記録される"""
        output_path = str(tmp_path / "output")
        os.makedirs(output_path, exist_ok=True)

        params = {
            "database_path": test_db,
            "job_id": None,
            "output_path": output_path,
            "data": {},
            "settings": {"municipality": "テスト市"},
        }
        test_args = ["IF001.py", "--parameters", json.dumps(params)]

        with patch("sys.argv", test_args):
            import IF001
            importlib.reload(IF001)
            IF001.main()

        tasks = _get_job_tasks(test_db)
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_00051["code"]]
        assert len(error_tasks) == 1
        assert error_tasks[0]["preprocess_type"] is None
        assert error_tasks[0]["error_msg"] == ERROR_00051["message"]

    def test_empty_path_from_fe_records_error(self, test_db, tmp_path):
        """spec: FEがpath=""で送信した場合もERROR_00051がjob_tasksに記録される"""
        output_path = str(tmp_path / "output")
        os.makedirs(output_path, exist_ok=True)

        params = {
            "database_path": test_db,
            "job_id": None,
            "output_path": output_path,
            "data": {
                "water_status": {"id": 0, "path": "", "columns": {"water_supply_number": "", "address": "", "water_connection_date": "", "water_disconnection_date": ""}},
                "water_usage": {"id": 0, "path": "", "columns": {"water_supply_number": "", "water_usage": "", "water_recorded_date": ""}},
                "resident_registry": {"id": 0, "path": "", "columns": {"household_code": "", "address": "", "birth_date": "", "resident_date": "", "reason_transfer": "", "date_transfer": ""}},
                "census": {"id": 0, "path": ""},
            },
            "settings": {"reference_date": "2021-01-01", "municipality": "テスト市", "advanced": {"joining_method": "intersection"}},
        }
        test_args = ["IF001.py", "--parameters", json.dumps(params)]

        with patch("sys.argv", test_args):
            import IF001
            importlib.reload(IF001)
            IF001.main()

        tasks = _get_job_tasks(test_db)
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_00051["code"]]
        assert len(error_tasks) == 1
        assert error_tasks[0]["error_msg"] == ERROR_00051["message"]


class TestIF001DT119FileTypeMismatch:
    """E3/E4: DT119のファイル形式不整合

    spec (Step 9):
    - ファイル拡張子が.csvでないのにinput_file_type=="csv" → ERROR_00007
    - ファイル拡張子が.csvなのにinput_file_type!="csv" → ERROR_00048
    """

    def _build_params_with_dt119(self, test_db, data_dir, dt119_filename, input_file_type):
        """DT119を含むパラメータを構築（E016到達前にe015で検証されるため最小構成で十分）"""
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg(data_dir)
        _create_census_gpkg(data_dir)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",
        }
        params["data"]["building_type_determination"] = {
            "path": dt119_filename,
            "input_file_type": input_file_type,
            "columns": {"address": "地番住所", "building_type": "建物種別"},
            "residential_values": ["住宅"],
        }
        return params

    def test_gpkg_file_with_csv_type_records_error_00007(self, test_db, tmp_path):
        """spec: 拡張子≠.csvなのにinput_file_type="csv" → ERROR_00007"""
        from constants import ERROR_00007

        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_dt119_gpkg(data_dir)
        params = self._build_params_with_dt119(test_db, data_dir, "dt119.gpkg", "csv")

        _run_if001(params)

        tasks = _get_job_tasks(test_db)
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_00007["code"]]
        assert len(error_tasks) >= 1, (
            f"ERROR_00007が記録されていない。tasks: {[t['error_code'] for t in tasks if t['error_code']]}"
        )

    def test_csv_file_with_gpkg_type_records_error_00048(self, test_db, tmp_path):
        """spec: 拡張子=.csvなのにinput_file_type≠"csv" → ERROR_00048"""
        from constants import ERROR_00048

        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_dt119_csv(data_dir)
        params = self._build_params_with_dt119(test_db, data_dir, "dt119.csv", "geopackage")

        _run_if001(params)

        tasks = _get_job_tasks(test_db)
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_00048["code"]]
        assert len(error_tasks) >= 1, (
            f"ERROR_00048が記録されていない。tasks: {[t['error_code'] for t in tasks if t['error_code']]}"
        )


class TestIF001MunicipalityMissing:
    """E5: municipality未指定

    コード事実 (IF001.py L137-139):
    - municipalityが未指定(falsy)の場合、ValueErrorを送出
    - UIでは必須フィールドだが、FEバリデーションをすり抜けた場合のエラーパス
    """

    def test_municipality_missing_causes_error(self, test_db, tmp_path):
        """municipality未指定でjobs.status="error" """
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_census_dummy(data_dir)

        params = _base_params(test_db, data_dir)
        del params["settings"]["municipality"]

        _run_if001(params)

        jobs = _get_jobs(test_db)
        assert jobs[0]["status"] == "error"


class TestIF001DT501PlateauBuildingIdMissing:
    """E6: DT501 data_type="plateau" の gpkg に buildingID 列が無い

    spec 期待値 (E016.py:831-837):
    - plateau 分岐で `gdf["buildingID"]` を参照するため、列欠損時は KeyError
    - except で `set_error(ERROR_00030)` が呼ばれ `job_tasks` に記録される
    - その後 `raise Exception(e)` で再送出され `jobs.status="error"` になる

    対になる正常系: N11 (`TestIF001DT501OthersGpkg`)
    - 同じ「buildingID 欠損 gpkg」でも data_type="others" では ERROR_00030 が発生せず
      `gdf.index + 1` で building_id が自動付与される (E016.py:838-841)
    - N11 の test_no_error_00030_recorded と本クラスの test_error_00030_is_recorded で
      E016.py の plateau/others 分岐の両側を担保する

    根拠コード:
    - ml/src/E001_DataMatching/E016.py:831-837 (plateau 分岐 try/except)
    - ml/async_tasks/IF001.py:167-168, 490-491 (data_type の params 経路)
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv(data_dir)
        _create_building_polygon_gpkg_plateau_no_buildingid(data_dir)
        _create_census_gpkg(data_dir)

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings_plateau_no_buildingid.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",  # N11 の "others" との唯一差分
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_error_00030_is_recorded(self, env):
        """spec: plateau + buildingID 欠損で ERROR_00030 が job_tasks に記録される

        plateau 分岐選択の直接証拠。others 分岐 (N11) ではこのエラーは発火しない。
        """
        from constants import ERROR_00030
        _run_if001(env["params"])
        tasks = _get_job_tasks(env["test_db"])
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_00030["code"]]
        recorded_codes = [t["error_code"] for t in tasks if t["error_code"]]
        assert len(error_tasks) >= 1, (
            f"ERROR_00030 が記録されていない。plateau 分岐 (E016.py:831-837) の "
            f"try/except が発火しなかった可能性。記録された error_code: {recorded_codes}"
        )

    def test_job_status_is_error(self, env):
        """spec: ERROR_00030 set_error 後に再送出されるため jobs.status=error"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "error"


class TestIF001GeocodingMissingLatLng:
    """E7: geocoding CSV に lat/lng 列が存在しない

    spec 期待値 (実機 repro で発火経路確定済み):
    - IF001.main の geocoding 処理 (`rename_map` ブロック) は pandas rename の仕様で
      missing keys を silently ignore するため、lat/lng 列不在でも例外を送出しない
    - 続く列フィルタ (`geo_df[[c for c in geo_keep if c in geo_df.columns]]`) が
      latitude/longitude 列を silent に drop し、main df への merge 後も中間 CSV
      (`matched_data_with_new_columns.csv`) に `*_geocoding_cleaned` 列が残らない
    - この中間 CSV が `E016.process_data` 内の E014 出力再読込
      (`load_and_process_data(file_type="csv")`) で処理されるとき、
      `latitude_geocoding_cleaned in df.columns` が false、さらに
      `columns.get("lat")` フォールバックも false (IF001 は `geocoding_latitude` キー
      で送るため "lat" キーは構造的に存在しない) となり、else 分岐で
      `set_error(ERROR_00024)` + `raise KeyError` に到達する
    - 結果: `job_tasks` に `error_code="IF001_e016_err_geometry"` /
      `preprocess_type="e016"` が記録され、KeyError 再送出で `jobs.status="error"`

    対になる正常系:
    - N2 (TestIF001SpatialJoinFull) / N4 (TestIF001DT213Only) が lat/lng 列を持つ
      `_create_geocoding_csv` で同一経路を通過し正常完了するため、本行は E016
      カラムチェックの失敗境界を担う

    根拠コード (シンボル名、grep で再同定可):
    - `IF001.main` の geocoding 処理 (Step 4.5 コメント付近、`rename_map` 組立)
    - `IF001.main` の `if has_geocoding:` ブロック (E016 呼出のガード)
    - `E016.process_data` の E014 出力読込 (`e14_merged` 代入)
    - `E016.load_and_process_data` の CSV 分岐末尾 (geometry/lat/lon 列チェックの
      else 分岐が `ERROR_00024` を発火)
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_geocoding_csv_missing_latlng(data_dir)
        # E014 出力読込時点で ERROR_00024 が発火するため census は
        # load_and_process_data まで到達しない → dummy zip で十分
        _create_census_dummy(data_dir)

        params = _base_params(test_db, data_dir)
        params["data"]["geocoding"] = {
            "path": "geocoding_missing_latlng.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_error_00024_is_recorded(self, env):
        """spec: E016 カラムチェックで lat/lng 不在を検出し ERROR_00024 を記録する

        `E016.load_and_process_data` CSV 分岐末尾の else 分岐 (geometry/lat/lon
        いずれも不在) の直接発火証拠。preprocess_type="e016" は E016.process_data
        開始直後の task 初期化経由で付与される。

        併せて、E016 到達前の別エラー (例: ERROR_00051 入力欠損, ERROR_00007/00048
        DT119 file_type 不整合) が混入していないことを negative assert で担保する。
        """
        from constants import ERROR_00024
        _run_if001(env["params"])
        tasks = _get_job_tasks(env["test_db"])
        recorded_codes = [t["error_code"] for t in tasks if t["error_code"]]
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_00024["code"]]

        assert len(error_tasks) >= 1, (
            f"ERROR_00024 が記録されていない。`E016.load_and_process_data` CSV 分岐の "
            f"geometry/lat/lon 列チェック else 分岐が発火しなかった可能性。"
            f"記録された error_code: {recorded_codes}"
        )
        assert error_tasks[0]["preprocess_type"] == "e016"

        # 発火「箇所」の主張: E016 到達前の別エラーが先に記録されていないこと
        # これが外れると「E016 手前で別件エラーが先着して test が偶然 pass」の
        # 回帰を検知できなくなる
        upstream_errors = [c for c in recorded_codes if c != ERROR_00024["code"]]
        assert upstream_errors == [], (
            f"E016 到達前に別のエラーが記録されている: {upstream_errors}。"
            f"E7 の発火経路 (E016 カラムチェック) に到達する前に別の検証が "
            f"先着している可能性がある"
        )

    def test_job_status_is_error(self, env):
        """spec: ERROR_00024 set_error 後 KeyError 再送出で jobs.status=error"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "error"


# ============================================================
# 既知バグ検出テスト
# ============================================================


class TestIF001GeocodingZeroMatch:
    """#1701: ジオコーディングのマッチ率が0%の場合にE016がクラッシュしないこと

    バグ: E016.assign_points_to_buildingsで、ジオコーディング住所が
    水道データの正規化住所と1件もマッチしない場合にKeyError。
    原因: right_geometryカラム不在、index_right不在、カラム重複。

    テスト: 水道データと全く異なる住所のジオコーディングCSVを用意し、
    パイプラインがクラッシュせずcompleteするか検証。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_base_data(data_dir)
        _create_census_gpkg(data_dir)
        _create_building_polygon_gpkg(data_dir)

        # 水道データと全く異なる住所のジオコーディングCSV → マッチ率0%
        _write_csv(os.path.join(data_dir, "geocoding_nomatch.csv"), pd.DataFrame({
            "住所": ["存在しない市AAAA", "存在しない市BBBB", "存在しない市CCCC"],
            "緯度": [35.68, 35.69, 35.70],
            "経度": [139.76, 139.77, 139.78],
        }))

        params = _base_params(test_db, data_dir)
        params["data"]["census"] = {"path": "census.gpkg"}
        params["data"]["geocoding"] = {
            "path": "geocoding_nomatch.csv",
            "columns": {"address": "住所", "latitude": "緯度", "longitude": "経度"},
        }
        params["data"]["building_polygon"] = {
            "path": "buildings.gpkg",
            "input_file_type": "geopackage",
            "data_type": "plateau",
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_completes_without_crash(self, env):
        """#1701: ジオコーディング0%マッチでもパイプラインがcompleteする（修正済み確認）"""
        _run_if001(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete", (
            f"ジオコーディング0%マッチでクラッシュ。status={jobs[0]['status']}"
        )
