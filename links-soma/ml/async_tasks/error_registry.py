"""エラーコード一元レジストリ（FR006・責任分界＋次アクション）。

constants.py の各 ERROR_* が持つ内部識別子（code）を、責任分界（誰が直すか）と
次アクション（次に何をすればよいか）へ対応づける。必要エラー網羅表
（requirements/refinements/2026-05-07_FR004-007_必要エラー網羅リスト.csv）の
「責任分界」列を SSOT として表現する。

目的: ユーザーが名寄せ〜推定でつまづいたとき、止まった原因に「何が問題か（責任分界）」
「次にどうすべきか（次アクション）」を添えて示す。表示（FR006 UI）はこのレジストリ由来の
情報を error_msg に重ねる。全 ERROR_* がレジストリに載ることは
tests/unit/test_error_registry.py が機械的に保証する。
"""

from __future__ import annotations

import json

from error_fix_guides import get_fix_guide

# 責任分界（誰が直すか）。網羅表「責任分界」列の値。
RESPONSIBILITY_SELF_FIX = "自治体修正"
RESPONSIBILITY_DEVELOPER = "開発者に相談"
RESPONSIBILITY_CONTEXT = "状況依存"

VALID_RESPONSIBILITIES = frozenset(
    {RESPONSIBILITY_SELF_FIX, RESPONSIBILITY_DEVELOPER, RESPONSIBILITY_CONTEXT}
)

# 次アクション（次に何をするか）。責任分界から導く定型。具体的手順は各 message が持つ。
NEXT_ACTION_BY_RESPONSIBILITY = {
    RESPONSIBILITY_SELF_FIX: (
        "入力データ側の問題です。メッセージの指示に従ってデータを修正し、再実行してください。"
    ),
    RESPONSIBILITY_DEVELOPER: (
        "システム内部の問題の可能性があります。解決しない場合は開発元へお問い合わせください。"
    ),
    RESPONSIBILITY_CONTEXT: (
        "データと設定の両面をご確認ください。原因が特定できない場合は開発元へお問い合わせください。"
    ),
}

# 内部識別子 → (責任分界, 表示用コード)。網羅表から導出。
# 新規コードを constants.py に足したらここにも追記する（test_error_registry が欠落を検出）。
ERROR_RESPONSIBILITY: dict[str, tuple[str, str]] = {
    "IF001_e012_err_cleaning": (RESPONSIBILITY_SELF_FIX, "E-0005"),
    "IF001_e012_err_create_data_processed": (RESPONSIBILITY_SELF_FIX, "E-0036"),
    "IF001_e012_err_export_encoding": (RESPONSIBILITY_DEVELOPER, "E-0001"),
    "IF001_e012_err_file_loading": (RESPONSIBILITY_SELF_FIX, "E-0004"),
    "IF001_e012_err_import_format": (RESPONSIBILITY_SELF_FIX, "E-0003"),
    "IF001_e012_err_water_usage": (RESPONSIBILITY_SELF_FIX, "E-0035"),
    "IF001_e013_err_encoding": (RESPONSIBILITY_SELF_FIX, "E-0008"),
    "IF001_e013_err_file_loading": (RESPONSIBILITY_SELF_FIX, "E-0007"),
    "IF001_e014_err_encoding": (RESPONSIBILITY_SELF_FIX, "E-0027"),
    "IF001_e014_err_export_encoding": (RESPONSIBILITY_DEVELOPER, "E-0012"),
    "IF001_e014_err_file_loading": (RESPONSIBILITY_CONTEXT, "E-0011"),
    "IF001_e014_err_import_format": (RESPONSIBILITY_SELF_FIX, "E-0026"),
    "IF001_e016_err_add_keycode": (RESPONSIBILITY_SELF_FIX, "E-0032"),
    "IF001_e016_err_allow_ext": (RESPONSIBILITY_SELF_FIX, "E-0021"),
    "IF001_e016_err_building_id": (RESPONSIBILITY_SELF_FIX, "E-0030"),
    "IF001_e016_err_centroid_empty": (RESPONSIBILITY_SELF_FIX, "E-0049"),
    "IF001_e016_err_convert_wkt": (RESPONSIBILITY_SELF_FIX, "E-0015"),
    "IF001_e016_err_csv_geometry": (RESPONSIBILITY_SELF_FIX, "E-0042"),
    "IF001_e016_err_data_building_polygon": (RESPONSIBILITY_SELF_FIX, "E-0043"),
    "IF001_e016_err_data_format": (RESPONSIBILITY_SELF_FIX, "E-0033"),
    "IF001_e016_err_data_gpkg": (RESPONSIBILITY_SELF_FIX, "E-0044"),
    "IF001_e016_err_data_join_polygon": (RESPONSIBILITY_CONTEXT, "E-0047"),
    "IF001_e016_err_encoding": (RESPONSIBILITY_SELF_FIX, "E-0025"),
    "IF001_e016_err_export_encoding": (RESPONSIBILITY_DEVELOPER, "E-0017"),
    "IF001_e016_err_export_encoding_gpk": (RESPONSIBILITY_DEVELOPER, "E-0016"),
    "IF001_e016_err_file_extension": (RESPONSIBILITY_SELF_FIX, "E-0048"),
    "IF001_e016_err_file_loading": (RESPONSIBILITY_CONTEXT, "E-0014"),
    "IF001_e016_err_geodataframe_format": (RESPONSIBILITY_DEVELOPER, "E-0018"),
    "IF001_e016_err_geometry": (RESPONSIBILITY_SELF_FIX, "E-0024"),
    "IF001_e016_err_load_data": (RESPONSIBILITY_SELF_FIX, "E-0046"),
    "IF001_e016_err_merge_building_and_textmatchedresult": (RESPONSIBILITY_CONTEXT, "E-0031"),
    "IF001_e016_err_merge_geometry_failure": (RESPONSIBILITY_CONTEXT, "E-0034"),
    "IF001_e016_err_spatial_join": (RESPONSIBILITY_CONTEXT, "E-0019"),
    "IF001_usage_err_no_basis_coverage": (RESPONSIBILITY_SELF_FIX, "E-0020"),
    "IF001_juki_err_no_single_household": (RESPONSIBILITY_SELF_FIX, "E-0052"),
    "IF001_e017_err_text_matching": (RESPONSIBILITY_SELF_FIX, "E-0050"),
    "IF001_err_no_input_files": (RESPONSIBILITY_SELF_FIX, "E-0051"),
    "IF001_err_missing_required_column": (RESPONSIBILITY_SELF_FIX, "E-101"),
    "IF001_err_duplicate_column_mapping": (RESPONSIBILITY_SELF_FIX, "E-102"),
    "IF001_err_join_key_type_mismatch": (RESPONSIBILITY_SELF_FIX, "E-103"),
    "IF003_e022_err_export_encoding": (RESPONSIBILITY_DEVELOPER, "E-20005"),
    "IF003_e022_err_export_path": (RESPONSIBILITY_DEVELOPER, "E-20006"),
    "IF003_e022_err_import_encoding": (RESPONSIBILITY_SELF_FIX, "E-20002"),
    "IF003_e022_err_import_format": (RESPONSIBILITY_SELF_FIX, "E-20001"),
    "IF003_e022_err_import_path": (RESPONSIBILITY_SELF_FIX, "E-20003"),
    "IF003_e022_err_insert_sql": (RESPONSIBILITY_DEVELOPER, "E-20007"),
    "IF003_e022_err_model_missing": (RESPONSIBILITY_SELF_FIX, "E-20004"),
    "IF003_e022_err_perform_determination": (RESPONSIBILITY_SELF_FIX, "E-20008"),
    "IF003_e032_err_aggregation": (RESPONSIBILITY_SELF_FIX, "E-20012"),
    "IF003_e032_err_allow_ext": (RESPONSIBILITY_SELF_FIX, "E-20014"),
    "IF003_e032_err_areadata_csv": (RESPONSIBILITY_SELF_FIX, "E-20009"),
    "IF003_e032_err_areadata_format": (RESPONSIBILITY_SELF_FIX, "E-20010"),
    "IF003_e032_err_areadata_import": (RESPONSIBILITY_SELF_FIX, "E-20011"),
    "IF003_e032_err_areadata_import_gpkg": (RESPONSIBILITY_SELF_FIX, "E-20016"),
    "IF003_e032_err_areadata_import_shp": (RESPONSIBILITY_SELF_FIX, "E-20017"),
    "IF003_e032_err_insert_sql": (RESPONSIBILITY_DEVELOPER, "E-20013"),
    "IF003_err_aggregation_data": (RESPONSIBILITY_SELF_FIX, "E-20015"),
    "IF003_err_no_normalized_dataset": (RESPONSIBILITY_SELF_FIX, "E-20018"),
    # 説明変数の型不一致（FR004-007 R-077）。モデル構築/推定の入力に非数値の説明変数列。
    "IF002_e021_err_feature_non_numeric": (RESPONSIBILITY_SELF_FIX, "E-201"),
    "IF003_e022_err_feature_non_numeric": (RESPONSIBILITY_SELF_FIX, "E-201"),
    "IF004_e033_err_allow_ext": (RESPONSIBILITY_SELF_FIX, "E-30004"),
    "IF004_e033_err_conversion": (RESPONSIBILITY_CONTEXT, "E-30003"),
    "IF004_e033_err_export_path": (RESPONSIBILITY_CONTEXT, "E-30002"),
    "IF004_e033_err_import_path": (RESPONSIBILITY_CONTEXT, "E-30001"),
    "IF005_err_no_input_files": (RESPONSIBILITY_SELF_FIX, "E-50001"),
    # R-051: constants.py 未定義（E021.py が文字列 raise）。網羅表で「コード未付与」。
    "IF002_e021_err_model_learning": (RESPONSIBILITY_CONTEXT, "E-10001"),
}


def get_error_detail(error_code: str | None) -> dict[str, str]:
    """内部識別子から責任分界・次アクション・表示用コードを引く。

    未登録コード（None 含む）は状況依存へフォールバックし、表示が空にならないようにする。
    """
    responsibility, display_code = ERROR_RESPONSIBILITY.get(
        error_code or "", (RESPONSIBILITY_CONTEXT, "")
    )
    detail = {
        "responsibility": responsibility,
        "next_action": NEXT_ACTION_BY_RESPONSIBILITY[responsibility],
        "display_code": display_code,
    }
    # マニュアル相当の修正方法（何が悪い・受理形式・修正例）を内蔵するコードだけ相乗せ（FR006 / #1786）。
    fix_guide = get_fix_guide(display_code)
    if fix_guide is not None:
        detail["fix_guide"] = fix_guide
    return detail


def build_error_result(result, error_code: str | None) -> str:
    """job_task の result JSON にエラー詳細（責任分界・次アクション）を相乗りさせる。

    既存の result（JSON文字列）の中身は壊さず "error_detail" キーを追加する。
    UI はこの error_detail を読んで責任分界・次アクションを表示できる（FR006）。
    result が None・空・非dict・不正JSON でも落ちず、最低限 error_detail だけは載せる。
    """
    try:
        base = json.loads(result) if isinstance(result, str) and result else result
    except (TypeError, ValueError):
        base = None
    if not isinstance(base, dict):
        base = {}
    base["error_detail"] = get_error_detail(error_code)
    return json.dumps(base, ensure_ascii=False)
