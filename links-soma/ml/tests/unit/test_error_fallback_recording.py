"""想定外の例外でもフォールバックのエラー文言が job_task に記録されることの単体テスト（FR006 / #1986）。

各処理は「想定したエラー」に限り set_error で ERROR_CODE / ERROR_MSG を立てる。想定外の例外は
何も立たないため、記録より先にフォールバックを立てないと error_msg が None のまま保存され、
画面が原因を示せなくなる（UI は job_tasks.error_msg を読む）。

本書が守る不変条件は2つ。
- 想定外の例外でも、記録される error_code / error_msg はフォールバックのものになる
- すでに立っている固有コードは、フォールバックで上書きされない
"""

from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

import E001_DataMatching.E016 as e016
import E002_Classification.E021 as e021
import E002_Classification.E022 as e022
import E003_Summarization.E032 as e032
import E003_Summarization.E033 as e033

_MODULES = (e016, e022, e032, e033)


@pytest.fixture(autouse=True)
def _reset_module_error_state():
    """ERROR_CODE / ERROR_MSG はモジュールグローバル。テスト間の持ち越しを断つ。"""
    for module in _MODULES:
        module.ERROR_CODE = None
        module.ERROR_MSG = None
    yield
    for module in _MODULES:
        module.ERROR_CODE = None
        module.ERROR_MSG = None


# create_or_update_job_task の位置引数の並び（utils.create_or_update_job_task と同一）。
# 呼び出し側はキーワード形式と位置形式が混在するため、記録内容の検証前に正規化する。
_RECORDER_POSITIONAL = (
    "job_id",
    "progress_percent",
    "preprocess_type",
    "error_code",
    "error_msg",
    "result",
)


def _capture_recorder(calls: list):
    """create_or_update_job_task の呼び出し引数を集める差し替え。task_id を返す。"""

    def _record(*args, **kwargs):
        call = dict(zip(_RECORDER_POSITIONAL, args))
        call.update(kwargs)
        calls.append(call)
        return 1

    return _record


def _last_error_record(calls: list) -> dict:
    """error_code を伴う最後の記録（＝エラー記録）を取り出す。"""
    error_calls = [c for c in calls if c.get("error_code")]
    assert error_calls, f"エラーを伴う job_task の記録が無い: {calls}"
    return error_calls[-1]


class TestFallbackRecordedOnUnexpectedError:
    """想定外の例外でもフォールバック文言が記録される"""

    def test_空間結合の想定外例外はE0019として記録される(self, tmp_path):
        """E016: 想定外の例外は E-0019 の文言つきで記録される"""
        calls: list = []
        with (
            patch.object(e016, "create_or_update_job_task", _capture_recorder(calls)),
            patch.object(e016, "get_rotating_logger", return_value=MagicMock()),
            patch.object(e016, "load_and_process_data", side_effect=RuntimeError("boom")),
            pytest.raises(Exception),
        ):
            e016.process_data(
                tatemono_path=None,
                e14_merged_path=str(tmp_path / "e14.csv"),
                gpkg_path=None,
                option=None,
                output_type="csv",
                output_path=str(tmp_path),
                job_id=1,
                logs_dir=str(tmp_path),
            )

        record = _last_error_record(calls)
        assert record["error_code"] == "IF001_e016_err_spatial_join"
        assert "[E-0019]" in record["error_msg"]

    def test_推定の想定外例外はE20008として記録される(self, tmp_path):
        """E022: 想定外の例外は E-20008 の文言つきで記録される"""
        calls: list = []
        with (
            patch.object(e022, "create_or_update_job_task", _capture_recorder(calls)),
            patch.object(e022, "create_or_update_job", MagicMock()),
            patch.object(e022, "connect_sqllite", MagicMock()),
            patch.object(e022, "get_rotating_logger", return_value=MagicMock()),
            patch.object(e022, "read_csv", return_value=pd.DataFrame()),
            pytest.raises(Exception),
        ):
            e022.main(
                input_path=str(tmp_path / "in.csv"),
                model_path=str(tmp_path / "model.zip"),
                output_dir=str(tmp_path),
                file_path=str(tmp_path / "out.csv"),
                thresh=0.5,
                job_id="1",
                db_path=str(tmp_path / "db.sqlite"),
                process=100.0,
                data_set_result_id=1,
                logs_dir=str(tmp_path),
            )

        record = _last_error_record(calls)
        assert record["error_code"] == "IF003_e022_err_perform_determination"
        assert "[E-20008]" in record["error_msg"]

    def test_推定の記録本文に文字列Noneが混入しない(self, tmp_path):
        """E022: 対象ファイル文脈を添えても本文が文字列 'None' にならない"""
        calls: list = []
        with (
            patch.object(e022, "create_or_update_job_task", _capture_recorder(calls)),
            patch.object(e022, "create_or_update_job", MagicMock()),
            patch.object(e022, "connect_sqllite", MagicMock()),
            patch.object(e022, "get_rotating_logger", return_value=MagicMock()),
            patch.object(e022, "read_csv", return_value=pd.DataFrame()),
            pytest.raises(Exception),
        ):
            e022.main(
                input_path=str(tmp_path / "in.csv"),
                model_path=str(tmp_path / "model.zip"),
                output_dir=str(tmp_path),
                file_path=str(tmp_path / "out.csv"),
                thresh=0.5,
                job_id="1",
                db_path=str(tmp_path / "db.sqlite"),
                process=100.0,
                data_set_result_id=1,
                logs_dir=str(tmp_path),
            )

        assert "None" not in _last_error_record(calls)["error_msg"]

    def test_出力の想定外例外はE30003として記録される(self, tmp_path):
        """E033: 想定外の例外は E-30003 の文言つきで記録される"""
        calls: list = []
        with (
            patch.object(e033, "create_or_update_job_task", _capture_recorder(calls)),
            patch.object(e033, "create_or_update_job", MagicMock()),
            patch.object(e033, "get_data_result_views", side_effect=RuntimeError("boom")),
            pytest.raises(Exception),
        ):
            e033.processing(
                {"output_path": str(tmp_path / "out.csv"), "view_id": 1},
                job_id=1,
                db_path=None,
            )

        record = _last_error_record(calls)
        assert record["error_code"] == "IF004_e033_err_conversion"
        assert "[E-30003]" in record["error_msg"]


class TestModelTrainingErrorCarriesDisplayCode:
    """モデル構築の例外は表示用コード付きで記録される

    E021 は set_error 方式を使わず、総括 except が直接記録する。表示用コードが
    文面に載らないと、職員が問い合わせ時に該当エラーを指し示せない。
    """

    def test_モデル構築の例外はE10001の文面で記録される(self, tmp_path):
        """E021: 送出理由を載せた E-10001 の文面が記録される"""
        calls: list = []
        with (
            patch.object(e021, "create_or_update_job_task", _capture_recorder(calls)),
            patch.object(e021, "create_or_update_job", MagicMock()),
            patch.object(e021, "get_rotating_logger", return_value=MagicMock()),
            patch.object(e021, "_read_csv", side_effect=RuntimeError("正例（空き家ラベル=1）が0件です。")),
            pytest.raises(Exception),
        ):
            e021.train_and_evaluate(
                db_path=str(tmp_path / "db.sqlite"),
                input_path=str(tmp_path / "in.csv"),
                output_path=str(tmp_path / "model.zip"),
                explanatory_variables=["water_usage"],
                job_id=1,
            )

        record = _last_error_record(calls)
        assert record["error_code"] == "IF002_e021_err_model_learning"
        assert "[E-10001]" in record["error_msg"]
        assert "正例（空き家ラベル=1）が0件です。" in record["error_msg"]


class TestExceptHandlerSurvivesEarlyFailure:
    """タスク作成前に失敗しても except 自身が落ちない

    task_id を try の内側で束縛すると、接続やロガー初期化で失敗したときに
    except の `if task_id is not None` が UnboundLocalError になり、元の例外が
    その場ですり替わる。送出されるのはフォールバック文言の例外で、元の例外は
    __context__ に残っていなければならない。
    """

    def test_出力は接続失敗でもUnboundLocalErrorにならない(self, tmp_path):
        """E033: connect_sqllite の失敗が UnboundLocalError に化けない"""
        with (
            patch.object(e033, "create_or_update_job_task", _capture_recorder([])),
            patch.object(e033, "connect_sqllite", side_effect=RuntimeError("db down")),
            pytest.raises(Exception) as excinfo,
        ):
            e033.processing(
                {"output_path": str(tmp_path / "out.csv"), "view_id": 1},
                job_id=1,
                db_path="dummy",
            )

        assert not isinstance(excinfo.value, UnboundLocalError)
        assert "db down" in str(excinfo.value.__context__)

    def test_地域集計はロガー初期化失敗でもUnboundLocalErrorにならない(self, tmp_path):
        """E032: get_rotating_logger の失敗が UnboundLocalError に化けない"""
        with (
            patch.object(e032, "create_or_update_job_task", _capture_recorder([])),
            patch.object(e032, "get_rotating_logger", side_effect=RuntimeError("no logdir")),
            pytest.raises(Exception) as excinfo,
        ):
            e032.process_summarization(
                akiya_pred_file=str(tmp_path / "pred.csv"),
                spatial_file=str(tmp_path / "area.gpkg"),
                output_dir=str(tmp_path),
                key_column="KEY_CODE",
                job_id=1,
                logs_dir=str(tmp_path),
            )

        assert not isinstance(excinfo.value, UnboundLocalError)
        assert "no logdir" in str(excinfo.value.__context__)

    def test_空間結合はロガー初期化失敗でもUnboundLocalErrorにならない(self, tmp_path):
        """E016: get_rotating_logger の失敗が UnboundLocalError に化けない"""
        with (
            patch.object(e016, "create_or_update_job_task", _capture_recorder([])),
            patch.object(e016, "get_rotating_logger", side_effect=RuntimeError("no logdir")),
            pytest.raises(Exception) as excinfo,
        ):
            e016.process_data(
                tatemono_path=None,
                e14_merged_path=str(tmp_path / "e14.csv"),
                gpkg_path=None,
                option=None,
                output_type="csv",
                output_path=str(tmp_path),
                job_id=1,
                logs_dir=str(tmp_path),
            )

        assert not isinstance(excinfo.value, UnboundLocalError)
        assert "no logdir" in str(excinfo.value.__context__)


class TestSpecificCodeNotOverwritten:
    """固有コードが立っていればフォールバックで上書きしない"""

    def test_出力で固有コードが立っていればそのまま記録される(self, tmp_path):
        """E033: 先に立った E-30001 はフォールバックに置き換わらない"""
        calls: list = []

        def _raise_with_specific_code(*args, **kwargs):
            e033.set_error(e033.ERROR_30001)
            raise RuntimeError("boom")

        with (
            patch.object(e033, "create_or_update_job_task", _capture_recorder(calls)),
            patch.object(e033, "create_or_update_job", MagicMock()),
            patch.object(e033, "get_data_result_views", side_effect=_raise_with_specific_code),
            pytest.raises(Exception),
        ):
            e033.processing(
                {"output_path": str(tmp_path / "out.csv"), "view_id": 1},
                job_id=1,
                db_path=None,
            )

        record = _last_error_record(calls)
        assert record["error_code"] == "IF004_e033_err_import_path"
        assert "[E-30001]" in record["error_msg"]
