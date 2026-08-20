"""空き家推定確率の年度間変化率を算出する純粋ロジック。

複数年度の名寄せデータで推定した結果は、同一建物(normalized_address)が
複数の reference_date(推定基準日)に渡って現れる。その predicted_probability を
年度昇順に並べ、相対変化率を2種類算出する:

- from_oldest  : 最古年度を基準にした相対変化率 (p - p_最古) / p_最古
- from_previous: 直前の観測年度を基準にした相対変化率 (p - p_前) / p_前

DB アクセスを持たない純粋関数として切り出し、ユニットテスト可能にしている。
DB 読み書きは utils.update_predicted_probability_change_rates が担う。
"""

import numpy as np
import pandas as pd

COLUMN_FROM_OLDEST = "predicted_probability_change_rate_from_oldest"
COLUMN_FROM_PREVIOUS = "predicted_probability_change_rate_from_previous"


def compute_probability_change_rates(df: pd.DataFrame) -> pd.DataFrame:
    """建物単位の空き家推定確率の相対変化率を算出する。

    Parameters
    ----------
    df : pd.DataFrame
        少なくとも id, normalized_address, reference_date, predicted_probability
        を含む建物行。1建物が複数 reference_date の行を持ちうる。

    Returns
    -------
    pd.DataFrame
        id, from_oldest, from_previous の3カラム。算出対象外は NaN。

    算出規則
    --------
    - reference_date が1種類しかない結果は対象外(全行 NaN)。仕様「単一年度は対象外」
    - 観測が1回しかない建物は比較対象がないため NaN
    - 基準値が0または欠損の行は0除算・未定義のため NaN
    - 最古年度の行は from_oldest=0(自身が基準)・from_previous=NaN(前年度なし)
    """
    ids = df["id"].to_numpy()
    n = len(ids)
    empty = pd.DataFrame(
        {
            "id": ids,
            COLUMN_FROM_OLDEST: np.full(n, np.nan),
            COLUMN_FROM_PREVIOUS: np.full(n, np.nan),
        }
    )
    if n == 0 or df["reference_date"].nunique(dropna=True) < 2:
        return empty

    order = df.sort_values(
        ["normalized_address", "reference_date"], kind="stable"
    ).copy()

    p = pd.to_numeric(order["predicted_probability"], errors="coerce")
    grp = order.groupby("normalized_address", sort=False)["predicted_probability"]
    # 最古年度行の値を基準にする(欠損なら基準なし=NaN)。transform("first") は
    # NaN をスキップし「最初の非欠損値」を返すため、shift(1) と整合しない。
    # 昇順ソート済みのため、建物ごとの初出行が最古年度。
    is_oldest_row = ~order.duplicated("normalized_address")
    oldest_probability = order.loc[is_oldest_row].set_index(
        "normalized_address"
    )["predicted_probability"]
    p_oldest = pd.to_numeric(
        order["normalized_address"].map(oldest_probability), errors="coerce"
    )
    p_prev = pd.to_numeric(grp.shift(1), errors="coerce")
    has_multiple_observations = grp.transform("size") >= 2

    from_oldest = (p - p_oldest) / p_oldest.where(p_oldest != 0)
    from_previous = (p - p_prev) / p_prev.where(p_prev != 0)

    order[COLUMN_FROM_OLDEST] = from_oldest.where(has_multiple_observations)
    order[COLUMN_FROM_PREVIOUS] = from_previous.where(has_multiple_observations)

    return order[["id", COLUMN_FROM_OLDEST, COLUMN_FROM_PREVIOUS]]
