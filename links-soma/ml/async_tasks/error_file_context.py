"""エラー文面へ「どの登録ファイルで起きたか」を添える文脈解決（FR004-007 / #1849）。

名寄せのエラーは「どのファイルの処理で起きたか」が分からないと自治体が直せない
（Box メッセージレビューの最多FB）。登録ファイル名（例 err_status_noaddr.csv）は
app 側 SQLite の raw_data_sets.file_name にのみ在り、payload の path（＝file_path・
UUID内部名）をキーに引ける。本モジュールは DB 非依存の純関数として、payload の
data_dict と DB から読んだ {file_path: file_name} から、エラー文面の先頭へ添える
「対象ファイル」文脈を組み立てる。DB I/O は utils.fetch_raw_dataset_file_names が担う。

データ種別名（水道使用量 等）は職員が名寄せウィザードで見た語彙に合わせる
（app/src/shared/config/lang.ts / src/preprocessing/import_validation.py の
_DATASET_LABEL_JA と同一）。canonical 名（パイプライン内部名）は payload スロットキー
（water_status 等）と異なるため両者の対応を持つ。
"""

from __future__ import annotations

import os

# payload スロットキー → データ種別の職員向け表示名。名寄せ入力の record linkage 4 種のみ。
# 文字コード判別不能（E-0008）・必須カラム未指定（E-101）が対象とする入力に一致する。
# 未登録スロットは表示名なし（ファイル名のみ）へフォールバックする。
SLOT_TO_LABEL: dict[str, str] = {
    "water_status": "水道閉開栓状況",
    "water_usage": "水道使用量",
    "resident_registry": "住民基本台帳",
    "building_registry": "登記情報",
}

# canonical 名（import_validation の dataset ラベル）→ payload スロットキー。
# MissingRequiredColumnsError.dataset は canonical 名で来るため path 解決に変換する。
CANONICAL_TO_SLOT: dict[str, str] = {
    "suido_status": "water_status",
    "suido_use": "water_usage",
    "juki": "resident_registry",
    "touki": "building_registry",
}

# 実行時にファイル文脈を先頭へ添えるエラー（表示用コード）。message_review 生成器が
# レビューシートに「実行時挿入」を明示するためにも参照する。
FILE_CONTEXT_DISPLAY_CODES: frozenset[str] = frozenset(
    {"E-0008", "E-101", "E-102", "E-103"}
)

# 文脈行の見出し。職員が本文とファイル名を切り分けられるようにする目印。
FILE_CONTEXT_MARKER = "【対象ファイル】"

# レビューシート用の実行時挿入の例示（PM が反映を確認できるようにする）。
RUNTIME_FILE_CONTEXT_NOTE = (
    f"{FILE_CONTEXT_MARKER}〈実行時に挿入: 例 err_status_noaddr.csv（水道閉開栓状況）〉"
)


def file_context_prefix(file_name: str | None, data_type: str | None = None) -> str:
    """「対象ファイル」文脈の1行を組み立てる。file_name が無ければ空文字。

    data_type があれば「file_name（data_type）」、無ければ file_name のみを添える。
    """
    if not file_name:
        return ""
    if data_type:
        return f"{FILE_CONTEXT_MARKER}{file_name}（{data_type}）"
    return f"{FILE_CONTEXT_MARKER}{file_name}"


def prepend_file_context(message: str, prefix: str) -> str:
    """メッセージ本文の先頭へ文脈行を添える。prefix が空なら本文をそのまま返す。"""
    return f"{prefix}\n{message}" if prefix else message


def build_path_label_map(data_dict: dict) -> dict[str, str]:
    """payload の data_dict から {file_path(basename): データ種別表示名} を作る。

    各スロットの path（file_path・UUID内部名）を basename で正規化し、SLOT_TO_LABEL で
    表示名へ引く。未登録スロットは空文字（ファイル名のみ表示）にフォールバックする。
    """
    out: dict[str, str] = {}
    for slot, entry in data_dict.items():
        if isinstance(entry, dict) and entry.get("path"):
            key = os.path.basename(str(entry["path"]))
            out[key] = SLOT_TO_LABEL.get(slot, "")
    return out


def resolve_by_path(
    path: str | None, name_map: dict[str, str], label_map: dict[str, str]
) -> str:
    """ファイルパスから「対象ファイル」文脈を解決する（E-0008 用）。

    path の basename を file_path として name_map（{file_path: file_name}）で登録名を、
    label_map（{file_path: 種別名}）で種別名を引く。登録名が無ければ空文字。
    """
    if not path:
        return ""
    key = os.path.basename(str(path))
    file_name = name_map.get(key)
    if not file_name:
        return ""
    return file_context_prefix(file_name, label_map.get(key) or None)


def annotate_registered_files(message: str, name_map: dict[str, str]) -> str:
    """メッセージ中に現れる内部ファイル名(UUID・file_path)を登録ファイル名へ置換する。

    記録の単一口 create_or_update_job_task で全エラー横断に適用する。path を本文に埋める
    エラー（例「ファイル {param_st1} の読み込みに失敗」）は param_st1 に file_path が入るため、
    ここで登録名（err_polygon.gpkg 等）へ置き換わり「どのファイルか」が分かる。name_map に
    無いパス（中間生成物・出力UUID）は素通しする。basename 一致で拾うためフルパスでも効く。
    """
    if not message or not name_map:
        return message
    for file_path, file_name in name_map.items():
        if file_path and file_name and file_path in message:
            message = message.replace(file_path, file_name)
    return message


def resolve_by_datasets(
    canonicals: list[str], data_dict: dict, name_map: dict[str, str]
) -> str:
    """複数の canonical データセット名から「対象ファイル」文脈を解決する（E-103 用）。

    E-103 は2ファイルの突き合わせで判明し、どちら側の割り当てが誤りかは特定できない。
    関与したファイルを併記して、両方を確認できるようにする。本文にも種別名は入るが、
    解決できたファイルだけを並べる以上、本文の並びとファイル名の並びは対応を保証できない。
    各ファイル名に種別名を添えて、その行だけでどの種別のファイルかを読めるようにする。
    1つも解決できなければ空文字。
    """
    parts: list[str] = []
    for canonical in canonicals:
        slot = CANONICAL_TO_SLOT.get(canonical)
        if not slot:
            continue
        entry = data_dict.get(slot)
        if not isinstance(entry, dict) or not entry.get("path"):
            continue
        file_name = name_map.get(os.path.basename(str(entry["path"])))
        if not file_name:
            continue
        label = SLOT_TO_LABEL.get(slot, "")
        parts.append(f"{file_name}（{label}）" if label else file_name)
    if not parts:
        return ""
    return f"{FILE_CONTEXT_MARKER}{'・'.join(parts)}"


def resolve_by_dataset(
    canonical: str, data_dict: dict, name_map: dict[str, str]
) -> str:
    """canonical データセット名から「対象ファイル」文脈を解決する（E-101 用）。

    canonical → payload スロット → path → 登録名 を辿る。E-101 の本文には種別名が
    既に含まれるため、ここではファイル名のみを添える。解決不能なら空文字。
    """
    slot = CANONICAL_TO_SLOT.get(canonical)
    if not slot:
        return ""
    entry = data_dict.get(slot)
    if not isinstance(entry, dict) or not entry.get("path"):
        return ""
    file_name = name_map.get(os.path.basename(str(entry["path"])))
    if not file_name:
        return ""
    return file_context_prefix(file_name)
