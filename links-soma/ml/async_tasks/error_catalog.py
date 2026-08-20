"""エラーカタログ生成器（FR004-007 / #1849）。

全エラー項目（内容・対象・発生条件）とメッセージ対応を1枚の CSV に束ねる。
情報源は3つ。内部識別子（code）で JOIN する:

- 要件網羅表 CSV（requirements/refinements/...必要エラー網羅リスト.csv）
    … エラー名・ブロック・タイミング・発生条件（要件側の SSOT・人が編集）
- error_registry.py … 責任分界・表示コード（コード側の SSOT）
- constants.py … メッセージ本文（コード側の SSOT）

出力（docs/spec/appendix/error-catalog.csv）は生成物。手で編集しない。
再生成して差分ゼロを test_error_catalog が縛るため、コードを直せばカタログも
必ず追従する（手動注記による齟齬防止が不要になる）。

実行: ml ディレクトリで `poetry run python async_tasks/error_catalog.py`
（npm script: `npm run gen:error-catalog`）
"""

from __future__ import annotations

import csv
import io
from pathlib import Path

from error_registry import ERROR_RESPONSIBILITY
from error_sources import iter_error_constants, read_source_rows

_REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_CSV = _REPO_ROOT / "docs" / "spec" / "appendix" / "error-catalog.csv"

# 出力列。日本語はこの生成レイヤーにのみ現れる（コード側のキーは英語）。
# 恒久カタログは時制非依存の項目のみ。実装状況（報告用）・R番号（要件網羅表への参照）は
# ここに持たない（前者は構造上つねに実在=済で情報量ゼロ、後者は報告物側の索引）。
HEADERS = [
    "表示コード",
    "エラー名",
    "ブロック",
    "タイミング",
    "発生条件",
    "メッセージ本文",
    "責任分界",
    "内部識別子",
]

# registry にあるが constants に本文を持たないコード（実行時に例外文字列を表示）。
_DYNAMIC_MESSAGE = "（実行時の例外メッセージをそのまま表示）"


def _messages_by_code() -> dict[str, str]:
    """constants.py の全 ERROR_* を 内部識別子(code) → メッセージ本文 に索引する。"""
    return {value["code"]: value["message"] for _name, value in iter_error_constants()}


def _implemented(code: str) -> bool:
    """コードとして実在するか。registry 登録が「システムに配線済み」の判定。"""
    return code in ERROR_RESPONSIBILITY


def _catalog_row(code: str, messages: dict[str, str], src: dict[str, str]) -> dict[str, str]:
    """1エラー分のカタログ行を組む。コード側を正、要件側で説明文を補う。"""
    responsibility, display_code = ERROR_RESPONSIBILITY.get(code, ("", ""))
    if code in messages:
        message = messages[code]
    elif _implemented(code):
        message = _DYNAMIC_MESSAGE
    else:
        message = ""
    return {
        "表示コード": display_code,
        "エラー名": src.get("エラー名", ""),
        "ブロック": src.get("ブロック", ""),
        "タイミング": src.get("タイミング", ""),
        "発生条件": src.get("発生条件", ""),
        "メッセージ本文": message,
        "責任分界": responsibility,
        "内部識別子": code,
    }


def build_catalog_rows() -> list[dict[str, str]]:
    """カタログ全行を組む。網羅表の順（R-001..）を正準順とし、
    網羅表に無いコード側エラーは末尾に追加する。"""
    messages = _messages_by_code()
    source_rows = read_source_rows()

    rows: list[dict[str, str]] = []
    seen_codes: set[str] = set()
    for src in source_rows:
        code = (src.get("内部識別子") or "").strip()
        if not code or code == "-":
            continue
        seen_codes.add(code)
        rows.append(_catalog_row(code, messages, src))

    # 網羅表に載っていない、コード側にだけ存在するエラー（逆方向の抜け）。
    for code in sorted(set(ERROR_RESPONSIBILITY) - seen_codes):
        rows.append(_catalog_row(code, messages, {}))

    return rows


def _norm_code(value: str) -> str:
    """「コード未付与」の表記ゆれを吸収する。網羅表は '-'、registry は '' を使う。"""
    value = (value or "").strip()
    return "" if value == "-" else value


def detect_drift() -> list[str]:
    """要件網羅表とコード（registry）の食い違いを検出する。
    網羅表の表示コード・責任分界が registry と一致しない行を返す。"""
    mismatches: list[str] = []
    for src in read_source_rows():
        code = (src.get("内部識別子") or "").strip()
        if not code or code == "-" or code not in ERROR_RESPONSIBILITY:
            continue
        responsibility, display_code = ERROR_RESPONSIBILITY[code]
        csv_code = _norm_code(src.get("表示用コード", ""))
        csv_resp = (src.get("責任分界") or "").strip()
        if csv_code != display_code:
            mismatches.append(
                f"{code}: 表示コード 網羅表={csv_code!r} / registry={display_code!r}"
            )
        if csv_resp != responsibility:
            mismatches.append(
                f"{code}: 責任分界 網羅表={csv_resp!r} / registry={responsibility!r}"
            )
    return mismatches


def render_csv(rows: list[dict[str, str]]) -> str:
    """カタログ行を CSV 文字列に描画する（改行は LF 固定・golden 比較を安定させる）。"""
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer, fieldnames=HEADERS, lineterminator="\n", extrasaction="ignore"
    )
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def write_catalog() -> Path:
    """カタログを生成してファイルに書く（Excel 向けに BOM 付き utf-8）。"""
    content = render_csv(build_catalog_rows())
    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_CSV.write_text(content, encoding="utf-8-sig", newline="")
    return OUTPUT_CSV


if __name__ == "__main__":
    drift = detect_drift()
    if drift:
        print("警告: 網羅表とコードに食い違いがあります:")
        for line in drift:
            print(f"  - {line}")
    path = write_catalog()
    rows = build_catalog_rows()
    print(f"生成: {path} ({len(rows)} 件)")
