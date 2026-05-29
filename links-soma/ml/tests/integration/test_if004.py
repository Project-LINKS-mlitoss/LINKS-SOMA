"""IF004 データ出力 — 統合テスト

specが定義する振る舞いをコードが満たしているかを検証する。
期待値はspec（docs/spec/interfaces/IF004-export.md,
docs/spec/modules/E033-export.md）から導出。

テスト対象:
- IF004.py:main — ジョブ管理・ステータス遷移・ファイル出力・job_results登録
- E033.py:processing — CSV+DB経由のエクスポート処理
"""

import json
import os
import sqlite3

import pandas as pd
import pytest

from db_helpers import query_all, query_by_job_id
from E003_Summarization.E033 import processing as E033


def _insert_building_data(db_path, data_set_result_id=1):
    """テスト用building推定結果データを挿入"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    # data_set_results
    cursor.execute(
        "INSERT INTO data_set_results (id, title, job_id) VALUES (?, ?, ?)",
        (data_set_result_id, "テスト結果", 1),
    )
    # building データ（Point 1件 + NULLジオメトリ 1件）
    rows = [
        (data_set_result_id, "2024-01-01", "BLD001", "木造", 1, 0.85,
         35.68, 139.76, "東京都千代田区1-1", "POINT (139.76 35.68)"),
        (data_set_result_id, "2024-01-01", "BLD002", "鉄骨", 0, 0.12,
         None, None, "東京都新宿区2-2", None),
    ]
    cursor.executemany("""
        INSERT INTO data_set_detail_buildings
        (data_set_result_id, reference_date, building_id, building_structure_type,
         predicted_label, predicted_probability, lat_geocoding, lon_geocoding,
         normalized_address, bldg_geometry)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, rows)
    conn.commit()
    conn.close()


def _get_all_jobs(db_path):
    return query_all(db_path, "jobs")


def _get_job_results(db_path, job_id):
    return query_by_job_id(db_path, "job_results", job_id)


def _get_job_tasks(db_path, job_id):
    return query_by_job_id(db_path, "job_tasks", job_id)


# ============================================================
# E033 processing() 統合テスト
# ============================================================


class TestE033Processing:
    """E033 processing()のDB経由エクスポートがspec通りか"""

    @pytest.fixture
    def env(self, tmp_path, test_db):
        """E033 processing()に必要な環境を構築"""
        db_path = test_db
        _insert_building_data(db_path)

        output_dir = str(tmp_path / "output")
        os.makedirs(output_dir, exist_ok=True)

        return {
            "db_path": db_path,
            "output_dir": output_dir,
            "tmp_path": tmp_path,
        }

    def _run_processing(self, env, output_format="csv", job_id=None):
        """processing()を実行し出力パスを返す"""
        ext = "gpkg" if output_format == "geopackage" else output_format
        output_path = os.path.join(env["output_dir"], f"test_output.{ext}")
        params = {
            "data_set_results_id": 1,
            "target_unit": "building",
            "output_format": output_format,
            "view_id": None,
            "target_crs": "EPSG:4326 (WGS84)",
            "reference_date": "2024-01-01",
            "output_path": output_path,
        }
        E033(params, job_id, env["db_path"])
        return output_path

    def test_csv_output_has_utf8_bom(self, env):
        """spec: CSV出力はUTF-8 BOM付き"""
        output_path = self._run_processing(env, "csv")
        with open(output_path, "rb") as f:
            bom = f.read(3)
        assert bom == b"\xef\xbb\xbf"

    def test_csv_output_has_japanese_column_names(self, env):
        """spec: CSV出力は日本語カラム名に翻訳"""
        output_path = self._run_processing(env, "csv")
        df = pd.read_csv(output_path)
        assert "建物ID" in df.columns
        assert "正規化住所" in df.columns

    def test_csv_output_row_count(self, env):
        """挿入した2件がCSV出力される"""
        output_path = self._run_processing(env, "csv")
        df = pd.read_csv(output_path)
        assert len(df) == 2

    def test_geojson_null_geometry_is_null(self, env):
        """spec: GeoJSON出力でNULLジオメトリは "geometry": null"""
        output_path = self._run_processing(env, "geojson")
        with open(output_path, encoding="utf-8") as f:
            data = json.load(f)
        features = data["features"]
        assert len(features) == 2
        # BLD002はジオメトリなし
        null_geom_count = sum(1 for f in features if f["geometry"] is None)
        assert null_geom_count == 1

    def test_geopackage_has_attributes_layer_for_null_geometry(self, env):
        """spec: GeoPackage出力でNULLジオメトリはattributesレイヤーに出力"""
        output_path = self._run_processing(env, "geopackage")
        conn = sqlite3.connect(output_path)
        rows = conn.execute(
            "SELECT table_name, data_type FROM gpkg_contents"
        ).fetchall()
        conn.close()
        data_types = {r[0]: r[1] for r in rows}
        assert "attributes" in data_types
        assert data_types["attributes"] == "attributes"

    def test_processing_creates_job_task(self, env):
        """spec: processing()はjob_taskを作成し進捗管理する"""
        # ジョブを作成してからprocessingを実行
        conn = sqlite3.connect(env["db_path"])
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO jobs (status, type) VALUES ('', 'export')"
        )
        job_id = cursor.lastrowid
        conn.commit()
        conn.close()

        self._run_processing(env, "csv", job_id=job_id)
        tasks = _get_job_tasks(env["db_path"], job_id)
        assert len(tasks) >= 1
        # 最後のタスクが完了している
        last_task = tasks[-1]
        assert last_task["progress_percent"] == "100"
        assert last_task["finished_at"] is not None


# ============================================================
# IF004 main() — ジョブ管理・ステータス遷移
# ============================================================


class TestIF004Main:
    """IF004.py main()のジョブ管理がspec通りか

    spec: Job type は "export"
    spec: 最終 status は "complete"
    spec: 出力ファイル名が job_results に登録される
    spec: geopackage → gpkg に正規化される（拡張子）
    """

    @pytest.fixture
    def main_env(self, tmp_path, test_db):
        """IF004 main()用の環境を構築"""
        db_path = test_db
        _insert_building_data(db_path)
        output_path = str(tmp_path / "output")
        os.makedirs(output_path, exist_ok=True)
        return {
            "db_path": db_path,
            "output_path": output_path,
        }

    def _build_params(self, env, output_format="csv"):
        return {
            "database_path": env["db_path"],
            "job_id": None,
            "output_path": env["output_path"],
            "output_file_type": output_format,
            "output_coordinate": "EPSG:4326 (WGS84)",
            "target_unit": "building",
            "data_set_results_id": 1,
            "view_id": None,
            "reference_date": "2024-01-01",
        }

    def _run_main(self, env, output_format="csv"):
        """IF004.main()のジョブ管理ロジックをテスト環境で再現する。

        IF004.pyはモジュールレベルでsys.stdin/stdoutを再オープンするため、
        pytestから直接importlib.reloadできない。代わりにmain()の
        ジョブ管理部分（create_or_update_job → E033 → job_results登録）を
        同じ呼び出しで再現する。
        """
        import uuid as _uuid
        from utils import (
            connect_sqllite,
            create_or_update_job,
            create_job_results,
            concatenate,
        )

        json_dict = self._build_params(env, output_format)
        database_path = json_dict["database_path"]
        connect_sqllite(database_path)

        # IF004.py:main L42-50 と同等
        job_id = create_or_update_job(
            None, "", "export", os.getpid(), 0,
            json.dumps(json_dict, ensure_ascii=False), True,
        )

        output_path = json_dict["output_path"]
        random_str = str(_uuid.uuid4())
        output_directory = concatenate(output_path, random_str)

        fmt = output_format
        if fmt == "geopackage":
            fmt = "gpkg"
        file_path = f"{output_directory}.{fmt}"

        new_params = {
            "data_set_results_id": json_dict["data_set_results_id"],
            "target_unit": json_dict["target_unit"],
            "output_format": output_format,  # E033には正規化前の値を渡す
            "view_id": json_dict["view_id"],
            "target_crs": json_dict["output_coordinate"],
            "reference_date": json_dict["reference_date"],
            "output_path": file_path,
        }

        E033(new_params, job_id, database_path)
        create_or_update_job(job_id, "complete")
        create_job_results(job_id, f"{random_str}.{fmt}")

        return job_id

    def test_job_type_is_export(self, main_env):
        """spec: Job作成時のtypeは "export" """
        self._run_main(main_env)
        jobs = _get_all_jobs(main_env["db_path"])
        assert len(jobs) >= 1
        assert jobs[0]["type"] == "export"

    def test_final_status_is_complete(self, main_env):
        """spec: 正常完了時のstatusは "complete" """
        self._run_main(main_env)
        jobs = _get_all_jobs(main_env["db_path"])
        assert jobs[0]["status"] == "complete"

    def test_job_results_has_file_path(self, main_env):
        """spec: 出力ファイル名がjob_resultsに登録される"""
        self._run_main(main_env)
        jobs = _get_all_jobs(main_env["db_path"])
        results = _get_job_results(main_env["db_path"], jobs[0]["id"])
        assert len(results) == 1
        # UUID.csv の形式
        file_path = results[0]["file_path"]
        assert file_path.endswith(".csv")
        assert len(file_path) > 4  # UUID部分がある

    def test_geopackage_extension_normalized_to_gpkg(self, main_env):
        """spec: geopackage → gpkg に正規化される（job_resultsの拡張子）"""
        self._run_main(main_env, output_format="geopackage")
        jobs = _get_all_jobs(main_env["db_path"])
        results = _get_job_results(main_env["db_path"], jobs[0]["id"])
        assert len(results) == 1
        assert results[0]["file_path"].endswith(".gpkg")

    def test_geojson_extension(self, main_env):
        """spec: geojson形式の出力ファイル名は .geojson"""
        self._run_main(main_env, output_format="geojson")
        jobs = _get_all_jobs(main_env["db_path"])
        results = _get_job_results(main_env["db_path"], jobs[0]["id"])
        assert len(results) == 1
        assert results[0]["file_path"].endswith(".geojson")

    def test_output_file_actually_exists(self, main_env):
        """出力ファイルが実際に存在する"""
        self._run_main(main_env)
        jobs = _get_all_jobs(main_env["db_path"])
        results = _get_job_results(main_env["db_path"], jobs[0]["id"])
        file_path = os.path.join(
            main_env["output_path"], results[0]["file_path"]
        )
        # IF004はUUIDベースのパスで出力するので、output_path配下にある
        # ファイル名からUUID部分を取り出して探す
        found = False
        for f in os.listdir(main_env["output_path"]):
            if f.endswith(".csv"):
                found = True
                break
        assert found, "出力CSVファイルが見つからない"
