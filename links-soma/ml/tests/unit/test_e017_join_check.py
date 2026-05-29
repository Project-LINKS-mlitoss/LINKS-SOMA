"""E017 結合チェック — 住所ゆれチェックのテスト

全住所を大字レベルに集約し、水道データに存在しないサブデータの
大字住所を候補として抽出。候補住所に対してレーベンシュタイン距離で
類似候補を検索する。
"""

import polars as pl
import pytest

from E017 import addr_lev_match, extract_candidates, pivot_address


# ============================================================
# フィクスチャ: IF005検証用データ相当のpivot済みDataFrame
# ============================================================


@pytest.fixture
def sub_pivot() -> pl.DataFrame:
    """住民基本台帳側の大字レベル集約済み住所

    | 大字住所        | 件数 | 水道データに同名の大字が存在するか |
    |----------------|------|----------------------------------|
    | 渡刈町乗藏      | 11   | しない（旧字体は水道データにない）  |
    | 渡刈町乗蔵      | 3    | する                              |
    | 上仁木町下田    | 1    | する                              |
    | 上仁木町穴田    | 1    | する                              |
    """
    return pl.DataFrame(
        {
            "address_oaza": ["渡刈町乗藏", "渡刈町乗蔵", "上仁木町下田", "上仁木町穴田"],
            "normalized_address": [11, 3, 1, 1],
        }
    )


@pytest.fixture
def main_pivot() -> pl.DataFrame:
    """水道データ側の大字レベル集約済み住所"""
    return pl.DataFrame(
        {
            "address_oaza": ["渡刈町乗蔵", "上仁木町下田", "上仁木町穴田"],
            "normalized_address": [10, 5, 1],
        }
    )


# ============================================================
# Baseline: 類似住所マッチングの挙動
# ============================================================


class TestBaselineMatchResult:
    """addr_lev_match の基本挙動"""

    def test_returns_all_similar_pairs(
        self, sub_pivot, main_pivot
    ):
        """類似住所マッチングは閾値以上の全ペアを返す（別地名を含む）"""
        result = addr_lev_match(
            sub_pivot,
            main_pivot,
            threshold=0.8,
            address_column="address_oaza",
            count_col="normalized_address",
            topk=5,
            item="juki",
        )

        juki_addresses = result.get_column("juki_address").to_list()
        assert "渡刈町乗藏" in juki_addresses
        assert "上仁木町下田" in juki_addresses
        assert "上仁木町穴田" in juki_addresses

    def test_excludes_perfect_match(
        self, sub_pivot, main_pivot
    ):
        """住所グループが完全一致（類似度1.0）の場合は候補から除外される"""
        result = addr_lev_match(
            sub_pivot,
            main_pivot,
            threshold=0.8,
            address_column="address_oaza",
            count_col="normalized_address",
            topk=5,
            item="juki",
        )

        rows = result.filter(pl.col("juki_address") == "渡刈町乗蔵")
        suido_addrs = rows.get_column("suido_address").to_list()
        assert "渡刈町乗蔵" not in suido_addrs


# ============================================================
# 新しい処理フロー: 全住所大字集約 → 候補抽出 → 類似検索
# ============================================================


class TestCandidatesExtraction:
    """サブデータにあって水道データにない大字住所を候補として抽出する処理の検証"""

    def test_extracts_sub_only_oaza(self):
        """水道データに存在しない大字住所のみが候補となる"""
        main_pivot = pl.DataFrame(
            {
                "address_oaza": ["渡刈町乗蔵", "上仁木町下田"],
                "normalized_address": [10, 5],
            }
        )
        sub_pivot = pl.DataFrame(
            {
                "address_oaza": ["渡刈町乗藏", "上仁木町下田"],
                "normalized_address": [11, 3],
            }
        )
        main_oaza_set = {"渡刈町乗蔵", "上仁木町下田"}
        candidates = extract_candidates(sub_pivot, main_oaza_set)
        assert candidates.height == 1
        assert candidates.get_column("address_oaza").to_list()[0] == "渡刈町乗藏"

    def test_all_in_water_data_yields_empty_candidates(self):
        """全てのサブデータ大字が水道データに存在する場合、候補は0件"""
        sub_pivot = pl.DataFrame(
            {
                "address_oaza": ["渡刈町乗蔵", "上仁木町下田"],
                "normalized_address": [3, 2],
            }
        )
        main_oaza_set = {"渡刈町乗蔵", "上仁木町下田"}
        candidates = extract_candidates(sub_pivot, main_oaza_set)
        assert candidates.height == 0

    def test_none_in_water_data_yields_all_candidates(self):
        """サブデータの大字が全て水道データに存在しない場合、全件が候補"""
        sub_pivot = pl.DataFrame(
            {
                "address_oaza": ["南町", "北町"],
                "normalized_address": [3, 2],
            }
        )
        main_oaza_set = {"東町", "西町"}
        candidates = extract_candidates(sub_pivot, main_oaza_set)
        assert candidates.height == 2

    def test_similar_address_found_for_candidate(self):
        """候補住所に対して水道データ大字住所から類似候補が見つかる"""
        candidates_pivot = pl.DataFrame(
            {
                "address_oaza": ["渡刈町乗藏"],
                "normalized_address": [11],
            }
        )
        main_pivot = pl.DataFrame(
            {
                "address_oaza": ["渡刈町乗蔵", "上仁木町下田"],
                "normalized_address": [10, 5],
            }
        )
        result = addr_lev_match(
            candidates_pivot,
            main_pivot,
            threshold=0.8,
            address_column="address_oaza",
            count_col="normalized_address",
            topk=5,
            item="juki",
        )
        assert result.height >= 1
        row = result.row(0, named=True)
        assert row["juki_address"] == "渡刈町乗藏"
        assert row["suido_address"] == "渡刈町乗蔵"
        assert row["suido_count"] == "10"

    def test_candidate_includes_water_data_count(self):
        """類似候補には水道データ側の件数が含まれる"""
        candidates_pivot = pl.DataFrame(
            {
                "address_oaza": ["渡刈町乗藏"],
                "normalized_address": [11],
            }
        )
        main_pivot = pl.DataFrame(
            {
                "address_oaza": ["渡刈町乗蔵"],
                "normalized_address": [7],
            }
        )
        result = addr_lev_match(
            candidates_pivot,
            main_pivot,
            threshold=0.8,
            address_column="address_oaza",
            count_col="normalized_address",
            topk=5,
            item="juki",
        )
        assert result.height == 1
        row = result.row(0, named=True)
        assert row["juki_count"] == "11"
        assert row["suido_count"] == "7"

    def test_perfect_match_not_candidate(self):
        """水道データに完全一致する大字は候補にならない（ステップ2で除外）"""
        sub_pivot = pl.DataFrame(
            {
                "address_oaza": ["渡刈町乗蔵"],
                "normalized_address": [3],
            }
        )
        main_oaza_set = {"渡刈町乗蔵"}
        candidates = extract_candidates(sub_pivot, main_oaza_set)
        assert candidates.height == 0


# ============================================================
# 住所の大字レベル集約
# ============================================================


class TestAddressPivot:
    """正規化住所を大字レベルに集約する処理の検証"""

    def test_extracts_oaza_from_address_with_lot_number(self):
        """正規化住所（渡刈町乗蔵17等）から大字部分（渡刈町乗蔵）を抽出する"""
        df = pl.DataFrame(
            {"normalized_address": ["渡刈町乗蔵17", "渡刈町乗蔵1-2", "渡刈町乗蔵28-1"]}
        )

        result = pivot_address(
            df, "normalized_address", set(), True, "address_oaza"
        )

        oaza_list = result.get_column("address_oaza").to_list()
        assert "渡刈町乗蔵" in oaza_list

    def test_groups_addresses_by_oaza_with_count(self):
        """同じ大字の住所がグループ化され、件数が集計される"""
        df = pl.DataFrame(
            {
                "normalized_address": [
                    "渡刈町乗蔵17",
                    "渡刈町乗蔵1-2",
                    "渡刈町乗蔵28-1",
                    "上仁木町下田391",
                ]
            }
        )

        result = pivot_address(
            df, "normalized_address", set(), True, "address_oaza"
        )

        assert result.height == 2
        kura_row = result.filter(pl.col("address_oaza") == "渡刈町乗蔵")
        assert kura_row.get_column("normalized_address").to_list()[0] == 3

    def test_old_and_new_kanji_are_separate_groups(self):
        """旧字体（藏）と新字体（蔵）は別の住所グループとして集約される"""
        df = pl.DataFrame(
            {
                "normalized_address": [
                    "渡刈町乗藏4",
                    "渡刈町乗藏7",
                    "渡刈町乗蔵17",
                ]
            }
        )

        result = pivot_address(
            df, "normalized_address", set(), True, "address_oaza"
        )

        oaza_list = sorted(result.get_column("address_oaza").to_list())
        assert "渡刈町乗藏" in oaza_list
        assert "渡刈町乗蔵" in oaza_list
        assert result.height == 2


# ============================================================
# 仕様: addr_lev_match の閾値挙動
# ============================================================


def _run_lev_match(left_addresses, right_addresses, threshold=0.8):
    """テストヘルパー: サブデータ↔水道データの類似度マッチングを実行する"""
    left = pl.DataFrame(
        {
            "address_oaza": left_addresses,
            "normalized_address": [1] * len(left_addresses),
        }
    )
    right = pl.DataFrame(
        {
            "address_oaza": right_addresses,
            "normalized_address": [1] * len(right_addresses),
        }
    )
    return addr_lev_match(
        left, right,
        threshold=threshold,
        address_column="address_oaza",
        count_col="normalized_address",
        topk=5, item="juki",
    )


class TestDisplayedPatterns:
    """類似候補として表示される住所パターン（閾値以上かつ完全一致以外）"""

    def test_old_kanji_5chars(self):
        """旧字体の表記ゆれ（5文字・類似度0.80）は表示される"""
        filtered = _run_lev_match(
            ["渡刈町乗藏"],  # サブデータのみ（水道データに不在）
            ["渡刈町乗蔵"],  # 水道データ側の新字体
        )
        assert filtered.height == 1
        row = filtered.row(0, named=True)
        assert row["juki_address"] == "渡刈町乗藏"
        assert row["suido_address"] == "渡刈町乗蔵"
        assert round(row["similarity"], 2) == 0.80

    def test_jis_gaiji_6chars(self):
        """JIS外字の表記ゆれ（6文字・類似度0.83）は表示される"""
        filtered = _run_lev_match(
            ["大字北髙根沢"],  # 髙（はしごだか）はサブデータのみ
            ["大字北高根沢"],  # 水道データは常用漢字
        )
        assert filtered.height == 1
        row = filtered.row(0, named=True)
        assert row["juki_address"] == "大字北髙根沢"
        assert row["suido_address"] == "大字北高根沢"
        assert row["similarity"] >= 0.8

    def test_garbled_1char_in_5chars(self):
        """文字化け1文字（5文字中・類似度0.80）は表示される"""
        filtered = _run_lev_match(
            ["渡刈町乗\ufffd"],  # 1文字が化けたサブデータ住所
            ["渡刈町乗蔵"],
        )
        assert filtered.height == 1
        assert filtered.row(0, named=True)["similarity"] >= 0.8

    def test_garbled_1char_in_6chars(self):
        """文字化け1文字（6文字中・類似度0.83）は表示される"""
        filtered = _run_lev_match(
            ["大字北\ufffd根沢"],  # 6文字中1文字が化けた住所
            ["大字北高根沢"],
        )
        assert filtered.height == 1
        assert filtered.row(0, named=True)["similarity"] >= 0.8

    def test_sub_only_oaza_different_place_name(self):
        """サブデータにのみ存在する別地名も類似候補として表示される"""
        filtered = _run_lev_match(
            ["大字桜新町"],  # サブデータのみ
            ["大字桜本町"],  # 水道データのみ
        )
        assert filtered.height == 1
        row = filtered.row(0, named=True)
        assert row["juki_address"] == "大字桜新町"
        assert row["suido_address"] == "大字桜本町"


# ============================================================
# 仕様: 類似度が閾値（0.8）未満のため除外される
# ============================================================


class TestBelowThreshold:
    """類似度が閾値（0.8）未満のため類似候補に含まれない"""

    def test_old_kanji_4chars_similarity_075(self):
        """旧字体でも4文字（類似度0.75）は閾値未満のため表示されない"""
        filtered = _run_lev_match(
            ["渡刈乗藏"],  # 4文字・サブデータのみ
            ["渡刈乗蔵"],  # 4文字・水道データのみ
        )
        assert filtered.height == 0

    def test_jis_gaiji_3chars(self):
        """JIS外字（3文字・類似度0.67）は閾値未満のため表示されない"""
        filtered = _run_lev_match(
            ["髙橋町"],  # サブデータのみ
            ["高橋町"],  # 水道データのみ
        )
        assert filtered.height == 0

    def test_okurigana_3chars(self):
        """送り仮名差異（3文字・類似度0.67）は閾値未満のため表示されない"""
        filtered = _run_lev_match(
            ["桜ヶ丘"],  # サブデータのみ
            ["桜が丘"],  # 水道データのみ
        )
        assert filtered.height == 0

    def test_short_different_place_name(self):
        """短い別地名（2文字・類似度0.50）は閾値未満のため表示されない"""
        filtered = _run_lev_match(
            ["東町"],
            ["西町"],
        )
        assert filtered.height == 0

    def test_garbled_2chars_in_5chars(self):
        """文字化け2文字（5文字中・類似度0.60）は閾値未満のため表示されない"""
        filtered = _run_lev_match(
            ["渡刈町\ufffd\ufffd"],
            ["渡刈町乗蔵"],
        )
        assert filtered.height == 0

    def test_garbled_all_chars(self):
        """全文字化け（5文字・類似度0.00）は閾値未満のため表示されない"""
        filtered = _run_lev_match(
            ["\ufffd\ufffd\ufffd\ufffd\ufffd"],
            ["渡刈町乗蔵"],
        )
        assert filtered.height == 0
