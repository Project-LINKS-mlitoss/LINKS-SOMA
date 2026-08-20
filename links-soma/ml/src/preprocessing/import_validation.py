"""インポート時の構造ガード（FR004-007・本処理側の致命チェック）。

処理本体が入力を無条件に消費する前に、壊れると不透明にクラッシュする箇所を
明示停止（ブロッキング）へ変換する。純関数・I/O 非依存。

- 文字コード判別不能（既存 E-0008 系）: read_csv_checked が UTF-8 として読めない CSV を
  EncodingDetectionError に変換する。
- 必須カラム未指定（E-101）: ensure_required_columns がパイプラインの契約列の存在を検査する。
- 説明変数の型不一致（E-201）: find_non_numeric_feature_columns がモデル構築/推定の数値前提の
  説明変数に非数値が混じる列を検出する。ゼロ一致（E-20004）は feature_columns_all_absent。

行単位の品質サマリー（取込成功率・E-202/E-203 の集計表示）は本モジュールに含めない。
品質の定義がデータの業務的文脈に依存し機械判定できないため（検討: issue #1901）。
"""

from __future__ import annotations

import pandas as pd

# 期待データ型の語彙。説明変数の数値化可否の検査に使う。
DTYPE_NUMERIC = "numeric"


def _type_unparsable_mask(series: pd.Series, dtype: str) -> pd.Series:
    """期待型に変換できない（＝処理本体が黙って NaN/None 化する）セルの真偽マスク。"""
    if dtype == DTYPE_NUMERIC:
        # "Inf"/"-Inf" は float として解釈できるため型不一致では拾わない。
        return pd.to_numeric(series, errors="coerce").isna()
    # 未知の dtype は検査しない（全 False マスク）。
    return pd.Series(False, index=series.index)


def _missing_mask(series: pd.Series) -> pd.Series:
    """欠損行の真偽マスク（ベクトル化）。NULL と 空白のみ文字列を欠損とみなす。"""
    null_mask = series.isna()
    if series.dtype == object or pd.api.types.is_string_dtype(series):
        blank_mask = series.astype("string").str.strip() == ""
        return null_mask | blank_mask.fillna(False)
    return null_mask


class EncodingDetectionError(Exception):
    """文字コード判別不能（E-001・致命）。入力CSVをUTF-8として読めない。

    既存のエンコ検出失敗（E-0008等）へ一元化する。caller（IF001）が捕捉して記録・停止する。
    """

    def __init__(self, path) -> None:
        self.path = str(path)
        super().__init__(f"文字コードを判別できません: {path}")


def read_csv_checked(path, **kwargs):
    """pd.read_csv のラッパ。UTF-8 として読めなければ EncodingDetectionError に変換する。

    record_linkage の各 load が UnicodeDecodeError で不透明に落ちるのを、文字コード(E-001/
    既存E-0008)として明示停止できるようにする。挙動は通常時 pd.read_csv と同一。
    """
    try:
        return pd.read_csv(path, **kwargs)
    except UnicodeDecodeError as exc:
        raise EncodingDetectionError(path) from exc


class MissingRequiredColumnsError(Exception):
    """必須カラム未指定（E-101・致命）。パイプラインが無条件に使う列が入力に無い。

    dataset: どの入力データか（例: suido_status）。columns: 不足している必須カラム名。
    caller（IF001）がこれを捕捉して E-101 として記録・停止する。
    """

    def __init__(self, dataset: str, columns: list[str]) -> None:
        self.dataset = dataset
        self.columns = columns
        super().__init__(f"必須カラムが見つかりません（{dataset}）: {', '.join(columns)}")


# パイプラインが各入力データで無条件に参照する canonical カラム（＝欠ければ処理が成立しない）。
# 出所はパイプライン実装そのもの（コードが KeyError になる列）。アプリのフォームではなく
# 消費側パイプラインの契約を正とする。canonical 名はリネーム後の列名。
REQUIRED_COLUMNS_BY_DATASET: dict[str, list[str]] = {
    # water_supply_number は aggregate_usage の merge(on=water_supply_number) が無条件に要求する
    "suido_status": ["address", "water_supply_number"],
    "suido_use": ["water_supply_number", "meter_reading_date", "suido_usage"],
    # juki の集計が消費する列。address（normalize）・move_date・date_transfer は
    # aggregate_juki 冒頭で無条件参照（欠ければ KeyError）。birth_date（calculate_age_stats）と
    # reason_transfer（calculate_household_size/event_counts）は在住者が居る通常データでは必ず
    # 消費され、未設定は取り違えと並ぶ主要な不明エラー源のため必須に含める。在住者0の退化
    # データでは早期returnで回避されうるが、その場合も E-101 案内（列を追加）が適切。
    # household_code は has_hh ガードで任意。
    "juki": ["address", "birth_date", "move_date", "reason_transfer", "date_transfer"],
    # touki の集計は address（normalize）と registration_reason（aggregate の列選択）を無条件参照する。
    # registration_date は load 時に .get フォールバックで生成されるため任意。
    "touki": ["address", "registration_reason"],
}


def ensure_required_columns(columns, dataset: str) -> None:
    """宣言契約 REQUIRED_COLUMNS_BY_DATASET に対し必須カラムの存在を検査する。

    リネーム後の列集合 columns に必須カラムが無ければ MissingRequiredColumnsError を送出。
    未登録 dataset は検査しない（契約が無い＝対象外）。
    """
    required = REQUIRED_COLUMNS_BY_DATASET.get(dataset)
    if not required:
        return
    present = set(columns)
    missing = [c for c in required if c not in present]
    if missing:
        raise MissingRequiredColumnsError(dataset, missing)


# E-101 メッセージ用の職員向け日本語ラベル。canonical 名（パイプライン内部名）→ 表示名。
# 値は画面 (app/src/shared/config/lang.ts の normalizationData / normalizationParameters
# shortLabel) の語彙に合わせ、職員が名寄せウィザードで見た名前と一致させる。canonical 名を
# そのまま出すと英語内部名になり読めないため。未登録は canonical 名にフォールバックする。
_DATASET_LABEL_JA = {
    "suido_status": "水道閉開栓状況",
    "suido_use": "水道使用量",
    "juki": "住民基本台帳",
    "touki": "登記情報",
    "geocoding": "ジオコーディング済データ",
    "optional_data_source": "建物関連データ",
}
_COLUMN_LABEL_JA = {
    "address": "住所",
    "water_supply_number": "水道番号",
    "meter_reading_date": "水道検針年月日",
    "suido_usage": "水道使用量",
    "household_code": "世帯番号",
    "birth_date": "生年月日",
    "move_date": "住定年月日",
    "reason_transfer": "異動事由",
    "date_transfer": "異動日",
    "registration_reason": "登記理由",
}


def describe_missing_columns(dataset: str, columns) -> str:
    """E-101 メッセージ用に、データセット・必須カラムを職員向け日本語で整形する。

    未登録の canonical 名はそのまま返す（新規契約追加時のフォールバック）。
    """
    ds = _DATASET_LABEL_JA.get(dataset, dataset)
    cols = "・".join(_COLUMN_LABEL_JA.get(c, c) for c in columns)
    return f"{ds}: {cols}"


class JoinKeyTypeMismatchError(Exception):
    """結合キーの型不一致（E-103・致命）。2ファイルの同じ項目に別種の値が入っている。

    カラム取り違え（例: 水道番号の項目に住所の列を割り当てる）は E-101 にも E-102 にも
    掛からない。列は存在し、重複もしていないためである。値の種類だけが食い違い、結合の
    段で pandas が ValueError を投げ、捕捉されず不明エラーになる。消費前ではなく結合時に
    しか判明しないため、結合箇所で捕捉して明示停止へ変換する。

    どちら側の割り当てが誤りかは特定できない。型の不一致は「両側が食い違っている」ことしか
    示さず、片側が文字列であること自体は誤りではない（水道番号は文字列でも正当。両側とも
    文字列なら結合は成立する）。そのため datasets は関与する全ファイルを持つ。

    datasets: 結合しようとした入力データの canonical 名（例: ["suido_status", "suido_use"]）。
    column: 結合キーの canonical 名（例: water_supply_number）。
    """

    def __init__(self, datasets: list[str], column: str) -> None:
        self.datasets = list(datasets)
        self.column = column
        super().__init__(
            f"結合キーの型が一致しません（{', '.join(self.datasets)}）: {column}"
        )


def describe_join_key(datasets, column: str) -> str:
    """E-103 メッセージ用に、関与データセットと結合キーを職員向け日本語で整形する。"""
    ds = "・".join(_DATASET_LABEL_JA.get(d, d) for d in datasets)
    col = _COLUMN_LABEL_JA.get(column, column)
    return f"{ds} の{col}"


class DuplicateColumnMappingError(Exception):
    """同一入力列を複数のカラム項目へ割り当て（E-102・致命）。

    名寄せウィザードで 1 つの入力列を複数の項目に割り当てると、リネーム
    src_col = {v: k ...} で後勝ちに潰れ、一方の canonical 列が生成されず下流が
    不透明にクラッシュする。消費前に検出して、どのファイルのどの列が重複かを
    添えて明示停止する。caller（IF001）が捕捉して E-102 として記録・停止する。

    dataset: どの入力データか（例: juki）。column: 重複して割り当てられた入力列名。
    """

    def __init__(self, dataset: str, column: str) -> None:
        self.dataset = dataset
        self.column = column
        super().__init__(f"同じ入力列が複数の項目に割り当てられています（{dataset}）: {column}")


def ensure_no_duplicate_column_mapping(columns, dataset: str) -> None:
    """カラム割り当て（項目→入力列名）に同じ入力列の重複割り当てが無いか検査する。

    columns は 項目名（canonical）→ ユーザーが選んだ入力列名 の dict。同じ入力列名が
    2 つ以上の項目に割り当てられていれば DuplicateColumnMappingError を送出する。
    未割り当て（None / 空文字）は対象外。最初に見つかった重複列を報告する。
    """
    seen: set[str] = set()
    for value in columns.values():
        if value is None:
            continue
        name = str(value).strip()
        if not name:
            continue
        if name in seen:
            raise DuplicateColumnMappingError(dataset, name)
        seen.add(name)


def describe_duplicate_column(dataset: str, column: str) -> str:
    """E-102 メッセージ用に、データセット名（職員向け日本語）と重複入力列名を整形する。"""
    ds = _DATASET_LABEL_JA.get(dataset, dataset)
    return f"{ds}: {column}"


def find_non_numeric_feature_columns(df: pd.DataFrame, columns) -> list[str]:
    """指定列のうち、欠損でないのに数値化できないセルを1つ以上含む列名を返す（ベクトル化）。

    モデル構築/推定の説明変数は数値前提（.to_numpy(dtype=float)）。非数値を含む列は消費時に
    不透明にクラッシュするため、消費前に列単位で検出して明示停止に使う（E-201）。
    """
    bad: list[str] = []
    for c in columns:
        if c not in df.columns:
            continue
        series = df[c]
        unparsable = _type_unparsable_mask(series, DTYPE_NUMERIC) & ~_missing_mask(series)
        if bool(unparsable.any()):
            bad.append(c)
    return bad


def feature_columns_all_absent(columns, feature_columns) -> bool:
    """モデルが要求する説明変数が DataFrame 列に1つも無いか（ゼロ一致）を返す。

    部分欠損は predict 側の median 補完で許容する設計のため致命にしない。ゼロ一致は
    別データセットを推定にかけた状態で、補完しても無意味な出力になるため致命（E-20004）に使う。
    feature_columns が空（モデルが説明変数を要求しない）なら False を返す。
    """
    if not feature_columns:
        return False
    present = set(columns)
    return all(c not in present for c in feature_columns)


class FeatureTypeMismatchError(Exception):
    """説明変数（特徴量）に数値化できない値が含まれる（E-201・型不一致・致命）。

    モデル構築(IF002)・推定(IF003)が .to_numpy(dtype=float) で数値消費する前に検出して、
    不透明な ValueError でなく「どの列が非数値か」を添えて明示停止する。caller が捕捉して
    責任分界（自治体修正）つきのエラーコードで記録する。columns: 非数値を含む列名。
    """

    def __init__(self, columns) -> None:
        self.columns = list(columns)
        super().__init__(
            f"説明変数に数値化できない値が含まれます: {', '.join(self.columns)}"
        )
