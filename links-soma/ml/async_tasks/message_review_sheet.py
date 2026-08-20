"""メッセージ文面レビューシート生成器（FR004-007 / #1849・報告用）。

ユーザーが画面で目にする全文面を1枚の CSV に棚卸しし、PM が文面・対応内容・修正内容の
修正依頼／FB を出せるようにする。恒久カタログ（error-catalog.csv）とは別の報告物。

構成:
- 1行目 = 読み方の補足（【画面】＝実表示 / 【内部】＝場所特定用の参考）
- 事後エラー = 1エラー1行。文面・対応チップ・次アクション・修正方法（何が問題/正しい形式/例）を横並び
- 事前目安 = データチェックパネルの文面（別セクション）

文面がどの画面要素かをヘッダ接頭辞で自明にする:
- 【画面】       … その文面がそのまま画面に出る（レビュー対象）
- 【画面・トグル内】… 「修正方法を見る」を開くと出る
- 【内部】       … 画面に出ない参考（表示コード・エラー名・編集先ファイル）

文面の出所（編集先）:
- メッセージ本文 … ml/async_tasks/constants.py
- 対応チップ     … app/src/shared/config/lang.ts（errorDisplay.action）
- 次アクション   … ml/async_tasks/error_registry.py（責任分界別 定型）
- 修正方法       … ml/async_tasks/error_fix_guides.py
- 事前目安       … app/src/shared/config/lang.ts（normalizationPreValidation ほか）

実行: ml で `poetry run python async_tasks/message_review_sheet.py`
      （npm: `npm run gen:message-review`）
"""

from __future__ import annotations

import csv
import io
import re
from pathlib import Path

from error_file_context import FILE_CONTEXT_DISPLAY_CODES, RUNTIME_FILE_CONTEXT_NOTE
from error_fix_guides import FIX_GUIDE_BY_DISPLAY_CODE
from error_registry import ERROR_RESPONSIBILITY, NEXT_ACTION_BY_RESPONSIBILITY
from error_sources import iter_error_constants, read_source_rows

_REPO_ROOT = Path(__file__).resolve().parents[2]
LANG_TS = _REPO_ROOT / "app" / "src" / "shared" / "config" / "lang.ts"
# 事後と事前は列構成が違う（9列 / 5列）ため、同一シートに混在させると列が噛み合わない。
# レビュー対象として別物なのでファイルを分ける。
_REFINEMENTS = _REPO_ROOT / "requirements" / "refinements"
OUTPUT_POST_CSV = _REFINEMENTS / "FR004-007_メッセージレビュー_事後エラー.csv"
OUTPUT_PRE_CSV = _REFINEMENTS / "FR004-007_メッセージレビュー_事前目安.csv"

POST_NOTE = (
    "【読み方】【画面】=ユーザーが画面で見る文面（レビュー対象）／"
    "【画面・トグル内】=「修正方法を見る」を開くと表示／"
    "【内部】=画面に出ない参考情報（場所特定用）。"
    "文面を直すときは【内部】編集先の該当ファイルを修正して再生成する。"
)
PRE_NOTE = (
    "【読み方】【画面】=データチェックパネルに出る文面（レビュー対象）／"
    "【内部】=画面に出ない参考情報（着地・編集先）。"
    "文面を直すときは【内部】編集先の該当ファイルを修正して再生成する。"
)

POST_HEADERS = [
    "【内部/本文内】表示コード",
    "【画面】メッセージ本文",
    "【画面】対応チップ",
    "【画面】次アクション",
    "【画面・トグル内】何が問題",
    "【画面・トグル内】正しい形式",
    "【画面・トグル内】修正例",
    "【内部】エラー名",
    "【内部】編集先",
]

PRE_HEADERS = [
    "【内部】PVコード",
    "【画面】種類ラベル",
    "【画面】メッセージ本文",
    "【内部】着地(コード検証)",
    "【内部】編集先",
]

_NONE = "—"
_JOIN = " ／ "
_KV = re.compile(r'([^\s:{}]+):\s*"((?:[^"\\]|\\.)*)"')


def _lang_block(content: str, start_marker: str, end_marker: str) -> str:
    start = content.index(start_marker)
    end = content.index(end_marker, start)
    return content[start:end]


def _display_code(message: str) -> str:
    m = re.search(r"\[(E-[\w-]+)\]", message)
    return m.group(1) if m else ""


def _action_chip_map() -> dict[str, str]:
    """責任分界（内部値）→ 対応チップの画面文言（lang.ts errorDisplay.action）。"""
    content = LANG_TS.read_text(encoding="utf-8")
    block = _lang_block(content, "errorDisplay: {", '"threshold-assistant"')
    action = _lang_block(block, "action: {", "}")
    return {m.group(1): m.group(2) for m in _KV.finditer(action)}


def _error_names() -> dict[str, str]:
    """必要エラー網羅表から 内部識別子/表示コード → エラー名 を引く。"""
    by_internal: dict[str, str] = {}
    by_display: dict[str, str] = {}
    for row in read_source_rows():
        name = (row.get("エラー名") or "").strip()
        code = (row.get("内部識別子") or "").strip()
        disp = (row.get("表示用コード") or "").strip()
        if code and code not in ("-",):
            by_internal.setdefault(code, name)
        if disp and disp not in ("-",):
            by_display.setdefault(disp, name)
    return {"internal": by_internal, "display": by_display}


def _fix_cells(display_code: str) -> tuple[str, str, str]:
    """修正ガイド（何が問題 / 正しい形式 / 修正例）。無ければ — 。"""
    guide = FIX_GUIDE_BY_DISPLAY_CODE.get(display_code)
    if not guide:
        return _NONE, _NONE, _NONE
    what = guide.get("what", "") or _NONE
    accepted = _JOIN.join(guide.get("accepted", [])) or _NONE
    examples = (
        _JOIN.join(
            f"{e.get('before', '')} → {e.get('after', '')}"
            for e in guide.get("examples", [])
        )
        or _NONE
    )
    return what, accepted, examples


def _post_error_rows() -> list[list[str]]:
    """事後エラー: 1エラー1行。文面・対応・修正を横並び。"""
    chip = _action_chip_map()
    names = _error_names()
    rows: list[list[str]] = []
    for name, value in iter_error_constants():
        code = value["code"]
        message = value["message"]
        responsibility, display_code = ERROR_RESPONSIBILITY.get(code, ("", ""))
        display_code = display_code or _display_code(message)
        # 実行時に先頭へ「対象ファイル」を添えるエラーは、レビューシートでもそれを明示する
        if display_code in FILE_CONTEXT_DISPLAY_CODES:
            message = f"{RUNTIME_FILE_CONTEXT_NOTE}\n{message}"
        what, accepted, examples = _fix_cells(display_code)
        error_name = (
            names["internal"].get(code)
            or names["display"].get(display_code)
            or ""
        )
        editable = f"constants.{name}"
        if responsibility:
            editable += " / registry"
        if FIX_GUIDE_BY_DISPLAY_CODE.get(display_code):
            editable += " / fix_guides"
        rows.append(
            [
                display_code,
                message,
                chip.get(responsibility, ""),
                NEXT_ACTION_BY_RESPONSIBILITY.get(responsibility, ""),
                what,
                accepted,
                examples,
                error_name,
                editable,
            ]
        )
    return sorted(rows, key=lambda r: r[0])


def _pre_validation_rows() -> list[list[str]]:
    """事前目安: データチェックパネルの文面（lang.ts）。着地はコード実在で判定。"""
    content = LANG_TS.read_text(encoding="utf-8")
    rows: list[list[str]] = []

    block = _lang_block(
        content, "normalizationPreValidation: {", '"form-normalization"'
    )
    # サブセクション（labels / messages / panel）を位置で解決し着地を注記する。
    sections = [
        (m.start(), m.group(1))
        for m in re.finditer(r"(labels|messages|panel): \{", block)
    ]

    def section_of(pos: int) -> str:
        current = ""
        for at, label in sections:
            if at <= pos:
                current = label
            else:
                break
        return current

    # 検出器が実装済みの観点キー（実装済み文面の判定に使う）。
    detector_keys = {
        "uniquenessDuplicate",
        "uniquenessClear",
        "uniquenessUnknown",
        "numericInvalid",
        "valueRangeOut",
        "dateFormatInvalid",
        "noMatchUnknown",
        "missingValueDetected",
        "missingValueUnknown",
        "referenceParentMissing",
        "referenceNotFound",
        "referenceClear",
        "referenceUnknown",
        "encodingNotUtf8",
        "dateOrderReversed",
        "dateOrderUnknown",
    }
    for m in _KV.finditer(block):
        key, text = m.group(1), m.group(2)
        if key in ("labels", "messages", "panel"):
            continue
        sec = section_of(m.start())
        if sec == "labels":
            landing = "画面部品（常時表示）"
        elif key in detector_keys:
            landing = "実装済み(検出器)"
        else:
            landing = "画面部品（パネル文言）"
        rows.append(
            [
                "",
                {"labels": "種類ラベル", "messages": "メッセージ", "panel": "パネル"}.get(
                    sec, "パネル"
                ),
                text,
                landing,
                f"lang.ts normalizationPreValidation.{key}",
            ]
        )

    # 必須選択（PV-17・zod）
    val_block = _lang_block(content, '"form-normalization": {', "requiredDataSection")
    for m in _KV.finditer(val_block):
        rows.append(
            [
                "PV-17",
                "必須選択",
                m.group(2),
                "実装済み(zod・送信ゲート)",
                f"lang.ts form-normalization.validation.{m.group(1)}",
            ]
        )
    return rows


def _note_row(note: str, width: int) -> list[str]:
    """補足を2列目に置き、全体を width 列に揃える（列数不整合でのビューア崩れ防止）。"""
    row = ["", note]
    return row + [""] * (width - len(row))


def build_post_sheet() -> list[list[str]]:
    """事後エラーの CSV 全行（読み方補足 + ヘッダ + データ）。"""
    rows: list[list[str]] = [_note_row(POST_NOTE, len(POST_HEADERS)), POST_HEADERS]
    rows.extend(_post_error_rows())
    return rows


def build_pre_sheet() -> list[list[str]]:
    """事前目安の CSV 全行（読み方補足 + ヘッダ + データ）。"""
    rows: list[list[str]] = [_note_row(PRE_NOTE, len(PRE_HEADERS)), PRE_HEADERS]
    rows.extend(_pre_validation_rows())
    return rows


def render_csv(rows: list[list[str]]) -> str:
    # 全フィールドを引用符で囲む。区切りのカンマや改行を含むセルでも、緩いビューア
    # （Box の表計算プレビュー等）が列を取り違えないようにする。
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n", quoting=csv.QUOTE_ALL)
    writer.writerows(rows)
    return buffer.getvalue()


def write_sheets() -> tuple[Path, Path]:
    _REFINEMENTS.mkdir(parents=True, exist_ok=True)
    OUTPUT_POST_CSV.write_text(
        render_csv(build_post_sheet()), encoding="utf-8-sig", newline=""
    )
    OUTPUT_PRE_CSV.write_text(
        render_csv(build_pre_sheet()), encoding="utf-8-sig", newline=""
    )
    return OUTPUT_POST_CSV, OUTPUT_PRE_CSV


if __name__ == "__main__":
    post_path, pre_path = write_sheets()
    print(f"生成: {post_path} （事後エラー {len(_post_error_rows())} 行）")
    print(f"生成: {pre_path} （事前目安 {len(_pre_validation_rows())} 行）")
