"""IF005 結合チェック — 統合テスト

specが定義する振る舞いをコードが満たしているかを検証する。
期待値はspec（docs/spec/interfaces/IF005-join-check.md,
docs/spec/modules/E017-join-check.md）から導出。

テスト対象:
- IF005.py:main — ジョブ管理・ステータス遷移・クリーンアップ
- E017.py:lev_match — CSV+DB経由の結合チェック結果JSON構造
"""

import importlib
import json
import os
from unittest.mock import patch

import pandas as pd
import pytest

from db_helpers import query_all, query_by_job_id, insert_row
from constants import ERROR_50001
from E017 import lev_match


# ============================================================
# ヘルパー
# ============================================================


def _insert_job(db_path, status="", job_type="join_check"):
    return insert_row(db_path, "jobs", status=status, type=job_type)


def _get_job_tasks(db_path, job_id):
    return query_by_job_id(db_path, "job_tasks", job_id)


def _get_job(db_path, job_id):
    rows = query_by_job_id(db_path, "jobs", job_id)
    return rows[0] if rows else None


def _get_all_jobs(db_path):
    return query_all(db_path, "jobs")


def _write_csv(path, df):
    """UTF-8 BOM付きCSVを書き出す"""
    df.to_csv(path, index=False, encoding="utf-8-sig")


# ============================================================
# フィクスチャ: テスト用CSV + DB
# ============================================================


@pytest.fixture
def env(tmp_path, test_db):
    """lev_match()に必要な環境を構築する

    水道データ（メイン）:
      渡刈町乗蔵17, 渡刈町乗蔵1-2, 上仁木町下田391

    住民基本台帳（サブ・juki）:
      渡刈町乗藏4（旧字体 → 水道に不在 → 候補になる）
      渡刈町乗藏7（旧字体 → 水道に不在 → 候補になる）
      上仁木町下田100（水道に存在 → 候補にならない）
    """
    output_dir = str(tmp_path / "output")
    os.makedirs(output_dir, exist_ok=True)
    logs_dir = str(tmp_path / "logs")
    os.makedirs(logs_dir, exist_ok=True)

    # 水道データ（E012正規化済み想定）
    suido_df = pd.DataFrame({
        "normalized_address": [
            "渡刈町乗蔵17",
            "渡刈町乗蔵1-2",
            "上仁木町下田391",
        ]
    })
    suido_path = os.path.join(output_dir, "suido_status_cleaned.csv")
    _write_csv(suido_path, suido_df)

    # 住民基本台帳（E012正規化済み想定）
    juki_df = pd.DataFrame({
        "normalized_address": [
            "渡刈町乗藏4",
            "渡刈町乗藏7",
            "上仁木町下田100",
        ]
    })
    juki_path = os.path.join(output_dir, "juki_cleaned.csv")
    _write_csv(juki_path, juki_df)

    db_path = test_db
    job_id = _insert_job(db_path)

    return {
        "db_path": db_path,
        "job_id": job_id,
        "output_dir": output_dir,
        "suido_path": suido_path,
        "logs_dir": logs_dir,
    }


# ============================================================
# E017 lev_match() 結果JSON構造の検証
# ============================================================


class TestE017ResultStructure:
    """job_tasksに書き込まれるJSON結果がspecの構造を満たすか"""

    def _run_and_get_result(self, env):
        """lev_matchを実行し、最初のjob_taskのresultをJSONとして返す"""
        lev_match(
            main_csv=env["suido_path"],
            input_source=["juki"],
            output_path=env["output_dir"],
            job_id=env["job_id"],
            db_path=env["db_path"],
            logs_dir=env["logs_dir"],
            output_directory=env["output_dir"],
            threshold=0.8,
            max_number=5,
            debug=False,
        )
        tasks = _get_job_tasks(env["db_path"], env["job_id"])
        assert len(tasks) >= 1, "job_tasksにレコードが作成されていない"
        result = json.loads(tasks[-1]["result"])
        return result, tasks

    def test_task_result_type_is_join_check(self, env):
        """taskResultTypeは固定値 "join_check" """
        result, _ = self._run_and_get_result(env)
        assert result["taskResultType"] == "join_check"

    def test_target_uses_target_name_map(self, env):
        """targetはTARGET_NAME_MAPで変換された名前（juki → resident_registry）"""
        result, _ = self._run_and_get_result(env)
        assert result["target"] == "resident_registry"

    def test_unmatched_records_contains_only_absent_addresses(self, env):
        """unmatchedRecordsには水道データに存在しない大字住所のみが含まれる"""
        result, _ = self._run_and_get_result(env)
        source_addresses = [
            r["sourceAddress"] for r in result["unmatchedRecords"]
        ]
        # 渡刈町乗藏（旧字体）は水道データにない → 含まれる
        assert "渡刈町乗藏" in source_addresses
        # 上仁木町下田は水道データに存在する → 含まれない
        assert "上仁木町下田" not in source_addresses

    def test_unmatched_record_has_required_keys(self, env):
        """各unmatchedRecordはsourceAddress, sourceCount, candidatesを持つ"""
        result, _ = self._run_and_get_result(env)
        for record in result["unmatchedRecords"]:
            assert "sourceAddress" in record
            assert "sourceCount" in record
            assert "candidates" in record

    def test_candidate_has_required_keys(self, env):
        """candidates の各要素は address, count を持つ"""
        result, _ = self._run_and_get_result(env)
        # 渡刈町乗藏 → 渡刈町乗蔵 の候補があるはず
        record = next(
            r for r in result["unmatchedRecords"]
            if r["sourceAddress"] == "渡刈町乗藏"
        )
        assert len(record["candidates"]) >= 1
        for candidate in record["candidates"]:
            assert "address" in candidate
            assert "count" in candidate

    def test_candidate_address_is_from_water_data(self, env):
        """候補のaddressは水道データ側の大字住所"""
        result, _ = self._run_and_get_result(env)
        record = next(
            r for r in result["unmatchedRecords"]
            if r["sourceAddress"] == "渡刈町乗藏"
        )
        candidate_addresses = [c["address"] for c in record["candidates"]]
        assert "渡刈町乗蔵" in candidate_addresses

    def test_source_count_reflects_aggregated_record_count(self, env):
        """sourceCountは大字住所に集約された元データのレコード数"""
        result, _ = self._run_and_get_result(env)
        record = next(
            r for r in result["unmatchedRecords"]
            if r["sourceAddress"] == "渡刈町乗藏"
        )
        # juki_cleaned.csvに渡刈町乗藏は2件（渡刈町乗藏4, 渡刈町乗藏7）
        assert record["sourceCount"] == 2

    def test_candidate_count_reflects_water_data_count(self, env):
        """候補のcountは水道データ側のその大字住所のレコード数"""
        result, _ = self._run_and_get_result(env)
        record = next(
            r for r in result["unmatchedRecords"]
            if r["sourceAddress"] == "渡刈町乗藏"
        )
        candidate = next(
            c for c in record["candidates"]
            if c["address"] == "渡刈町乗蔵"
        )
        # suido_status_cleaned.csvに渡刈町乗蔵は2件（渡刈町乗蔵17, 渡刈町乗蔵1-2）
        assert candidate["count"] == 2


# ============================================================
# E017 lev_match() job_tasks メタデータの検証
# ============================================================


class TestE017TaskMetadata:
    """job_tasksテーブルのメタデータがspec通りか"""

    def _run(self, env):
        lev_match(
            main_csv=env["suido_path"],
            input_source=["juki"],
            output_path=env["output_dir"],
            job_id=env["job_id"],
            db_path=env["db_path"],
            logs_dir=env["logs_dir"],
            output_directory=env["output_dir"],
            threshold=0.8,
            max_number=5,
            debug=False,
        )
        return _get_job_tasks(env["db_path"], env["job_id"])

    def test_preprocess_type_is_e017(self, env):
        """preprocess_typeは "e017" で記録される"""
        tasks = self._run(env)
        assert tasks[-1]["preprocess_type"] == "e017"

    def test_progress_percent_is_100_on_completion(self, env):
        """完了時のprogress_percentは "100" """
        tasks = self._run(env)
        assert tasks[-1]["progress_percent"] == "100"

    def test_finished_at_is_set_on_completion(self, env):
        """完了時にfinished_atが設定される"""
        tasks = self._run(env)
        assert tasks[-1]["finished_at"] is not None


# ============================================================
# E017 lev_match() 複数データ種別の検証
# ============================================================


class TestE017MultipleDataSources:
    """複数のサブデータを同時にチェックした場合の検証"""

    @pytest.fixture
    def env_multi(self, tmp_path, test_db):
        """juki + touki の2種別を含む環境"""
        output_dir = str(tmp_path / "output")
        os.makedirs(output_dir, exist_ok=True)
        logs_dir = str(tmp_path / "logs")
        os.makedirs(logs_dir, exist_ok=True)

        suido_df = pd.DataFrame({
            "normalized_address": ["渡刈町乗蔵17", "上仁木町下田391"]
        })
        _write_csv(os.path.join(output_dir, "suido_status_cleaned.csv"), suido_df)

        juki_df = pd.DataFrame({
            "normalized_address": ["渡刈町乗藏4"]
        })
        _write_csv(os.path.join(output_dir, "juki_cleaned.csv"), juki_df)

        touki_df = pd.DataFrame({
            "normalized_address": ["大字北髙根沢100"]
        })
        _write_csv(os.path.join(output_dir, "touki_cleaned.csv"), touki_df)

        db_path = test_db
        job_id = _insert_job(db_path)

        return {
            "db_path": db_path,
            "job_id": job_id,
            "output_dir": output_dir,
            "suido_path": os.path.join(output_dir, "suido_status_cleaned.csv"),
            "logs_dir": logs_dir,
        }

    def test_each_data_source_gets_separate_task(self, env_multi):
        """データ種別ごとに別々のjob_taskレコードが作成される"""
        lev_match(
            main_csv=env_multi["suido_path"],
            input_source=["juki", "touki"],
            output_path=env_multi["output_dir"],
            job_id=env_multi["job_id"],
            db_path=env_multi["db_path"],
            logs_dir=env_multi["logs_dir"],
            output_directory=env_multi["output_dir"],
            threshold=0.8,
            max_number=5,
            debug=False,
        )
        tasks = _get_job_tasks(env_multi["db_path"], env_multi["job_id"])
        # juki用とtouki用の2つのタスクが完了(is_finish=True → finished_at非NULL)
        finished_tasks = [t for t in tasks if t["finished_at"] is not None]
        assert len(finished_tasks) == 2

    def test_target_names_are_correct_for_each_source(self, env_multi):
        """各タスクのtargetがTARGET_NAME_MAPに従う"""
        lev_match(
            main_csv=env_multi["suido_path"],
            input_source=["juki", "touki"],
            output_path=env_multi["output_dir"],
            job_id=env_multi["job_id"],
            db_path=env_multi["db_path"],
            logs_dir=env_multi["logs_dir"],
            output_directory=env_multi["output_dir"],
            threshold=0.8,
            max_number=5,
            debug=False,
        )
        tasks = _get_job_tasks(env_multi["db_path"], env_multi["job_id"])
        targets = set()
        for task in tasks:
            if task["result"]:
                result = json.loads(task["result"])
                targets.add(result["target"])
        assert targets == {"resident_registry", "building_registry"}


# ============================================================
# E017 lev_match() — 空き家調査結果・建物関連データ（#1775 PR2）
# ============================================================


class TestE017OptionalAndVacantSources:
    """空き家調査結果(vacant_house)・建物関連データ(optional_data_source)を
    表記ゆれチェック対象に加えたときの検証（#1775 PR2）。

    この2データはTARGET_NAME_MAPで恒等写像（juki→resident_registryのような
    別名変換を持たない）。frontendのJoinCheckTargetと同名で結果が返ることを保証する。
    """

    @pytest.fixture
    def env_optional_vacant(self, tmp_path, test_db):
        output_dir = str(tmp_path / "output")
        os.makedirs(output_dir, exist_ok=True)
        logs_dir = str(tmp_path / "logs")
        os.makedirs(logs_dir, exist_ok=True)

        suido_df = pd.DataFrame({
            "normalized_address": ["渡刈町乗蔵17", "上仁木町下田391"]
        })
        _write_csv(os.path.join(output_dir, "suido_status_cleaned.csv"), suido_df)

        # 建物関連データ: 旧字体（水道に不在 → 候補になる）
        optional_df = pd.DataFrame({
            "normalized_address": ["渡刈町乗藏4"]
        })
        _write_csv(
            os.path.join(output_dir, "optional_data_source_cleaned.csv"),
            optional_df,
        )

        # 空き家調査結果: 水道に不在の大字（候補になる）
        vacant_df = pd.DataFrame({
            "normalized_address": ["南町5"]
        })
        _write_csv(
            os.path.join(output_dir, "vacant_house_cleaned.csv"), vacant_df
        )

        return {
            "db_path": test_db,
            "job_id": _insert_job(test_db),
            "output_dir": output_dir,
            "suido_path": os.path.join(output_dir, "suido_status_cleaned.csv"),
            "logs_dir": logs_dir,
        }

    def test_target_names_are_identity_for_new_sources(self, env_optional_vacant):
        """optional_data_source / vacant_house はTARGET_NAME_MAPで恒等写像される"""
        lev_match(
            main_csv=env_optional_vacant["suido_path"],
            input_source=["optional_data_source", "vacant_house"],
            output_path=env_optional_vacant["output_dir"],
            job_id=env_optional_vacant["job_id"],
            db_path=env_optional_vacant["db_path"],
            logs_dir=env_optional_vacant["logs_dir"],
            output_directory=env_optional_vacant["output_dir"],
            threshold=0.8,
            max_number=5,
            debug=False,
        )
        tasks = _get_job_tasks(
            env_optional_vacant["db_path"], env_optional_vacant["job_id"]
        )
        targets = {
            json.loads(t["result"])["target"]
            for t in tasks
            if t["result"]
        }
        assert targets == {"optional_data_source", "vacant_house"}


# ============================================================
# IF005 main() — ジョブ管理・ステータス遷移
# ============================================================


class TestIF005Main:
    """IF005.py main()のジョブ管理がspec通りか

    spec: Job作成時の type は "join_check"
    spec: 最終 status は "complete" / "error"
    spec: CSVファイル出力なし（create_job_resultsは呼ばれない）
    spec: 成功・失敗問わず一時ディレクトリを削除
    """

    def _build_params(self, db_path, output_path, suido_filename, juki_filename):
        return {
            "database_path": db_path,
            "job_id": None,
            "output_path": output_path,
            "data": {
                "water_status": {
                    "path": suido_filename,
                    "columns": {"address": "住所"},
                },
                "resident_registry": {
                    "path": juki_filename,
                    "columns": {"address": "住所"},
                },
            },
            "settings": {"threshold": "0.8", "max_number": "5", "municipality": "テスト市"},
        }

    @pytest.fixture
    def main_env(self, tmp_path, test_db):
        """IF005 main()用の環境を構築

        E012は生データの住所カラムを正規化して normalized_address を生成する。
        入力CSVにはユーザー指定のカラム名（ここでは「住所」）が必要。
        """
        output_path = str(tmp_path / "output")
        os.makedirs(output_path, exist_ok=True)

        suido_df = pd.DataFrame({
            "住所": ["渡刈町乗蔵17", "渡刈町乗蔵1-2", "上仁木町下田391"]
        })
        suido_filename = "suido_status.csv"
        _write_csv(os.path.join(output_path, suido_filename), suido_df)

        juki_df = pd.DataFrame({
            "住所": ["渡刈町乗藏4", "渡刈町乗藏7", "上仁木町下田100"]
        })
        juki_filename = "juki.csv"
        _write_csv(os.path.join(output_path, juki_filename), juki_df)

        db_path = test_db

        return {
            "db_path": db_path,
            "output_path": output_path,
            "suido_filename": suido_filename,
            "juki_filename": juki_filename,
        }

    @pytest.mark.xfail(
        reason="IF005.py L74 で type='result' がハードコードされている。"
        "spec（IF005-join-check.md）では 'join_check' を要求するが、"
        "Electron側の jobs テーブルフィルタが 'result' を前提としている可能性があるため、"
        "修正には Electron 側の影響調査が必要。"
    )
    def test_job_type_is_join_check(self, main_env):
        """spec: Job作成時のtypeは "join_check" """
        params = self._build_params(
            main_env["db_path"],
            main_env["output_path"],
            main_env["suido_filename"],
            main_env["juki_filename"],
        )
        test_args = ["IF005.py", "--parameters", json.dumps(params)]

        with patch("sys.argv", test_args):
            import IF005
            importlib.reload(IF005)
            IF005.main()

        jobs = _get_all_jobs(main_env["db_path"])
        assert len(jobs) >= 1
        assert jobs[0]["type"] == "join_check"

    def test_final_status_is_complete(self, main_env):
        """spec: 正常完了時のstatusは "complete" """
        params = self._build_params(
            main_env["db_path"],
            main_env["output_path"],
            main_env["suido_filename"],
            main_env["juki_filename"],
        )
        test_args = ["IF005.py", "--parameters", json.dumps(params)]

        with patch("sys.argv", test_args):
            import IF005
            importlib.reload(IF005)
            IF005.main()

        jobs = _get_all_jobs(main_env["db_path"])
        assert jobs[0]["status"] == "complete"


# ============================================================
# IF005 main() — 空き家調査結果・建物関連データの端から端まで（#1775 PR2）
# ============================================================


class TestIF005NewDataSourcesEndToEnd:
    """IF005 main() が vacant_house / optional_data_source を
    パラメータ抽出 → E012正規化 → E017結合チェック まで通すことを検証する。

    生データ（住所カラムのみ）を渡し、job_tasks の target に2データが現れれば、
    (1) IF005 のパラメータ抽出・input_source 追加
    (2) E012 normalize_address の cleaned CSV 生成
    (3) E017 の input_source ループと TARGET_NAME_MAP
    の配線が端から端まで成立している。
    """

    @pytest.fixture
    def main_env(self, tmp_path, test_db):
        output_path = str(tmp_path / "output")
        os.makedirs(output_path, exist_ok=True)

        suido_df = pd.DataFrame({
            "住所": ["渡刈町乗蔵17", "渡刈町乗蔵1-2", "上仁木町下田391"]
        })
        _write_csv(os.path.join(output_path, "suido_status.csv"), suido_df)

        # 建物関連データ: 住所カラムに加え説明変数カラムを持つ（住所のみ抽出される）
        optional_df = pd.DataFrame({
            "住所": ["渡刈町乗藏4"],
            "築年数": ["30"],
        })
        _write_csv(os.path.join(output_path, "optional.csv"), optional_df)

        vacant_df = pd.DataFrame({
            "住所": ["南町5"]
        })
        _write_csv(os.path.join(output_path, "vacant.csv"), vacant_df)

        return {
            "db_path": test_db,
            "output_path": output_path,
        }

    def _build_params(self, db_path, output_path):
        return {
            "database_path": db_path,
            "job_id": None,
            "output_path": output_path,
            "data": {
                "water_status": {
                    "path": "suido_status.csv",
                    "columns": {"address": "住所"},
                },
                "optional_data_source": {
                    "path": "optional.csv",
                    "columns": {"address": "住所"},
                },
                "vacant_house": {
                    "path": "vacant.csv",
                    "columns": {"address": "住所"},
                },
            },
            "settings": {
                "threshold": "0.8",
                "max_number": "5",
                "municipality": "テスト市",
            },
        }

    def test_new_sources_appear_as_join_check_targets(self, main_env):
        """vacant_house / optional_data_source が結合チェック結果に現れる"""
        params = self._build_params(
            main_env["db_path"], main_env["output_path"]
        )
        test_args = ["IF005.py", "--parameters", json.dumps(params)]

        with patch("sys.argv", test_args):
            import IF005
            importlib.reload(IF005)
            IF005.main()

        jobs = _get_all_jobs(main_env["db_path"])
        assert len(jobs) >= 1
        assert jobs[0]["status"] == "complete"

        tasks = _get_job_tasks(main_env["db_path"], jobs[0]["id"])
        targets = {
            json.loads(t["result"])["target"]
            for t in tasks
            if t["result"] and t["preprocess_type"] == "e017"
        }
        assert "optional_data_source" in targets
        assert "vacant_house" in targets


# ============================================================
# E012 — municipality引数の配線検証
# ============================================================


class TestE012MunicipalityWiring:
    """settings.municipality が E012.normalize_address まで到達し、
    convert_address で実際に市名除去に使われることを検証する。

    ユニットテストでは convert_address 関数単体の動作を確認済み。
    ここでは normalize_address(入口) → EachFileProcessor → convert_address
    の引数伝搬が正しく配線されているかを統合的に検証する。
    """

    def test_municipality_strips_city_from_normalized_address(self, tmp_path):
        """municipalityに指定した市名が正規化後の住所先頭から除去される"""
        from E012 import normalize_address as E012

        output_dir = str(tmp_path / "output")
        os.makedirs(output_dir, exist_ok=True)

        # テストデータ: 住所に「テスト市」を含む
        suido_df = pd.DataFrame({
            "住所": ["テスト市大手町1丁目1番", "テスト市駅前2丁目3番"]
        })
        suido_path = os.path.join(output_dir, "suido_status.csv")
        suido_df.to_csv(suido_path, index=False, encoding="utf-8-sig")

        columns = {
            "suido_status": {"suido_status_address": "住所"},
        }

        logs_dir = str(tmp_path / "logs")
        os.makedirs(logs_dir, exist_ok=True)

        E012(
            input_files={"suido_status": suido_path},
            output_directory=output_dir,
            job_id=None,
            columns=columns,
            logs_dir=logs_dir,
            municipality="テスト市",
        )

        result = pd.read_csv(os.path.join(output_dir, "suido_status_cleaned.csv"))
        for addr in result["normalized_address"]:
            assert not str(addr).startswith("てすと市"), (
                f"municipality='テスト市' を指定したが、正規化後の住所にテスト市が残っている: {addr}"
            )

    def test_kanji_municipality_strips_city(self, tmp_path):
        """漢字の市名（実運用パターン）が正規化後の住所先頭から除去される"""
        from E012 import normalize_address as E012

        output_dir = str(tmp_path / "output")
        os.makedirs(output_dir, exist_ok=True)

        suido_df = pd.DataFrame({
            "住所": ["試験市大手町1丁目1番", "試験市駅前2丁目3番"]
        })
        suido_path = os.path.join(output_dir, "suido_status.csv")
        suido_df.to_csv(suido_path, index=False, encoding="utf-8-sig")

        columns = {
            "suido_status": {"suido_status_address": "住所"},
        }

        logs_dir = str(tmp_path / "logs")
        os.makedirs(logs_dir, exist_ok=True)

        E012(
            input_files={"suido_status": suido_path},
            output_directory=output_dir,
            job_id=None,
            columns=columns,
            logs_dir=logs_dir,
            municipality="試験市",
        )

        result = pd.read_csv(os.path.join(output_dir, "suido_status_cleaned.csv"))
        for addr in result["normalized_address"]:
            assert not str(addr).startswith("試験市"), (
                f"municipality='試験市' を指定したが、正規化後の住所に試験市が残っている: {addr}"
            )

    def test_without_municipality_city_is_preserved(self, tmp_path):
        """municipality未指定時は市名が住所に残る"""
        from E012 import normalize_address as E012

        output_dir = str(tmp_path / "output")
        os.makedirs(output_dir, exist_ok=True)

        suido_df = pd.DataFrame({
            "住所": ["テスト市大手町1丁目1番"]
        })
        suido_path = os.path.join(output_dir, "suido_status.csv")
        suido_df.to_csv(suido_path, index=False, encoding="utf-8-sig")

        columns = {
            "suido_status": {"suido_status_address": "住所"},
        }

        logs_dir = str(tmp_path / "logs")
        os.makedirs(logs_dir, exist_ok=True)

        E012(
            input_files={"suido_status": suido_path},
            output_directory=output_dir,
            job_id=None,
            columns=columns,
            logs_dir=logs_dir,
            municipality=None,
        )

        result = pd.read_csv(os.path.join(output_dir, "suido_status_cleaned.csv"))
        addr = str(result["normalized_address"].iloc[0])
        assert addr.startswith("てすと市"), (
            f"municipality=None なのにテスト市が除去されている: {addr}"
        )


# ============================================================
# IF005 エントリポイントバリデーション
# ============================================================


class TestIF005EntrypointValidation:
    """IF005のmain()で入力ファイルが未指定の場合のテスト"""

    def test_no_input_files_records_error(self, test_db, tmp_path):
        """入力ファイルが空の場合、ERROR_50001がjob_tasksに記録される"""
        output_path = str(tmp_path / "output")
        os.makedirs(output_path, exist_ok=True)

        params = {
            "database_path": test_db,
            "job_id": None,
            "output_path": output_path,
            "data": {},
            "settings": {"municipality": "テスト市"},
        }
        test_args = ["IF005.py", "--parameters", json.dumps(params)]

        with patch("sys.argv", test_args):
            import IF005
            importlib.reload(IF005)
            IF005.main()

        tasks = query_all(test_db, "job_tasks")
        error_tasks = [t for t in tasks if t["error_code"] == ERROR_50001["code"]]
        assert len(error_tasks) == 1
        assert error_tasks[0]["preprocess_type"] is None
        assert error_tasks[0]["error_msg"] == ERROR_50001["message"]
