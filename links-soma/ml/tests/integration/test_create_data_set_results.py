"""create_data_set_results の統合テスト

推定結果の保存(create_data_set_results)時に、紐づくジョブの is_named が
1(保存済み)へ更新されることを検証する。

回帰防止対象: 推定結果は自動保存されるのに jobs.is_named が 0 のままで、
処理一覧の「保存ステータス」が常に「未」になる不具合。
"""

import utils
from db_helpers import insert_row, query_all, query_by_job_id


def _insert_result_job(db_path: str) -> int:
    """is_named=0 の完了済み推定ジョブを1件作って id を返す。"""
    return insert_row(
        db_path,
        "jobs",
        status="complete",
        type="result",
        parameters="",
        process_id=0,
        is_named=0,
    )


class TestCreateDataSetResultsMarksJobSaved:
    """SUT: create_data_set_results が保存と同時にジョブを保存済みにする。"""

    def test_紐づくジョブのis_namedが1になる(self, test_db):
        job_id = _insert_result_job(test_db)

        utils.connect_sqllite(test_db)
        utils.create_data_set_results(job_id=job_id)

        jobs = {j["id"]: j for j in query_all(test_db, "jobs")}
        assert jobs[job_id]["is_named"] == 1

    def test_結果レコードがジョブに紐づいて作成される(self, test_db):
        job_id = _insert_result_job(test_db)

        utils.connect_sqllite(test_db)
        result_id = utils.create_data_set_results(job_id=job_id)

        results = query_by_job_id(test_db, "data_set_results", job_id)
        assert len(results) == 1
        assert results[0]["id"] == result_id

    def test_job_idがNoneならジョブのis_namedを変更しない(self, test_db):
        # 境界(反対側): job_id 未指定の保存では既存ジョブを更新しない。
        job_id = _insert_result_job(test_db)

        utils.connect_sqllite(test_db)
        utils.create_data_set_results(job_id=None)

        jobs = {j["id"]: j for j in query_all(test_db, "jobs")}
        assert jobs[job_id]["is_named"] == 0
