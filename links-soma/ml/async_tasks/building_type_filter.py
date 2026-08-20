"""処理対象選定用データ（建物ポリゴン）による推定対象の絞り込みと、家屋種別の内訳。

家屋種別は「推定対象から外すかどうかの判定材料」であると同時に「結果画面と
検証情報に出す内訳」でもある。判定にだけ使って捨てると、残った行が指定種別
だったのか種別を特定できなかったのかを後から区別できず、内訳を出せない。
判定に使った種別を行に残すのがこのモジュールの責務。

CSV 形式の処理対象選定用データは住所結合で同じことを行う
（E016.merge_building_type_determination）。両経路が同じ内訳を出さないと、
入力ファイルの形式によって結果画面の【家屋種別】が欠ける。
"""

import pandas as pd

# 推定対象の各行に確定した家屋種別を保持する列。空文字は「種別を特定できなかった」
BUILDING_TYPE_COLUMN = "usage_building_type_determination"

# 建物ポリゴン側の家屋種別が実質的に欠損している値。
# 種別が分からないことは、住宅でないことを意味しない
UNKNOWN_BUILDING_TYPES = ("", "不明")


def normalize_building_type_column(values):
    """建物ポリゴンの家屋種別を、利用者が選択肢として見た文字列表現に揃える。

    選択肢は GeoPackage を SQLite として読み JavaScript の `String()` で作るため
    （app/src/features/dataset/util/read-gpkg-column-values.ts）、整数コード 401 は
    "401" になる。一方 geopandas は欠損を含む整数列を float64 で読むため、素直に
    文字列化すると "401.0" になり選択値と一致しない。一致しないと全ポリゴンが
    「指定外の種別」と判定され、建物ポリゴン内の行が全件除外される。
    """
    if pd.api.types.is_numeric_dtype(values):
        numeric = pd.to_numeric(values, errors="coerce")
        text = pd.Series("", index=values.index, dtype=object)
        is_whole = numeric.notna() & (numeric % 1 == 0)
        text[is_whole] = numeric[is_whole].astype("int64").astype(str)
        has_fraction = numeric.notna() & ~is_whole
        text[has_fraction] = numeric[has_fraction].astype(str)
        return text
    return values.fillna("").astype(str)


def classify_building_type(matched_types, residential_values):
    """点に重なった建物ポリゴンの家屋種別群から、その行の扱いを決める。

    引数:
        matched_types: その点を含む建物ポリゴンの家屋種別（重なりがあるため複数）
        residential_values: 利用者が推定対象に選んだ家屋種別

    戻り値:
        指定種別の文字列 — 推定対象として残し、その種別を行に記録する
        空文字            — 推定対象として残すが、種別は特定できていない
        None              — 推定対象から除外する

    重なりの扱い: 1点が複数の建物ポリゴンに含まれることがある。指定種別が
    1つでも含まれていれば残す。住宅を誤って除外すると推定結果に一切現れず
    利用者が気付く手段がないのに対し、非住宅を残しても推定結果の一覧に出る
    ため目視で気付ける。取り返しがつかない側を避ける。

    採用する種別は residential_values の並び順で先に現れたものにする。
    集合の反復順に任せると、同じ入力で実行ごとに結果が変わりうるため。

    「不明」も選択肢に現れるため利用者が選ぶことがある。選ばれていれば他の種別と
    同じく残す対象として扱い、内訳では種別不明に数える（残すかどうかと、種別を
    特定できたかは別の問い）。
    """
    matched = set(matched_types)

    for value in residential_values:
        if value in matched:
            return value

    # 指定種別を含まず、かつ種別が判明しているポリゴンにだけ重なる = 対象外の建物
    if matched - set(UNKNOWN_BUILDING_TYPES):
        return None

    return ""


def summarize_building_types(building_types, residential_values):
    """結果画面と検証情報の【家屋種別】に出す内訳を組み立てる。

    引数:
        building_types: 絞り込み後の各行の家屋種別（classify_building_type の戻り値）
        residential_values: 利用者が推定対象に選んだ家屋種別

    「種別不明」は「指定種別ではなかった行」と定義する。2つの件数の合計が母数に
    一致しないと、受け取った側が内訳を検算できないため。
    """
    total = len(building_types)
    specified_values = set(residential_values) - set(UNKNOWN_BUILDING_TYPES)
    user_specified_count = sum(1 for t in building_types if t in specified_values)
    unknown_count = total - user_specified_count

    def percentage(count):
        return count / total * 100 if total > 0 else 0.0

    return {
        "building_type_breakdown": {
            "user_specified": {
                "percentage": percentage(user_specified_count),
                "count": user_specified_count,
            },
            "unknown": {
                "percentage": percentage(unknown_count),
                "count": unknown_count,
            },
        },
        "building_type_breakdown_total": total,
    }
