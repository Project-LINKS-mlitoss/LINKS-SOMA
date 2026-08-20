"""IF002 モデル構築 — 統合テスト

検証対象: IF002.py:main() → E021.train_and_evaluate() の一連処理。

期待値の根拠:
- docs/spec/interfaces/IF002-training.md
- docs/spec/modules/E021-model-training.md

注意: IF002はモジュールレベルでsys.stdin.fileno()を呼ぶため、
サブプロセスで実行する（test_if003.pyと同パターン）。
"""

import json
import os
import subprocess
import sys
import zipfile

import joblib
import numpy as np
import pandas as pd
import pytest

from db_helpers import query_all


# ============================================================
# ヘルパー
# ============================================================


def _get_jobs(db_path):
    return query_all(db_path, "jobs")


def _get_job_tasks(db_path):
    return query_all(db_path, "job_tasks")


def _get_job_results(db_path):
    return query_all(db_path, "job_results")


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


def _ml_root():
    """ml/ ディレクトリのパスを返す"""
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _run_if002(params):
    """IF002.main()をサブプロセスで実行"""
    params_json = json.dumps(params)
    ml_root = _ml_root()
    script = (
        "import sys\n"
        f"sys.argv = ['IF002.py', '--parameters', {repr(params_json)}]\n"
        "import IF002\n"
        "IF002.main()\n"
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


def _create_training_csv(data_dir, n_positive=10, n_negative=90, extra_cols=None):
    """IF001出力相当のCSVを生成

    最小限の特徴量 + is_vacantラベルを含む。
    PU Baggingのstratified splitが機能する程度の行数（正例10、負例90）。
    """
    n = n_positive + n_negative
    rng = np.random.RandomState(42)

    data = {
        "water_supply_number": [f"W{i:04d}" for i in range(n)],
        "normalized_address": [f"テスト市{i}丁目" for i in range(n)],
        "is_vacant": [1] * n_positive + [0] * n_negative,
        # 水道系特徴量
        "avg_water_usage": rng.uniform(0, 50, n),
        "water_disconnection_flag": rng.choice([0, 1], n, p=[0.7, 0.3]),
        "total_water_usage": rng.uniform(0, 300, n),
        "max_water_usage": rng.uniform(0, 100, n),
        "years_since_closure": rng.uniform(0, 20, n),
        # 住基系特徴量
        "household_size_juki_residence": rng.choice([0, 1, 2, 3], n),
        "juki_residence_flag": rng.choice([0, 1], n, p=[0.3, 0.7]),
        "suido_residence_flag": [1] * n,
    }
    if extra_cols:
        for col, values in extra_cols.items():
            data[col] = values

    df = pd.DataFrame(data)
    csv_path = os.path.join(data_dir, "training_data.csv")
    df.to_csv(csv_path, index=False, encoding="utf-8-sig")
    return csv_path


def _base_params(test_db, data_dir, input_csv_name="training_data.csv"):
    """IF002の基本パラメータ"""
    return {
        "database_path": test_db,
        "job_id": None,
        "output_path": data_dir,
        "input_path": input_csv_name,
        "settings": {
            "explanatory_variables": [
                "avg_water_usage",
                "water_disconnection_flag",
                "total_water_usage",
                "max_water_usage",
                "years_since_closure",
                "household_size_juki_residence",
                "juki_residence_flag",
            ],
            "advanced": {},
        },
    }


# ============================================================
# 正常系
# ============================================================


class TestIF002BasicTraining:
    """M1: 基本構築（デフォルト全選択、hyper off、undersample off）

    spec期待値:
    - ジョブステータスが "complete" になる
    - job_resultsにZIPパスが記録される
    - ZIPにmodel.pklとmetrics.jsonが含まれる
    - model.pklにmodels, feat_cols, threshold等が含まれる
    - metrics.jsonにPrecision@K, Lift@K, threshold等が含まれる
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_training_csv(data_dir)
        params = _base_params(test_db, data_dir)
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_complete(self, env):
        """spec: 全処理完了時のstatusは "complete" """
        result = _run_if002(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert len(jobs) >= 1, f"jobsが空。stderr: {result.stderr[-500:]}"
        assert jobs[0]["status"] == "complete", f"status={jobs[0]['status']}. stderr: {result.stderr[-500:]}"

    def test_job_results_has_zip(self, env):
        """spec: job_resultsにZIPファイルパスが記録される"""
        _run_if002(env["params"])
        results = _get_job_results(env["test_db"])
        assert len(results) >= 1
        assert results[0]["file_path"].endswith(".zip")

    def test_zip_contains_model_and_metrics(self, env):
        """spec: 出力ZIPにmodel.pklとmetrics.jsonが含まれる"""
        _run_if002(env["params"])
        results = _get_job_results(env["test_db"])
        zip_path = os.path.join(env["data_dir"], results[0]["file_path"])
        assert os.path.exists(zip_path), f"ZIPが見つからない: {zip_path}"
        with zipfile.ZipFile(zip_path) as zf:
            names = zf.namelist()
            assert "model.pkl" in names, f"model.pklがZIPにない: {names}"
            assert "metrics.json" in names, f"metrics.jsonがZIPにない: {names}"

    def test_model_artifact_structure(self, env):
        """spec: model.pklにmodels(30bags), feat_cols, threshold等が含まれる"""
        _run_if002(env["params"])
        results = _get_job_results(env["test_db"])
        zip_path = os.path.join(env["data_dir"], results[0]["file_path"])
        with zipfile.ZipFile(zip_path) as zf:
            zf.extract("model.pkl", env["data_dir"])
        model = joblib.load(os.path.join(env["data_dir"], "model.pkl"))
        assert "models" in model, "model.pklにmodelsキーがない"
        assert len(model["models"]) == 30, f"バッグ数が30でない: {len(model['models'])}"
        assert "feat_cols" in model
        assert "threshold" in model
        assert "medians" in model
        assert model["method"] == "M6_prior_rebal"

    def test_metrics_json_structure(self, env):
        """spec: metrics.jsonにPrecision@K, threshold, feature_importance等が含まれる"""
        _run_if002(env["params"])
        results = _get_job_results(env["test_db"])
        zip_path = os.path.join(env["data_dir"], results[0]["file_path"])
        with zipfile.ZipFile(zip_path) as zf:
            metrics_raw = zf.read("metrics.json")
        metrics = json.loads(metrics_raw)
        assert "metrics" in metrics
        m = metrics["metrics"]
        for key in ["precisionAt100", "precisionAt500", "threshold", "candidateCount"]:
            assert key in m, f"metrics.jsonに{key}がない"
        assert "feature_importance" in metrics
        assert "training_info" in metrics

    def test_task_result_has_durations(self, env):
        """NR007: job_tasks.resultに処理時間（全体・学習）が秒で記録される"""
        _run_if002(env["params"])
        tasks = _get_job_tasks(env["test_db"])
        model_task = next(
            (t for t in tasks if t.get("result") and "model_create" in t["result"]),
            None,
        )
        assert model_task is not None, "model_createタスクが見つからない"
        result = json.loads(model_task["result"])
        for key in ["durationTotalSec", "durationTrainingSec"]:
            assert key in result, f"resultに{key}がない: {list(result.keys())}"
            assert float(result[key]) > 0, f"{key}が正の値でない: {result[key]}"
        # 全体（読み込み〜保存）は学習を内包するので 全体 >= 学習
        assert float(result["durationTotalSec"]) >= float(result["durationTrainingSec"])

    def test_output_directory_cleaned_up(self, env):
        """spec: 一時ディレクトリはfinally句で削除される"""
        _run_if002(env["params"])
        # UUID形式のディレクトリが残っていないことを確認
        remaining_dirs = [
            d for d in os.listdir(env["data_dir"])
            if os.path.isdir(os.path.join(env["data_dir"], d)) and len(d) == 36
        ]
        assert len(remaining_dirs) == 0, f"一時ディレクトリが残っている: {remaining_dirs}"


class TestIF002MinimalFeatures:
    """M2: 最小説明変数（1個のみ）

    spec期待値:
    - 説明変数1個でもモデル構築が完了する
    - feat_colsに1カラムのみ含まれる
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_training_csv(data_dir)
        params = _base_params(test_db, data_dir)
        params["settings"]["explanatory_variables"] = ["avg_water_usage"]
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_completes_with_single_feature(self, env):
        """spec: 説明変数1個でも正常完了"""
        result = _run_if002(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete", f"stderr: {result.stderr[-500:]}"

    def test_model_has_single_feature(self, env):
        """spec: feat_colsに指定した1カラムのみ含まれる"""
        _run_if002(env["params"])
        results = _get_job_results(env["test_db"])
        zip_path = os.path.join(env["data_dir"], results[0]["file_path"])
        with zipfile.ZipFile(zip_path) as zf:
            zf.extract("model.pkl", env["data_dir"])
        model = joblib.load(os.path.join(env["data_dir"], "model.pkl"))
        assert model["feat_cols"] == ["avg_water_usage"]


class TestIF002WithUndersample:
    """M4: アンダーサンプリング有効

    spec期待値:
    - undersample=Trueで正常完了する
    - モデルが構築される（バッグ数30）
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_training_csv(data_dir)
        params = _base_params(test_db, data_dir)
        params["settings"]["advanced"] = {
            "undersample": True,
            "undersample_ratio": 3.0,
        }
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_completes(self, env):
        """spec: undersample有効でも正常完了"""
        result = _run_if002(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete", f"stderr: {result.stderr[-500:]}"


class TestIF002JPFeatureNames:
    """M1補足: 日本語説明変数名（FEが送信する形式）

    spec期待値:
    - 日本語カラム名がE021._JP_TO_EN_FEATURE_MAPで英語名に変換され、正常完了する
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_training_csv(data_dir)
        params = _base_params(test_db, data_dir)
        # FEが送信する日本語カラム名
        params["settings"]["explanatory_variables"] = [
            "平均検針水量",
            "閉栓フラグ",
            "年間合計検針水量",
        ]
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_jp_feature_names_resolved(self, env):
        """spec: 日本語説明変数名が英語名に変換され正常完了"""
        result = _run_if002(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete", f"stderr: {result.stderr[-500:]}"

    def test_model_feat_cols_are_english(self, env):
        """spec: model.pklのfeat_colsは英語名で格納される"""
        _run_if002(env["params"])
        results = _get_job_results(env["test_db"])
        zip_path = os.path.join(env["data_dir"], results[0]["file_path"])
        with zipfile.ZipFile(zip_path) as zf:
            zf.extract("model.pkl", env["data_dir"])
        model = joblib.load(os.path.join(env["data_dir"], "model.pkl"))
        expected = ["avg_water_usage", "water_disconnection_flag", "total_water_usage"]
        assert sorted(model["feat_cols"]) == sorted(expected)


# ============================================================
# 異常系
# ============================================================


class TestIF002NoFeatures:
    """ME1: 説明変数0個

    spec期待値:
    - 有効な説明変数が0個の場合、jobs.status="error"
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_training_csv(data_dir)
        params = _base_params(test_db, data_dir)
        params["settings"]["explanatory_variables"] = []
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_error(self, env):
        """spec: 説明変数0個はエラー"""
        _run_if002(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "error"


class TestIF002FeatureTypeMismatch:
    """FR004-007: 説明変数に非数値が混入 → 型不一致(E-201)を責任分界つきで記録しエラー停止。

    旧挙動は _prepare_features の .to_numpy(dtype=float) で不透明にクラッシュ。消費前に検出し、
    どの列が非数値かを示す attributed error（IF002_e021_err_feature_non_numeric）にする。
    説明変数 avg_water_usage の1セルを非数値にして実処理で発火させる。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        n = 100  # _create_training_csv 既定の正例10+負例90
        rng = np.random.RandomState(1)
        bad = [float(v) for v in rng.uniform(0, 50, n)]
        bad[3] = "不明"  # 説明変数 avg_water_usage に非数値を1件混入
        _create_training_csv(data_dir, extra_cols={"avg_water_usage": bad})
        params = _base_params(test_db, data_dir)
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_error(self, env):
        _run_if002(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "error"

    def test_attributed_error_task_recorded(self, env):
        _run_if002(env["params"])
        tasks = _get_job_tasks(env["test_db"])
        error_tasks = [
            t for t in tasks if t["error_code"] == "IF002_e021_err_feature_non_numeric"
        ]
        assert len(error_tasks) == 1, (
            f"E-201(説明変数型不一致)が1件記録されるべき。codes={[t['error_code'] for t in tasks]}"
        )
        detail = _error_detail_of(error_tasks[0])
        assert detail is not None, "error_detail が result に載っていない"
        assert detail["display_code"] == "E-201"
        assert detail["responsibility"] == "自治体修正"
        assert "avg_water_usage" in (error_tasks[0]["error_msg"] or "")
        # 汎用 model_learning(状況依存)を二重記録しない（責任分界が割れない）
        stale = [
            t for t in tasks if t["error_code"] == "IF002_e021_err_model_learning"
        ]
        assert stale == [], f"型不一致は E-201 のみで記録すべき。二重記録={stale}"


class TestIF002NoLabelColumn:
    """ME2: ラベルカラム不在

    spec期待値:
    - is_vacantカラムもakiya_result_cleaned_flagカラムもない場合、jobs.status="error"
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        # is_vacantなしのCSVを作成
        n = 50
        rng = np.random.RandomState(42)
        df = pd.DataFrame({
            "avg_water_usage": rng.uniform(0, 50, n),
            "water_disconnection_flag": rng.choice([0, 1], n),
        })
        df.to_csv(os.path.join(data_dir, "training_data.csv"), index=False, encoding="utf-8-sig")
        params = _base_params(test_db, data_dir)
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_error(self, env):
        """spec: ラベルカラムなしはエラー"""
        _run_if002(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "error"


class TestIF002ZeroPositives:
    """ME3: 正例0件

    spec期待値:
    - is_vacant=1が0件の場合、jobs.status="error"
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_training_csv(data_dir, n_positive=0, n_negative=50)
        params = _base_params(test_db, data_dir)
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_status_is_error(self, env):
        """spec: 正例0件はエラー"""
        _run_if002(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "error"


# ============================================================
# 既知バグ検出テスト
# ============================================================


class TestIF002ExcludedFeaturesNotification:
    """#1652: 除外された特徴量がUIに通知されない

    バグ: ユーザーが45個の説明変数を選択しても、データに存在しない9個が
    Python側で除外される。しかしjob_tasksのresultに除外情報が含まれず、
    UIに通知されない。

    テスト: 存在しない特徴量を含む説明変数リストでモデル構築し、
    job_tasksのresultに除外情報が含まれるか検証。
    """

    @pytest.fixture
    def env(self, test_db, tmp_path):
        data_dir = str(tmp_path / "data")
        os.makedirs(data_dir, exist_ok=True)
        _create_training_csv(data_dir)
        params = _base_params(test_db, data_dir)
        # 存在する変数3個 + 存在しない変数2個
        params["settings"]["explanatory_variables"] = [
            "avg_water_usage",
            "water_disconnection_flag",
            "total_water_usage",
            "この変数は存在しない_A",
            "この変数は存在しない_B",
        ]
        return {"test_db": test_db, "data_dir": data_dir, "params": params}

    def test_job_completes(self, env):
        """存在しない変数があっても正常完了する（既存動作確認）"""
        result = _run_if002(env["params"])
        jobs = _get_jobs(env["test_db"])
        assert jobs[0]["status"] == "complete", f"stderr: {result.stderr[-500:]}"

    @pytest.mark.xfail(reason="#1652: 除外特徴量がUIに通知されない")
    def test_excluded_features_in_task_result(self, env):
        """#1652: job_tasksのresultに除外された特徴量情報が含まれる"""
        _run_if002(env["params"])
        tasks = _get_job_tasks(env["test_db"])
        # task_resultにtaskResultType="model_create"のタスクを探す
        model_tasks = [
            t for t in tasks
            if t["result"] and "model_create" in t["result"]
        ]
        assert len(model_tasks) >= 1, "model_createタスクが見つからない"
        result = json.loads(model_tasks[0]["result"])
        # 除外された特徴量の情報がresultに含まれるべき
        assert "excluded_variables" in result or "unresolved_variables" in result, (
            f"除外特徴量の情報がtask_resultに含まれていない。keys: {list(result.keys())}"
        )
