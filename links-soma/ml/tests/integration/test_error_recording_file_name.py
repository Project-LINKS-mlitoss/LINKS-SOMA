"""エラー記録の単一口での登録ファイル名解決（FR004-007 / #1849）の結線テスト。

create_or_update_job_task は job_tasks への唯一の記録口。ここで本文中の内部ファイル名
(UUID・file_path)を登録名へ一括変換する。path を本文に埋める全エラー（E016 建物ポリゴン
読込 E-0014 等）が、set_error を個別に触らずとも登録名表示になることを実DBで担保する。
"""

import utils
from constants import ERROR_00014
from db_helpers import insert_row, query_all


class TestErrorRecordingResolvesRegisteredFileName:
    """記録口 create_or_update_job_task が本文の file_path を登録名へ置換する"""

    def test_path埋め込みエラーの本文が登録名になる(self, test_db):
        utils.connect_sqllite(test_db)
        # payload の path(=file_path・UUID内部名)に紐づく登録名を DB へ
        insert_row(
            test_db,
            "raw_data_sets",
            file_name="建物ポリゴン.gpkg",
            file_path="a1b2c3d4.gpkg",
        )
        job_id = utils.create_or_update_job(None, "preprocess")
        # E-0014（建物ポリゴン読込失敗）の実本文: param_st1 に file_path が入る
        raw_msg = ERROR_00014["message"].format(param_st1="a1b2c3d4.gpkg")

        utils.create_or_update_job_task(
            job_id,
            progress_percent="",
            preprocess_type=None,
            error_code=ERROR_00014["code"],
            error_msg=raw_msg,
            result="{}",
            is_finish=True,
        )

        tasks = query_all(test_db, "job_tasks")
        recorded = [t for t in tasks if t["error_code"] == ERROR_00014["code"]]
        assert len(recorded) == 1
        msg = recorded[0]["error_msg"]
        # UUID が登録名へ置き換わり、どのファイルか分かる
        assert "建物ポリゴン.gpkg" in msg, f"登録名に置換されていない: {msg}"
        assert "a1b2c3d4.gpkg" not in msg, f"内部UUIDが残っている: {msg}"

    def test_登録に無いパスは素通し(self, test_db):
        utils.connect_sqllite(test_db)
        job_id = utils.create_or_update_job(None, "preprocess")
        raw_msg = ERROR_00014["message"].format(param_st1="intermediate.csv")

        utils.create_or_update_job_task(
            job_id,
            progress_percent="",
            preprocess_type=None,
            error_code=ERROR_00014["code"],
            error_msg=raw_msg,
            result="{}",
            is_finish=True,
        )

        tasks = query_all(test_db, "job_tasks")
        recorded = [t for t in tasks if t["error_code"] == ERROR_00014["code"]]
        assert recorded[0]["error_msg"] == raw_msg

    def test_名寄せ済みデータの内部名も登録名に変換される(self, test_db):
        """記録口の一括変換は raw だけでなく normalized_data_sets の登録名も引く（推定エラー用）。"""
        utils.connect_sqllite(test_db)
        insert_row(
            test_db,
            "normalized_data_sets",
            file_name="名寄せ結果_0705.csv",
            file_path="norm-uuid.csv",
        )
        job_id = utils.create_or_update_job(None, "estimate")
        raw_msg = ERROR_00014["message"].format(param_st1="norm-uuid.csv")

        utils.create_or_update_job_task(
            job_id,
            progress_percent="",
            preprocess_type=None,
            error_code=ERROR_00014["code"],
            error_msg=raw_msg,
            result="{}",
            is_finish=True,
        )

        recorded = [
            t for t in query_all(test_db, "job_tasks")
            if t["error_code"] == ERROR_00014["code"]
        ]
        assert "名寄せ結果_0705.csv" in recorded[0]["error_msg"]
