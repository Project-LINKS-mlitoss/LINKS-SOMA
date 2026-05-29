"""IF003 空き家推定 — 統合テスト

データセット・モデル組み合わせごとの正常系・異常系を検証する。

期待値の根拠:
- docs/spec/interfaces/IF003-estimation.md
- docs/spec/modules/E022-classification.md
- docs/spec/modules/E032-summarization.md

注意: IF003はモジュールレベルでsys.stdin.fileno()を呼ぶため、
pytestのキャプチャと衝突する。サブプロセスで実行して検証する。
"""

import json
import os
import subprocess
import sys
import zipfile

import geopandas as gpd
import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
import pytest
from shapely.geometry import Polygon

from db_helpers import query_all
from constants import ERROR_20018


# ============================================================
# ヘルパー
# ============================================================


def _get_jobs(db_path):
    return query_all(db_path, "jobs")


def _get_job_tasks(db_path):
    return query_all(db_path, "job_tasks")


def _get_job_results(db_path):
    return query_all(db_path, "job_results")


def _get_buildings(db_path):
    return query_all(db_path, "data_set_detail_buildings")


def _get_areas(db_path):
    return query_all(db_path, "data_set_detail_areas")


def _ml_root():
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _run_if003(params):
    """IF003.main()をサブプロセスで実行"""
    params_json = json.dumps(params)
    ml_root = _ml_root()
    script = (
        "import sys\n"
        f"sys.argv = ['IF003.py', '--parameters', {repr(params_json)}]\n"
        "import IF003\n"
        "IF003.main()\n"
    )
    result = subprocess.run(
        [sys.executable, "-c", script],
        cwd=ml_root,
        env={
            **os.environ,
            "PYTHONPATH": os.pathsep.join([
                os.path.join(ml_root, "src"),
                os.path.join(ml_root, "src", "E001_DataMatching"),
                os.path.join(ml_root, "src", "E002_Classification"),
                os.path.join(ml_root, "src", "E003_Summarization"),
                os.path.join(ml_root, "async_tasks"),
            ]),
        },
        capture_output=True,
        text=True,
        timeout=120,
    )
    return result


def _create_model_zip(data_dir, feat_cols=None):
    """テスト用モデルZIPを生成（軽量LightGBMモデル1bag）

    E021出力と同じ構造のmodel.pklを含むZIPを作成する。
    """
    if feat_cols is None:
        feat_cols = ["avg_water_usage", "water_disconnection_flag"]

    rng = np.random.RandomState(42)
    n = 100
    X = rng.uniform(0, 10, (n, len(feat_cols)))
    y = rng.choice([0, 1], n, p=[0.9, 0.1])

    # 軽量モデル（1bag、少ないイテレーション）
    m = lgb.LGBMClassifier(
        n_estimators=5, num_leaves=4, max_depth=2,
        random_state=42, verbose=-1,
    )
    m.fit(X, y)

    artifact = {
        "models": [m],
        "feat_cols": feat_cols,
        "medians": {c: float(np.median(X[:, i])) for i, c in enumerate(feat_cols)},
        "ysc_cap": 15.0,
        "method": "M6_prior_rebal",
        "target_prior": 0.02,
        "n_bags": 1,
        "lgb_params": {},
        "recall_target": 0.65,
        "threshold": 0.3,
    }

    model_dir = os.path.join(data_dir, "_model_tmp")
    os.makedirs(model_dir, exist_ok=True)
    model_path = os.path.join(model_dir, "model.pkl")
    joblib.dump(artifact, model_path)

    metrics = {
        "metrics": {"threshold": "0.3", "candidateCount": "10"},
        "feature_importance": [],
        "training_info": {"features": feat_cols},
    }
    metrics_path = os.path.join(model_dir, "metrics.json")
    with open(metrics_path, "w") as f:
        json.dump(metrics, f)

    zip_name = "model.zip"
    zip_path = os.path.join(data_dir, zip_name)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(model_path, "model.pkl")
        zf.write(metrics_path, "metrics.json")

    return zip_name


def _create_normalized_csv(data_dir, name="normalized.csv", n=50):
    """IF001出力相当のCSVを生成（E022が読み込む形式）

    日本語カラム名 + 水道番号 + 特徴量 + geometry(WKT)。
    E032がgeometryカラムを使って空間結合するため必須。
    """
    rng = np.random.RandomState(42)
    lats = rng.uniform(35.5, 35.9, n)
    lons = rng.uniform(139.5, 139.9, n)
    data = {
        "水道番号": [f"W{i:04d}" for i in range(n)],
        "水道栓住所": [f"テスト市{i}丁目" for i in range(n)],
        "正規化住所": [f"テスト市{i}丁目" for i in range(n)],
        "avg_water_usage": rng.uniform(0, 50, n),
        "water_disconnection_flag": rng.choice([0, 1], n, p=[0.7, 0.3]),
        "geometry": [f"POINT ({lon} {lat})" for lat, lon in zip(lats, lons)],
        # E032が集計に使用するカラム
        "世帯人数": rng.choice([1, 2, 3, 4], n),
        "15歳未満人数": rng.choice([0, 1, 2], n),
        "65歳以上人数": rng.choice([0, 1, 2], n),
    }
    df = pd.DataFrame(data)
    csv_path = os.path.join(data_dir, name)
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    return name


def _create_census_gpkg(data_dir):
    """area_grouping用の国勢調査GeoPackage"""
    gdf = gpd.GeoDataFrame({
        "KEY_CODE": ["001"],
        "S_NAME": ["テスト町丁字"],
        "AREA": [1000.0],
    }, geometry=[
        Polygon([(139.0, 35.0), (140.0, 35.0), (140.0, 36.0), (139.0, 36.0)])
    ], crs="EPSG:4326")
    path = os.path.join(data_dir, "census.gpkg")
    gdf.to_file(path, driver="GPKG")
    return "census.gpkg"


# ============================================================
# 正常系
# ============================================================


class TestIF003BasicEstimation:
    """P1: 基本推定（1データセット、KEY_CODEベースのarea_grouping）

    spec期待値:
    - ジョブステータスが "complete" になる
    - data_set_detail_buildingsにレコードが登録される
    - predicted_probabilityが0〜1の範囲

    コード事実: IF003はarea_groupingの有無にかかわらずE032を実行する。
    area_grouping未指定でもspatial_fileパスが生成されE032に渡される。
    E032はファイル拡張子で処理を分岐するため、有効なファイルが必須。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        model_zip = _create_model_zip(data_dir)
        csv_name = _create_normalized_csv(data_dir)
        census = _create_census_gpkg(data_dir)
        params = {
            "database_path": test_db,
            "job_id": None,
            "output_path": data_dir,
            "model_path": model_zip,
            "normalized_dataset_paths": [csv_name],
            "area_grouping": {
                "path": census,
                "columns": {"area_group_id": "KEY_CODE", "area_group_name": "S_NAME"},
            },
            "settings": {},
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: 推定完了時のstatusは "complete" """
        result = _run_if003(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert len(jobs) >= 1, f"jobsが空。stderr: {result.stderr[-500:]}"
        assert jobs[0]["status"] == "complete", f"status={jobs[0]['status']}. stderr: {result.stderr[-500:]}"

    def test_buildings_recorded_in_db(self, env):
        """spec: data_set_detail_buildingsにレコードが登録される"""
        _run_if003(env["params"])
        buildings = _get_buildings(env["test_db"])
        assert len(buildings) > 0, "data_set_detail_buildingsが空"

    def test_predicted_probability_range(self, env):
        """spec: predicted_probabilityは0〜1の範囲"""
        _run_if003(env["params"])
        buildings = _get_buildings(env["test_db"])
        probabilities = [b["predicted_probability"] for b in buildings if b["predicted_probability"] is not None]
        assert len(probabilities) > 0
        assert all(0 <= p <= 1 for p in probabilities), "predicted_probabilityが0〜1の範囲外"


class TestIF003MultipleDatasets:
    """P2: 複数データセット

    spec期待値:
    - normalized_dataset_pathsに2件指定しても正常完了
    - 2件分のbuildingsがDBに記録される
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        model_zip = _create_model_zip(data_dir)
        csv1 = _create_normalized_csv(data_dir, name="normalized_1.csv", n=30)
        csv2 = _create_normalized_csv(data_dir, name="normalized_2.csv", n=20)
        census = _create_census_gpkg(data_dir)
        params = {
            "database_path": test_db,
            "job_id": None,
            "output_path": data_dir,
            "model_path": model_zip,
            "normalized_dataset_paths": [csv1, csv2],
            "area_grouping": {
                "path": census,
                "columns": {"area_group_id": "KEY_CODE", "area_group_name": "S_NAME"},
            },
            "settings": {},
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_completes_with_multiple_datasets(self, env):
        """spec: 複数データセットでも正常完了"""
        result = _run_if003(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete", f"stderr: {result.stderr[-500:]}"

    def test_buildings_from_both_datasets(self, env):
        """spec: 2件分のbuildingsがDBに記録される"""
        _run_if003(env["params"])
        buildings = _get_buildings(env["test_db"])
        # normalized_1.csv(30行) + normalized_2.csv(20行) = 50行
        assert len(buildings) == 50, f"buildings={len(buildings)}, expected=50"


class TestIF003WithAreaGrouping:
    """P3: area_groupingあり（カスタムカラム指定）

    spec期待値:
    - area_grouping + columns指定で正常完了
    - data_set_detail_areasにレコードが登録される

    P1との差分: P1はKEY_CODE/S_NAMEで集計、P3も同じだが
    テスト上の構造的差異はP1/P2と共通のためアサーション追加で検証。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        model_zip = _create_model_zip(data_dir)
        csv_name = _create_normalized_csv(data_dir)
        census = _create_census_gpkg(data_dir)
        params = {
            "database_path": test_db,
            "job_id": None,
            "output_path": data_dir,
            "model_path": model_zip,
            "normalized_dataset_paths": [csv_name],
            "area_grouping": {
                "path": census,
                "columns": {"area_group_id": "KEY_CODE", "area_group_name": "S_NAME"},
            },
            "settings": {},
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_completes_with_area_grouping(self, env):
        """spec: area_grouping指定で正常完了"""
        result = _run_if003(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete", f"stderr: {result.stderr[-500:]}"

    def test_areas_recorded_in_db(self, env):
        """spec: data_set_detail_areasにレコードが登録される"""
        _run_if003(env["params"])
        areas = _get_areas(env["test_db"])
        assert len(areas) > 0, "data_set_detail_areasが空"


# ============================================================
# 異常系
# ============================================================


class TestIF003EntrypointValidation:
    """IF003のmain()で入力データが不正な場合のテスト"""

    def test_no_normalized_dataset_records_error(self, test_db, tmp_path):
        """normalized_dataset_pathsが空の場合、ERROR_20018がjob_tasksに記録される"""
        output_path = str(tmp_path / "output")
        os.makedirs(output_path, exist_ok=True)

        params = {
            "database_path": test_db,
            "job_id": None,
            "output_path": output_path,
            "normalized_dataset_paths": [],
        }

        result = _run_if003(params)

        tasks = _get_job_tasks(test_db)
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_20018["code"]]
        assert len(error_tasks) == 1, (
            f"Expected 1 error task, got {len(error_tasks)}. "
            f"stderr: {result.stderr}"
        )
        assert error_tasks[0]["preprocess_type"] is None
        assert error_tasks[0]["error_msg"] == ERROR_20018["message"]
