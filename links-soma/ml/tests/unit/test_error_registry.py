"""エラーコード一元レジストリ（FR006・責任分界＋次アクション）の単体テスト。

ねらいは「constants.py の全 ERROR_* が責任分界・次アクションを持つ」ことの機械保証。
新規エラーを足してレジストリ追記を忘れると、test_全てのERROR定数が... が落ちて気付ける。
"""

import json

import constants
from error_registry import (
    ERROR_RESPONSIBILITY,
    NEXT_ACTION_BY_RESPONSIBILITY,
    RESPONSIBILITY_CONTEXT,
    RESPONSIBILITY_DEVELOPER,
    RESPONSIBILITY_SELF_FIX,
    VALID_RESPONSIBILITIES,
    build_error_result,
    get_error_detail,
)


def _all_constants_codes() -> list[str]:
    """constants.py に定義された全 ERROR_* の内部識別子（code）を集める。"""
    return list(_messages_by_code().keys())


def _messages_by_code() -> dict[str, str]:
    """constants.py の全 ERROR_* を 内部識別子(code) → message に索引する。"""
    out: dict[str, str] = {}
    for name in dir(constants):
        if not name.startswith("ERROR_"):
            continue
        value = getattr(constants, name)
        if isinstance(value, dict) and "code" in value and "message" in value:
            out[value["code"]] = value["message"]
    return out


class TestRegistryCompleteness:
    """網羅性: 全 ERROR_* が責任分界を持つ"""

    def test_全てのERROR定数がレジストリに登録されている(self):
        missing = [c for c in _all_constants_codes() if c not in ERROR_RESPONSIBILITY]
        assert missing == [], f"レジストリ未登録のエラーコード: {missing}"

    def test_全責任分界が有効な3値のいずれか(self):
        invalid = {
            resp
            for resp, _ in ERROR_RESPONSIBILITY.values()
            if resp not in VALID_RESPONSIBILITIES
        }
        assert invalid == set(), f"未定義の責任分界: {invalid}"

    def test_3つの責任分界それぞれに次アクション定型がある(self):
        for resp in VALID_RESPONSIBILITIES:
            assert NEXT_ACTION_BY_RESPONSIBILITY[resp]

    def test_表示用コードが対応メッセージのEコードと一致する(self):
        """レジストリの display_code が constants.py メッセージ末尾 [E-XXXX] と一致することを保証する。

        display_code は「レジストリ」と「メッセージ文字列」の2箇所に手書きされる。片方だけ
        採番し直すと UI のコード表示と fix_guide 引き当てがズレるため、その不整合を機械検出する。
        表示用コード未付与（空文字）の内部 raise 系は対象外。
        """
        messages = _messages_by_code()
        drift = []
        for code, (_resp, display_code) in ERROR_RESPONSIBILITY.items():
            if not display_code:
                continue
            message = messages.get(code)
            if message is None:
                continue
            if f"[{display_code}]" not in message:
                drift.append((code, display_code))
        assert drift == [], f"display_code がメッセージの[E-XXXX]と不一致: {drift}"


class TestGetErrorDetail:
    """引き当て: 内部識別子→責任分界・次アクション・表示用コード"""

    def test_全コードで次アクションが非空で返る(self):
        for code in _all_constants_codes():
            detail = get_error_detail(code)
            assert detail["responsibility"] in VALID_RESPONSIBILITIES
            assert detail["next_action"]

    def test_開発者相談コードの代表例(self):
        detail = get_error_detail("IF001_e012_err_export_encoding")
        assert detail["responsibility"] == RESPONSIBILITY_DEVELOPER
        assert detail["display_code"] == "E-0001"
        assert detail["next_action"] == NEXT_ACTION_BY_RESPONSIBILITY[RESPONSIBILITY_DEVELOPER]

    def test_自治体修正コードの代表例(self):
        detail = get_error_detail("IF001_err_no_input_files")
        assert detail["responsibility"] == RESPONSIBILITY_SELF_FIX
        assert detail["display_code"] == "E-0051"

    def test_未登録コードは状況依存にフォールバックし表示が空にならない(self):
        detail = get_error_detail("UNKNOWN_NEVER_DEFINED")
        assert detail["responsibility"] == RESPONSIBILITY_CONTEXT
        assert detail["next_action"]
        assert detail["display_code"] == ""

    def test_Noneでも落ちず状況依存(self):
        detail = get_error_detail(None)
        assert detail["responsibility"] == RESPONSIBILITY_CONTEXT
        assert detail["next_action"]


class TestBuildErrorResult:
    """result JSON へのエラー詳細の相乗り（UIへ流す）"""

    def test_空resultにerror_detailを載せる(self):
        out = json.loads(build_error_result(json.dumps({}), "IF001_e012_err_export_encoding"))
        assert out["error_detail"]["responsibility"] == RESPONSIBILITY_DEVELOPER
        assert out["error_detail"]["display_code"] == "E-0001"
        assert out["error_detail"]["next_action"]

    def test_既存resultのキーを壊さない(self):
        out = json.loads(
            build_error_result(json.dumps({"rows": 100}), "IF001_err_no_input_files")
        )
        assert out["rows"] == 100
        assert out["error_detail"]["responsibility"] == RESPONSIBILITY_SELF_FIX

    def test_Noneや不正JSONでも落ちずerror_detailを載せる(self):
        for bad in [None, "", "not-json", "[1,2,3]"]:
            out = json.loads(build_error_result(bad, "IF001_err_data"))
            assert out["error_detail"]["responsibility"] == RESPONSIBILITY_CONTEXT
