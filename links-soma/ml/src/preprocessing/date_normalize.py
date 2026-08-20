"""正準な日付正規化（FR004-007）。

事前バリ `detectors.ts` の DATE_PATTERNS（網羅表が全日付列に規定する「和暦または西暦」）と
同一の受理集合を Python 側の単一正準として実装する。水道・住基・登記の各 loader（本体処理）は
これを使い、事前バリ（標本）と本体（実処理）が同じ日付受理集合で一致する。これにより
「事前は妥当と言うが本体が黙って NaN 化する」不整合を無くす。

受理形式（→ YYYYMMDD float。いずれにも当てはまらなければ NaN）:
  - 8桁 yyyymmdd（float 読み込みの "yyyymmdd.0" も同一視）
  - 区切り yyyy[/.-]m[.-/]d（例 2024-01-31 / 2024/1/3 / 2024.1.3）
  - yyyy年m月d日
  - 和暦（令和/平成/昭和/大正/明治 もしくは R/H/S/T/M、年月日 or 区切り）

出力は YYYYMMDD float（数値比較・ソートにそのまま使える）。妥当年は 1800〜2100・月日は範囲内。
coerce は値ごとのパースのため map を使う。
"""

from __future__ import annotations

import re

import pandas as pd

# 和暦の元号 → 改元前年（元年 = 改元前年 + 1）。1文字略号と漢字表記の両方を引けるようにする。
_ERA_OFFSETS = {
    "令和": 2018, "R": 2018,
    "平成": 1988, "H": 1988,
    "昭和": 1925, "S": 1925,
    "大正": 1911, "T": 1911,
    "明治": 1867, "M": 1867,
}
_ERA_KEYS = "令和|平成|昭和|大正|明治|[RHSTMrhstm]"

_RE_FLOAT8 = re.compile(r"^(\d{8})\.0$")
_RE_8 = re.compile(r"^(\d{4})(\d{2})(\d{2})$")
_RE_SEP = re.compile(r"^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$")
_RE_KANJI = re.compile(r"^(\d{4})年(\d{1,2})月(\d{1,2})日$")
_RE_ERA = re.compile(
    rf"^({_ERA_KEYS})\s?(\d{{1,2}})(?:年|[./-])(\d{{1,2}})(?:月|[./-])(\d{{1,2}})日?$"
)


def _compose(year: int, month: int, day: int) -> float:
    """(年, 月, 日) を YYYYMMDD float に合成する。妥当範囲外は NaN。

    月日は範囲のみ検証する（月1〜12・日1〜31）。実在しえない値（13月・45日等）を通すと、
    壊れた日付が巨大数となり、record_linkage の最新選択ソートや調査基準日フィルタ（例:
    water.py の usage_start_date <= cutoff）を汚すため NaN にする。暦の実在（2月30日等）
    までは検証しない（重い値ごと変換を避け、正常データの誤検出も避ける）。
    """
    if not 1800 <= year <= 2100:
        return float("nan")
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return float("nan")
    return float(year * 10000 + month * 100 + day)


def _to_yyyymmdd(val) -> float:
    if pd.isna(val):
        return float("nan")
    s = str(val).strip()
    if s in ("", "nan", "None", "NaN"):
        return float("nan")
    m = _RE_FLOAT8.match(s)
    if m:
        s = m.group(1)
    m = _RE_8.match(s)
    if m:
        return _compose(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = _RE_SEP.match(s)
    if m:
        return _compose(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = _RE_KANJI.match(s)
    if m:
        return _compose(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = _RE_ERA.match(s)
    if m:
        era = m.group(1)
        offset = _ERA_OFFSETS.get(era) or _ERA_OFFSETS.get(era.upper())
        if offset is None:
            return float("nan")
        return _compose(offset + int(m.group(2)), int(m.group(3)), int(m.group(4)))
    return float("nan")


def normalize_date_series(series: pd.Series) -> pd.Series:
    """日付列を YYYYMMDD float へ正規化する（不能は NaN）。純関数。"""
    return series.map(_to_yyyymmdd)
