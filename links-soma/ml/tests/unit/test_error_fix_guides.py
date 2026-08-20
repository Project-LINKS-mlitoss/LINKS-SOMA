"""エラー修正方法（fix guide）の単体テスト（FR006 / #1786）。

ねらい:
- guide のキー（表示用コード）が実在のエラーコードに対応する（孤児 guide を作らない）
- guide の構造が UI/型定義（what / accepted / examples）に一致する
- get_error_detail が guide 付きコードにだけ fix_guide を相乗せする
"""

from error_fix_guides import FIX_GUIDE_BY_DISPLAY_CODE, get_fix_guide
from error_registry import ERROR_RESPONSIBILITY, get_error_detail


def _registered_display_codes() -> set[str]:
    """ERROR_RESPONSIBILITY が持つ表示用コード（空文字除く）。"""
    return {code for _, code in ERROR_RESPONSIBILITY.values() if code}


class TestFixGuideKeys:
    """キー整合: guide は実在の表示用コードに紐づく"""

    def test_全guideキーが登録済み表示用コードに対応する(self):
        orphan = set(FIX_GUIDE_BY_DISPLAY_CODE) - _registered_display_codes()
        assert orphan == set(), f"実在しない表示用コードの guide: {orphan}"


class TestFixGuideStructure:
    """構造: UI/型定義（what / accepted / examples）に一致"""

    def test_各guideがwhatを持ち受理形式と修正例が型どおり(self):
        for code, guide in FIX_GUIDE_BY_DISPLAY_CODE.items():
            assert isinstance(guide.get("what"), str) and guide["what"], code
            accepted = guide.get("accepted", [])
            assert isinstance(accepted, list)
            assert all(isinstance(line, str) and line for line in accepted), code
            examples = guide.get("examples", [])
            assert isinstance(examples, list)
            for ex in examples:
                assert set(ex) == {"before", "after"}, code
                assert ex["before"] and ex["after"], code


class TestGetFixGuide:
    """引き当て"""

    def test_未登録コードはNone(self):
        assert get_fix_guide("E-9999") is None
        assert get_fix_guide(None) is None

    def test_文字コードコードは文字コードguide(self):
        guide = get_fix_guide("E-0008")
        assert guide is not None
        assert "UTF-8" in " ".join(guide["accepted"])


class TestErrorDetailRelay:
    """get_error_detail への相乗せ: guide のあるコードだけ付与"""

    def test_guide付きコードはerror_detailにfix_guideを含む(self):
        # E-0025 = 空間結合データの文字コード（文字コードguide）
        detail = get_error_detail("IF001_e016_err_encoding")
        assert detail["display_code"] == "E-0025"
        assert "fix_guide" in detail
        assert detail["fix_guide"]["what"]

    def test_説明変数型不一致はfeature_numericのguide(self):
        detail = get_error_detail("IF002_e021_err_feature_non_numeric")
        assert detail["display_code"] == "E-201"
        assert "fix_guide" in detail
        assert "数値" in detail["fix_guide"]["what"]

    def test_guideなしコードはfix_guideを含まない(self):
        # E-0001 = 出力エンコーディング失敗（開発者相談・マニュアル修正手順なし）
        detail = get_error_detail("IF001_e012_err_export_encoding")
        assert detail["display_code"] == "E-0001"
        assert "fix_guide" not in detail
