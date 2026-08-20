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
from constants import ERROR_20001, ERROR_20002, ERROR_20003, ERROR_20018
from error_registry import RESPONSIBILITY_SELF_FIX


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


def _create_normalized_csv(data_dir, name="normalized.csv", n=50, with_geometry=True):
    """IF001出力相当のCSVを生成（E022が読み込む形式）

    日本語カラム名 + 水道番号 + 特徴量 + geometry(WKT)。
    E032がgeometryカラムを使って空間結合するため、地域集計には geometry が要る。

    with_geometry=False のとき geometry を空にし、ジオコーディングをskipした
    名寄せ出力（建物の空間位置が無い）を再現する。IF001 が geocoding skip 時に
    extend_columns で geometry_plateau=None を入れる挙動に対応する。
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
        # 空セルは pandas で NaN として読まれ、E032 で None geometry になる
        # （wkt.loads は呼ばれない）。空文字 "" だと pd.notna が True になり crash する
        "geometry": (
            [f"POINT ({lon} {lat})" for lat, lon in zip(lats, lons)]
            if with_geometry
            else [None] * n
        ),
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


def _create_normalized_csv_mixed(data_dir, name="normalized_mixed.csv"):
    """ポリゴン内/外を混在させた建物CSV（境界条件テスト用）

    _create_census_gpkg のポリゴンは lon 139〜140 / lat 35〜36。
    内側3件 (139.5〜139.7, 35.5〜35.7) / 外側2件 (138.0〜138.1, 34.0〜34.1)。
    外側はsjoin(inner)で集計から除外され、area_group=NULLのままになる。
    """
    points = [
        (139.5, 35.5), (139.6, 35.6), (139.7, 35.7),  # 内側
        (138.0, 34.0), (138.1, 34.1),                 # 外側
    ]
    n = len(points)
    rng = np.random.RandomState(7)
    data = {
        "水道番号": [f"W{i:04d}" for i in range(n)],
        "水道栓住所": [f"テスト市{i}丁目" for i in range(n)],
        "正規化住所": [f"テスト市{i}丁目" for i in range(n)],
        "avg_water_usage": rng.uniform(0, 50, n),
        "water_disconnection_flag": rng.choice([0, 1], n),
        "geometry": [f"POINT ({lon} {lat})" for lon, lat in points],
        "世帯人数": [2] * n,
        "15歳未満人数": [0] * n,
        "65歳以上人数": [1] * n,
    }
    df = pd.DataFrame(data)
    csv_path = os.path.join(data_dir, name)
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    return name


# ============================================================
# 正常系
# ============================================================


class TestIF003BasicEstimation:
    """P1: 基本推定（1データセット、KEY_CODEベースのarea_grouping）

    spec期待値:
    - ジョブステータスが "complete" になる
    - data_set_detail_buildingsにレコードが登録される
    - predicted_probabilityが0〜1の範囲

    コード事実: area_grouping.path が指定されているときのみ E032（地域集計）を実行する。
    未指定時はスキップする（IF003.py。area_grouping なしの挙動は TestIF003NoAreaGrouping）。
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


class TestIF003BuildingAreaGroup:
    """P1.5: 建物への area_group 付与（地域集計と同一 sjoin 由来）

    spec期待値（E032-summarization.md「空間結合」）:
    - 地域ポリゴン内に重心が入る建物は area_group / key_code が付与される
    - 建物単位の area_group は地域集計の定義（重心が属する地域）と一致する
      → count(buildings WHERE area_group=X) == 地域Xの total_building_count

    入力の根拠: _create_normalized_csv の建物点(lon 139.5〜139.9 / lat 35.5〜35.9)は
    すべて _create_census_gpkg のポリゴン(lon 139〜140 / lat 35〜36)内。
    よって全 50 件が area_group="テスト町丁字" / key_code="001" になる。
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

    def test_buildings_have_area_group(self, env):
        """ポリゴン内の建物に area_group / key_code が付与される"""
        _run_if003(env["params"])
        buildings = _get_buildings(env["test_db"])
        assert len(buildings) == 50
        assert all(b["area_group"] == "テスト町丁字" for b in buildings)
        assert all(b["key_code"] == "001" for b in buildings)

    def test_area_group_matches_area_aggregation(self, env):
        """建物 area_group 別件数が地域の total_building_count と一致する"""
        _run_if003(env["params"])
        buildings = _get_buildings(env["test_db"])
        areas = _get_areas(env["test_db"])

        building_counts = {}
        for b in buildings:
            ag = b["area_group"]
            if ag is not None:
                building_counts[ag] = building_counts.get(ag, 0) + 1

        # total_building_count はテストDBで動的追加(TEXT)のため int に正規化して比較
        area_totals = {a["area_group"]: int(a["total_building_count"]) for a in areas}

        assert building_counts, "建物に area_group が付与されていない"
        for area_group, total in area_totals.items():
            assert building_counts.get(area_group, 0) == total, (
                f"area_group={area_group}: 建物件数={building_counts.get(area_group, 0)} "
                f"!= 地域集計total_building_count={total}"
            )


class TestIF003BuildingAreaGroupBoundary:
    """P1.6: 建物 area_group 付与の境界条件（ポリゴン内/外）

    spec期待値（E032-summarization.md「空間結合」: how="inner"）:
    - 重心が地域ポリゴン内の建物 → area_group 付与
    - どの地域ポリゴンにも属さない建物 → area_group=NULL（集計からも除外）

    入力の根拠: _create_normalized_csv_mixed は内側3件/外側2件。
    内側のみ area_group="テスト町丁字"、外側2件は NULL。
    建物 area_group 件数(3) == 地域 total_building_count(3)。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        model_zip = _create_model_zip(data_dir)
        csv_name = _create_normalized_csv_mixed(data_dir)
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

    def test_outside_buildings_have_null_area_group(self, env):
        """ポリゴン外の建物は area_group=NULL のまま"""
        _run_if003(env["params"])
        buildings = _get_buildings(env["test_db"])
        assert len(buildings) == 5, "全建物がDBに登録される（外側も予測対象）"
        with_group = [b for b in buildings if b["area_group"] is not None]
        without_group = [b for b in buildings if b["area_group"] is None]
        assert len(with_group) == 3
        assert all(b["area_group"] == "テスト町丁字" for b in with_group)
        assert len(without_group) == 2

    def test_tagged_count_matches_area_total(self, env):
        """付与された建物件数が地域 total_building_count と一致する"""
        _run_if003(env["params"])
        buildings = _get_buildings(env["test_db"])
        areas = _get_areas(env["test_db"])
        tagged = sum(1 for b in buildings if b["area_group"] == "テスト町丁字")
        area_total = next(
            int(a["total_building_count"])
            for a in areas
            if a["area_group"] == "テスト町丁字"
        )
        assert tagged == area_total == 3


class TestIF003NoGeocoding:
    """P1.7: ジオコーディングなし（建物geometryなし）での地域集計の振る舞い

    検証する不変条件（E032-summarization.md「空間結合」how="inner" + NaN→0埋め）:
    - 建物 geometry が無いと spatial_join(inner) が空になり、建物 area_group は全 NULL
      → 建物単位の地域フィルター（selectAreaGroups unit=building）は空になる
    - 地域行は city_block(地域ポリゴン)への left merge で常に生成される（E032.py:482-484）
      → area_group ラベルは付くが total_building_count は 0（fillna 0, E032.py:315-325）
      → 地域単位ビューは「枠」は出るが集計値は空

    入力の根拠: ジオコーディングをskipした名寄せ出力は建物 geometry が NULL。
    _create_normalized_csv(with_geometry=False) で geometry 空の名寄せ出力を再現する。
    "ジオコーディング済データは地域単位集計ビューに必須か" の回答を固定するテスト。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        model_zip = _create_model_zip(data_dir)
        csv_name = _create_normalized_csv(data_dir, with_geometry=False)
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

    def test_job_completes(self, env):
        """ジオコーディングなしでも推定ジョブ自体は complete する"""
        result = _run_if003(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete", f"stderr: {result.stderr[-500:]}"

    def test_buildings_have_no_area_group(self, env):
        """建物 geometry なし → 全建物の area_group が NULL（建物単位フィルター空）"""
        _run_if003(env["params"])
        buildings = _get_buildings(env["test_db"])
        assert len(buildings) == 50, "全建物は予測対象として DB 登録される"
        assert all(b["area_group"] is None for b in buildings), (
            "geometry が無ければ spatial_join(inner) に乗らず area_group は付かない"
        )

    def test_area_rows_exist_but_counts_zero(self, env):
        """地域行は地域ポリゴンから生成されるが、建物が結合されず集計値は 0"""
        _run_if003(env["params"])
        areas = _get_areas(env["test_db"])
        assert len(areas) == 1, "city_block(1地域) への left merge で地域行は生成される"
        assert all(a["area_group"] is not None for a in areas), (
            "area_group ラベルは地域ポリゴン由来でジオコーディング非依存"
        )
        assert all(float(a["total_building_count"]) == 0 for a in areas), (
            "建物が1件も結合されないため集計値は 0"
        )


class TestIF003NoAreaGrouping:
    """P1.8: area_grouping 未指定（地域集計フォーム非表示）での推定

    検証する不変条件（IF003.py: area_grouping.path が falsy なら E032 スキップ）:
    - area_grouping.path が空でも推定ジョブは complete する
    - 建物単位の推定結果（data_set_detail_buildings）は通常どおり登録される
    - 地域集計（E032）は実行されず data_set_detail_areas は生成されない

    入力の根拠: ジオコーディングを使っていない名寄せデータでは UI が地域集計フォームを出さず
    area_grouping.path 空で送信する（issue #1924）。ジオコーディング無しでは空間結合(E016)が
    動かず建物 geometry も無いため、それを再現する with_geometry=False を使う。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        model_zip = _create_model_zip(data_dir)
        csv_name = _create_normalized_csv(data_dir, with_geometry=False)
        params = {
            "database_path": test_db,
            "job_id": None,
            "output_path": data_dir,
            "model_path": model_zip,
            "normalized_dataset_paths": [csv_name],
            # フォーム非表示時にフロントが送る空の area_grouping を再現
            "area_grouping": {"path": "", "columns": {}},
            "settings": {},
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_completes(self, env):
        """area_grouping 未指定でも推定ジョブは complete する"""
        result = _run_if003(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete", f"stderr: {result.stderr[-500:]}"

    def test_buildings_recorded(self, env):
        """建物単位の推定結果は通常どおり登録される"""
        _run_if003(env["params"])
        buildings = _get_buildings(env["test_db"])
        assert len(buildings) == 50, "地域集計をスキップしても建物推定は行われる"

    def test_no_area_rows_created(self, env):
        """E032 スキップにより地域行は生成されない"""
        _run_if003(env["params"])
        areas = _get_areas(env["test_db"])
        assert len(areas) == 0, (
            "area_grouping 未指定なら E032 は実行されず data_set_detail_areas は空"
        )


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


def _error_detail_of(task):
    """job_task の result(JSON文字列) から FR006 の error_detail を取り出す。無ければ None。"""
    raw = task.get("result")
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return None
    if isinstance(parsed, dict):
        return parsed.get("error_detail")
    return None


class TestIF003ReadCsvErrorEmission:
    """推定(IF003→E022)の入力読み込みエラー(R-052/053/054)が実処理で job_tasks まで届く検証。

    E022.read_csv は不正な normalized_dataset_path に対し set_error で error_code を立て、
    E022.main の except が job_tasks に記録する。各エラーが実処理で発火し、FR006 の
    error_detail（責任分界・次アクション）が相乗りすることを end-to-end で確認する。
    モデル・area_grouping は正常品を渡し、read_csv 段で確実に止める。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        model_zip = _create_model_zip(data_dir)
        census = _create_census_gpkg(data_dir)
        params = {
            "database_path": test_db,
            "job_id": None,
            "output_path": data_dir,
            "model_path": model_zip,
            "normalized_dataset_paths": [],  # 各テストで差し替え
            "area_grouping": {
                "path": census,
                "columns": {"area_group_id": "KEY_CODE", "area_group_name": "S_NAME"},
            },
            "settings": {},
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_import_path_not_found_records_E20003(self, env):
        """存在しない CSV パス → E-20003(入力ファイル不在)が記録され error_detail が載る。"""
        env["params"]["normalized_dataset_paths"] = ["nonexistent.csv"]

        result = _run_if003(env["params"])

        tasks = _get_job_tasks(env["test_db"])
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_20003["code"]]
        assert len(error_tasks) == 1, (
            f"E-20003が1件記録されるべき。codes={[t['error_code'] for t in tasks]} stderr={result.stderr[-500:]}"
        )
        detail = _error_detail_of(error_tasks[0])
        assert detail is not None, "error_detail が result に載っていない"
        assert detail["display_code"] == "E-20003"
        assert detail["responsibility"] == RESPONSIBILITY_SELF_FIX

    def test_non_csv_records_E20001(self, env):
        """CSV以外のファイル → E-20001(ファイル形式非対応)が記録される。"""
        bad_path = os.path.join(env["data_dir"], "bad.txt")
        with open(bad_path, "w", encoding="utf-8") as f:
            f.write("not a csv")
        env["params"]["normalized_dataset_paths"] = ["bad.txt"]

        result = _run_if003(env["params"])

        tasks = _get_job_tasks(env["test_db"])
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_20001["code"]]
        assert len(error_tasks) == 1, (
            f"E-20001が1件記録されるべき。codes={[t['error_code'] for t in tasks]} stderr={result.stderr[-500:]}"
        )
        detail = _error_detail_of(error_tasks[0])
        assert detail is not None
        assert detail["display_code"] == "E-20001"

    def test_undetectable_encoding_records_E20002(self, env):
        """空CSV(文字コード判別不能) → E-20002(文字コード判別不能)が記録される。

        detect_encoding が空ファイルで chardet → encoding None → ValueError を送出し、
        read_csv が E-20002 を立てる（R-053 の実処理経路）。
        """
        empty_path = os.path.join(env["data_dir"], "empty.csv")
        with open(empty_path, "w", encoding="utf-8") as f:
            f.write("")
        env["params"]["normalized_dataset_paths"] = ["empty.csv"]

        result = _run_if003(env["params"])

        tasks = _get_job_tasks(env["test_db"])
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_20002["code"]]
        assert len(error_tasks) == 1, (
            f"E-20002が1件記録されるべき。codes={[t['error_code'] for t in tasks]} stderr={result.stderr[-500:]}"
        )
        detail = _error_detail_of(error_tasks[0])
        assert detail is not None
        assert detail["display_code"] == "E-20002"


class TestIF003FeatureTypeMismatch:
    """FR004-007: 推定入力の説明変数に非数値 → 型不一致(E-201)を責任分界つきで記録しエラー停止。

    旧挙動は predict_akiya の .to_numpy(dtype=float) で不透明にクラッシュ。消費前に検出し、
    どの列が非数値かを示す attributed error（IF003_e022_err_feature_non_numeric）にする。
    モデルの説明変数 avg_water_usage の1セルを非数値にして実処理で発火させる。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        model_zip = _create_model_zip(data_dir)  # feat_cols=avg_water_usage,water_disconnection_flag
        csv_name = _create_normalized_csv(data_dir)
        # 説明変数 avg_water_usage の1セルを非数値に上書き（他は数値のまま完走可能な形）
        csv_path = os.path.join(data_dir, csv_name)
        df = pd.read_csv(csv_path)
        df["avg_water_usage"] = df["avg_water_usage"].astype(object)
        df.loc[2, "avg_water_usage"] = "不明"
        df.to_csv(csv_path, index=False, encoding="utf-8-sig")
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

    def test_job_status_is_error(self, env):
        result = _run_if003(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "error", (
            f"非数値の説明変数で停止すべき。status={jobs[0]['status']} stderr={result.stderr[-500:]}"
        )

    def test_attributed_error_task_recorded(self, env):
        result = _run_if003(env["params"])
        tasks = _get_job_tasks(env["test_db"])
        error_tasks = [
            t for t in tasks if t["error_code"] == "IF003_e022_err_feature_non_numeric"
        ]
        assert len(error_tasks) == 1, (
            f"E-201(説明変数型不一致)が1件記録されるべき。codes={[t['error_code'] for t in tasks]} stderr={result.stderr[-500:]}"
        )
        detail = _error_detail_of(error_tasks[0])
        assert detail is not None, "error_detail が result に載っていない"
        assert detail["display_code"] == "E-201"
        assert detail["responsibility"] == RESPONSIBILITY_SELF_FIX
        assert "avg_water_usage" in (error_tasks[0]["error_msg"] or "")


class TestIF003FeatureColumnsAbsent:
    """FR004-007 R-055: モデルの説明変数が推定入力に1つも無い(=別データセット) → E-20004で停止。

    部分欠損はNaN補完で許容する設計。ゼロ一致だけを致命にする。モデルだけ実在しない列名で
    学習し、正常な normalized.csv（それらの列を一切持たない）を入力して実処理で発火させる。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        # 入力CSVに存在しない列名でモデルを学習 → present_cols が空になる
        model_zip = _create_model_zip(
            data_dir, feat_cols=["__absent_feature_a__", "__absent_feature_b__"]
        )
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

    def test_job_status_is_error(self, env):
        result = _run_if003(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "error", (
            f"説明変数ゼロ一致で停止すべき。status={jobs[0]['status']} stderr={result.stderr[-500:]}"
        )

    def test_attributed_error_task_recorded(self, env):
        result = _run_if003(env["params"])
        tasks = _get_job_tasks(env["test_db"])
        error_tasks = [
            t for t in tasks if t["error_code"] == "IF003_e022_err_model_missing"
        ]
        assert len(error_tasks) == 1, (
            f"E-20004(説明変数欠損)が1件記録されるべき。codes={[t['error_code'] for t in tasks]} stderr={result.stderr[-500:]}"
        )
        detail = _error_detail_of(error_tasks[0])
        assert detail is not None, "error_detail が result に載っていない"
        assert detail["display_code"] == "E-20004"
        assert detail["responsibility"] == RESPONSIBILITY_SELF_FIX
