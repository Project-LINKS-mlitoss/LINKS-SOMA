"""エラーカタログ／文面レビューシート生成器の共有データソース（FR004-007 / #1849）。

error_catalog.py と message_review_sheet.py が同じ2ソースを読むため、
「要件網羅表 CSV の場所と読み方」「constants.ERROR_* の列挙契約」をここに一元化する。
どちらか一方だけが壊れる（片方はテスト無し）二重定義を避ける。
"""

from __future__ import annotations

import csv
from collections.abc import Iterator
from pathlib import Path

import constants

_REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_CSV = (
    _REPO_ROOT
    / "requirements"
    / "refinements"
    / "2026-05-07_FR004-007_必要エラー網羅リスト.csv"
)


def read_source_rows() -> list[dict[str, str]]:
    """要件網羅表 CSV を読む（BOM 付き utf-8）。"""
    with SOURCE_CSV.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def iter_error_constants() -> Iterator[tuple[str, dict]]:
    """constants.py の全 ERROR_* を (変数名, dict) で列挙する。
    「エラー定数とは何か」（ERROR_ 接頭辞・code/message を持つ dict）の契約を1箇所に持つ。"""
    for name in dir(constants):
        if not name.startswith("ERROR_"):
            continue
        value = getattr(constants, name)
        if isinstance(value, dict) and "code" in value and "message" in value:
            yield name, value
