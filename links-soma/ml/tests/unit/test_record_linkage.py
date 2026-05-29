"""record_linkage サブモジュール群の単体テスト

water, juki, touki, labels の各モジュールの検証。
"""

import pandas as pd


# ══════════════════════════════════════════════════════════════════════════════
# water module
# ══════════════════════════════════════════════════════════════════════════════


class TestWater:
    """水道データ処理のテスト"""

    def test_normalize_date_series_yyyymmdd(self):
        """YYYYMMDD数値のパース"""
        from preprocessing.record_linkage.water import _normalize_date_series

        s = pd.Series([20240331, 20210101, None])
        result = _normalize_date_series(s)
        assert result.iloc[0] == 20240331.0
        assert result.iloc[1] == 20210101.0
        assert pd.isna(result.iloc[2])

    def test_normalize_date_series_era(self):
        """和暦（R06.03.31）のパース"""
        from preprocessing.record_linkage.water import _normalize_date_series

        s = pd.Series(["R06.03.31", "H30.12.01"])
        result = _normalize_date_series(s)
        assert result.iloc[0] == 20240331.0  # R06 = 2024
        assert result.iloc[1] == 20181201.0  # H30 = 2018

    def test_normalize_date_series_iso(self):
        """ISO日付（2024-03-31）のパース"""
        from preprocessing.record_linkage.water import _normalize_date_series

        s = pd.Series(["2024-03-31"])
        result = _normalize_date_series(s)
        assert result.iloc[0] == 20240331.0

    def test_flag_4consecutive_zeros(self):
        """4連続ゼロフラグ"""
        from preprocessing.record_linkage.water import _flag_4consecutive_zeros

        df = pd.DataFrame({
            "f1": [0, 10],
            "f2": [0, 0],
            "f3": [0, 0],
            "f4": [0, 0],
            "f5": [5, 0],
            "f6": [10, 0],
        })
        result = _flag_4consecutive_zeros(df)
        assert result.iloc[0] == 1  # f1-f4 が全部0
        assert result.iloc[1] == 1  # f3-f6 が全部0

    def test_load_water_status_basic(self, tmp_path):
        """基本的な水道ステータスの読み込み"""
        from preprocessing.record_linkage.water import load_water_status

        csv_path = tmp_path / "1_suido.csv"
        csv_path.write_text(
            "水道番号,住所,開栓日,閉栓日\n"
            "001,テスト市大手町1-1,20200101,\n"
            "002,テスト市駅前町2-3,20190501,20230401\n"
            "003,テスト市山手5,20210101,\n",
            encoding="utf-8",
        )
        cfg = {
            "suido_status": {
                "file": "1_suido.csv",
                "columns": {
                    "water_supply_number": "水道番号",
                    "address": "住所",
                    "usage_start_date": "開栓日",
                    "usage_end_date": "閉栓日",
                },
            },
        }
        df = load_water_status(cfg, tmp_path)
        assert len(df) == 3
        assert "normalized_address" in df.columns
        assert "water_disconnection_flag" in df.columns
        # At least one meter should be disconnected (002 has an end date)
        assert df["water_disconnection_flag"].sum() == 1


# ══════════════════════════════════════════════════════════════════════════════
# juki module
# ══════════════════════════════════════════════════════════════════════════════


class TestToNum:
    """_to_num: 日付文字列 → YYYYMMDD数値変換"""

    def test_yyyymmdd_numeric(self):
        from preprocessing.record_linkage.juki import _to_num
        assert _to_num(pd.Series([20200101.0])).iloc[0] == 20200101.0

    def test_iso_format(self):
        from preprocessing.record_linkage.juki import _to_num
        assert _to_num(pd.Series(["2020-01-15"])).iloc[0] == 20200115.0

    def test_slash_format(self):
        from preprocessing.record_linkage.juki import _to_num
        assert _to_num(pd.Series(["2020/1/5"])).iloc[0] == 20200105.0

    def test_nan_passthrough(self):
        from preprocessing.record_linkage.juki import _to_num
        assert pd.isna(_to_num(pd.Series([None])).iloc[0])


def _make_juki_df(records: list[dict]) -> pd.DataFrame:
    """テスト用の住基DataFrameを作成するヘルパー"""
    rows = []
    for r in records:
        rows.append({
            "household_code": r.get("household_code", "HH001"),
            "normalized_address": r.get("address", "テスト県ダミー市A町1丁目1番地"),
            "birth_date": r.get("birth_date", "19500101"),
            "move_date": r.get("move_date", "19900101"),
            "date_transfer": r.get("date_transfer", "19900101"),
            "reason_transfer": r.get("reason_transfer", "転入"),
        })
    return pd.DataFrame(rows)


def _add_numeric_dates(df: pd.DataFrame) -> pd.DataFrame:
    """_date_num と _move_num を追加するヘルパー"""
    from preprocessing.record_linkage.juki import _to_num
    df = df.copy()
    df["_date_num"] = _to_num(df["date_transfer"])
    df["_move_num"] = _to_num(df["move_date"])
    return df


class TestFilterSettledBeforeCutoff:
    """filter_settled_before_cutoff: 住定日 <= 基準日 でフィルタ"""

    def test_basic_filter(self):
        """住定日が基準日以降の人は除外"""
        from preprocessing.record_linkage.juki import filter_settled_before_cutoff
        df = _make_juki_df([
            {"move_date": "19900101", "reason_transfer": "転入"},
            {"move_date": "20250101", "reason_transfer": "出生"},
            {"move_date": "20240101", "reason_transfer": "転入"},
        ])
        df = _add_numeric_dates(df)
        result = filter_settled_before_cutoff(df, 20240101)
        assert len(result) == 2

    def test_no_cutoff(self):
        """cutoff=99999999 なら全レコード通過"""
        from preprocessing.record_linkage.juki import filter_settled_before_cutoff
        df = _make_juki_df([
            {"move_date": "20990101"},
            {"move_date": "19000101"},
        ])
        df = _add_numeric_dates(df)
        assert len(filter_settled_before_cutoff(df, 99_999_999)) == 2

    def test_nan_move_date_excluded(self):
        """住定日NaNは除外"""
        from preprocessing.record_linkage.juki import filter_settled_before_cutoff
        import numpy as np
        df = _make_juki_df([
            {"move_date": "19900101"},
            {"move_date": None},
        ])
        df.loc[1, "move_date"] = np.nan
        df = _add_numeric_dates(df)
        assert len(filter_settled_before_cutoff(df, 20240101)) == 1


class TestCalculateHouseholdSize:
    """calculate_household_size: 人数ベースの世帯人数計算

    settled_count（住定日 <= 基準日のレコード数）から
    departed_count（転出|死亡 かつ 異動日 <= 基準日）を引く。
    """

    def test_users_example(self):
        """issueの計算例: 4人中、住定3人、departed2人 → 世帯人数1"""
        from preprocessing.record_linkage.juki import filter_settled_before_cutoff, calculate_household_size
        records = [
            {"household_code": "HH1", "address": "テスト町1", "birth_date": "19440101",
             "move_date": "19440101", "date_transfer": "19440101", "reason_transfer": "転入"},
            {"household_code": "HH1", "address": "テスト町1", "birth_date": "19340101",
             "move_date": "19340101", "date_transfer": "19840101", "reason_transfer": "転出"},
            {"household_code": "HH1", "address": "テスト町1", "birth_date": "20250101",
             "move_date": "20250101", "date_transfer": "20250101", "reason_transfer": "出生"},
            {"household_code": "HH1", "address": "テスト町1", "birth_date": "19000101",
             "move_date": "19000101", "date_transfer": "20230326", "reason_transfer": "死亡"},
        ]
        df = _make_juki_df(records)
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        assert len(settled) == 3  # #3（住定日=2025）は除外
        hh_size = calculate_household_size(settled, 20240101)
        assert hh_size["テスト町1"] == 1  # 3 - 2(転出+死亡) = 1

    def test_all_active(self):
        """全員active → departed=0"""
        from preprocessing.record_linkage.juki import filter_settled_before_cutoff, calculate_household_size
        df = _make_juki_df([
            {"address": "テスト町2", "move_date": "20100101", "date_transfer": "20100101", "reason_transfer": "転入"},
            {"address": "テスト町2", "move_date": "20150301", "date_transfer": "20150301", "reason_transfer": "転入"},
        ])
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        assert calculate_household_size(settled, 20240101)["テスト町2"] == 2

    def test_future_departure_not_subtracted(self):
        """異動日が未来の転出は引かない"""
        from preprocessing.record_linkage.juki import filter_settled_before_cutoff, calculate_household_size
        df = _make_juki_df([
            {"address": "テスト町3", "move_date": "20100101", "date_transfer": "20250601", "reason_transfer": "転出"},
        ])
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        assert calculate_household_size(settled, 20240101)["テスト町3"] == 1

    def test_numeric_code_reason_not_departed(self):
        """数値コード（914等）はdeparted にカウントされない"""
        from preprocessing.record_linkage.juki import filter_settled_before_cutoff, calculate_household_size
        df = _make_juki_df([
            {"address": "テスト町4", "move_date": "19800101", "date_transfer": "20151005", "reason_transfer": "914"},
        ])
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        assert calculate_household_size(settled, 20240101)["テスト町4"] == 1


class TestCalculateEventCounts:
    """calculate_event_counts: イベント種別カウント（基準日フィルタ付き）"""

    def test_basic_counts(self):
        from preprocessing.record_linkage.juki import filter_settled_before_cutoff, calculate_event_counts
        df = _make_juki_df([
            {"address": "a", "move_date": "19800101", "date_transfer": "20200101", "reason_transfer": "死亡"},
            {"address": "a", "move_date": "19800101", "date_transfer": "20200101", "reason_transfer": "転入"},
            {"address": "a", "move_date": "19800101", "date_transfer": "20200101", "reason_transfer": "転出"},
            {"address": "a", "move_date": "19800101", "date_transfer": "20200101", "reason_transfer": "消除"},
        ])
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        result = calculate_event_counts(settled, 20240101, "normalized_address")
        assert result.loc["a", "num_deaths_juki_residence"] == 1
        assert result.loc["a", "num_inmigrants_juki_residence"] == 1
        assert result.loc["a", "num_outmigrants_relocations_juki_residence"] == 1
        assert result.loc["a", "num_cancellations_juki_residence"] == 1

    def test_future_death_not_counted(self):
        """異動日が未来の死亡はカウントしない"""
        from preprocessing.record_linkage.juki import filter_settled_before_cutoff, calculate_event_counts
        df = _make_juki_df([
            {"address": "a", "move_date": "19800101", "date_transfer": "20250601", "reason_transfer": "死亡"},
        ])
        df = _add_numeric_dates(df)
        settled = filter_settled_before_cutoff(df, 20240101, "_move_num")
        result = calculate_event_counts(settled, 20240101, "normalized_address")
        assert result.loc["a", "num_deaths_juki_residence"] == 0


class TestCalculateAgeStats:
    """calculate_age_stats: active residents の年齢統計"""

    def test_basic_ages(self):
        from preprocessing.record_linkage.juki import calculate_age_stats
        df = pd.DataFrame({
            "normalized_address": ["a", "a"],
            "birth_date": ["19600101", "20100101"],
        })
        result = calculate_age_stats(df, ref_year=2024)
        assert result.loc["a", "max_age_juki_residence"] == 64
        assert result.loc["a", "over_65_count_juki_residence"] == 0
        assert result.loc["a", "under_15_count_juki_residence"] == 1

    def test_impossible_age_excluded(self):
        """120歳超や未来生まれは除外"""
        from preprocessing.record_linkage.juki import calculate_age_stats
        df = pd.DataFrame({
            "normalized_address": ["a", "a"],
            "birth_date": ["18000101", "20300101"],
        })
        result = calculate_age_stats(df, ref_year=2024)
        assert "a" not in result.index


class TestGetActiveResidents:
    """_get_active_residents: 住定済み ∩ 未転出/未死亡"""

    def test_departed_excluded(self):
        from preprocessing.record_linkage.juki import _get_active_residents
        df = _make_juki_df([
            {"address": "a", "move_date": "19800101", "date_transfer": "20200101", "reason_transfer": "転出"},
            {"address": "a", "move_date": "19800101", "date_transfer": "20200101", "reason_transfer": "転入"},
        ])
        df = _add_numeric_dates(df)
        active = _get_active_residents(df, 20240101)
        assert len(active) == 1
        assert active.iloc[0]["reason_transfer"] == "転入"

    def test_future_departure_still_active(self):
        from preprocessing.record_linkage.juki import _get_active_residents
        df = _make_juki_df([
            {"address": "a", "move_date": "19800101", "date_transfer": "20250601", "reason_transfer": "転出"},
        ])
        df = _add_numeric_dates(df)
        assert len(_get_active_residents(df, 20240101)) == 1


class TestJuki:
    """住民基本台帳処理のテスト（aggregate_juki 統合）"""

    def test_aggregate_basic(self):
        """基本的な集約: 住定者のカウント"""
        from preprocessing.record_linkage.juki import aggregate_juki

        df = pd.DataFrame({
            "household_code": ["H001", "H001", "H002"],
            "address": ["テスト市大手町1-1", "テスト市大手町1-1", "テスト市駅前町2-3"],
            "birth_date": ["19800101", "20100101", "19500301"],
            "move_date": ["20200101", "20200101", "20150601"],
            "reason_transfer": ["転入", "転入", "転入"],
            "date_transfer": ["20200101", "20200101", "20150601"],
            "normalized_address": ["テスト市大手町1-1", "テスト市大手町1-1", "テスト市駅前町2-3"],
        })
        result = aggregate_juki(df, standard_date=pd.Timestamp("2024-03-31"))
        assert len(result) == 2
        assert "household_size_juki_residence" in result.columns
        assert "juki_residence_flag" in result.columns

    def test_household_size_with_departure(self):
        """full_history形式: 転出者はhousehold_sizeから引かれる

        Person A: 転入(最新) → active
        Person B: 転出(最新) → departed
        デデュプ後2人、settled=2、departed=1 → household_size=1
        """
        from preprocessing.record_linkage.juki import aggregate_juki

        addr = "テスト市大手町1-1"
        df = pd.DataFrame({
            "household_code": ["H001", "H001"],
            "address": [addr, addr],
            "birth_date": ["19800101", "19500101"],
            "move_date": ["20200101", "20100101"],
            "reason_transfer": ["転入", "転出"],
            "date_transfer": ["20200101", "20230601"],
            "normalized_address": [addr, addr],
        })
        result = aggregate_juki(df, standard_date=pd.Timestamp("2024-03-31"))
        assert result.loc[addr, "household_size_juki_residence"] == 1

    def test_no_householdsize_after_changes_column(self):
        """num_householdsize_after_changes_juki_residence は出力されない"""
        from preprocessing.record_linkage.juki import aggregate_juki

        df = pd.DataFrame({
            "household_code": ["H001"],
            "address": ["テスト市大手町1-1"],
            "birth_date": ["19800101"],
            "move_date": ["20200101"],
            "reason_transfer": ["転入"],
            "date_transfer": ["20200101"],
            "normalized_address": ["テスト市大手町1-1"],
        })
        result = aggregate_juki(df, standard_date=pd.Timestamp("2024-03-31"))
        assert "num_householdsize_after_changes_juki_residence" not in result.columns


class TestJukiDateFormat:
    """住民基本台帳の生年月日形式に関するテスト"""

    def test_slash_date_birth_date_converted_to_yyyymmdd(self, tmp_path):
        """スラッシュ形式（1959/7/25）の生年月日がYYYYMMDDに変換される"""
        from preprocessing.record_linkage.juki import load_juki

        csv_path = tmp_path / "juki.csv"
        csv_path.write_text(
            "世帯番号,住所,生年月日,住定日,異動事由,異動日\n"
            "H001,テスト市仲町5,1959/7/25,2000/4/1,転入,2000/4/1\n",
            encoding="utf-8",
        )
        cfg = {
            "juki": {
                "file": "juki.csv",
                "columns": {
                    "household_code": "世帯番号",
                    "address": "住所",
                    "birth_date": "生年月日",
                    "move_date": "住定日",
                    "reason_transfer": "異動事由",
                    "date_transfer": "異動日",
                },
            },
        }
        df = load_juki(cfg, tmp_path)
        assert df["birth_date"].iloc[0] == "19590725"

    def test_yyyymmdd_birth_date_unchanged(self, tmp_path):
        """YYYYMMDD形式（19590725）の生年月日はそのまま維持される"""
        from preprocessing.record_linkage.juki import load_juki

        csv_path = tmp_path / "juki.csv"
        csv_path.write_text(
            "世帯番号,住所,生年月日,住定日,異動事由,異動日\n"
            "H001,テスト市垢田1020,19590725,20000401,転入,20000401\n",
            encoding="utf-8",
        )
        cfg = {
            "juki": {
                "file": "juki.csv",
                "columns": {
                    "household_code": "世帯番号",
                    "address": "住所",
                    "birth_date": "生年月日",
                    "move_date": "住定日",
                    "reason_transfer": "異動事由",
                    "date_transfer": "異動日",
                },
            },
        }
        df = load_juki(cfg, tmp_path)
        assert df["birth_date"].iloc[0] == "19590725"

    def test_age_calculated_from_slash_date(self, tmp_path):
        """スラッシュ形式の生年月日から年齢が正しく算出される"""
        from preprocessing.record_linkage.juki import load_juki, aggregate_juki
        from preprocessing.address_utils import CleanData

        csv_path = tmp_path / "juki.csv"
        csv_path.write_text(
            "世帯番号,住所,生年月日,住定日,異動事由,異動日\n"
            "H001,テスト市仲町5,1959/7/25,2000/4/1,転入,2000/4/1\n"
            "H002,テスト市箱田6,1990/1/15,2010/3/1,転入,2010/3/1\n",
            encoding="utf-8",
        )
        cfg = {
            "juki": {
                "file": "juki.csv",
                "columns": {
                    "household_code": "世帯番号",
                    "address": "住所",
                    "birth_date": "生年月日",
                    "move_date": "住定日",
                    "reason_transfer": "異動事由",
                    "date_transfer": "異動日",
                },
            },
        }
        df = load_juki(cfg, tmp_path)
        result = aggregate_juki(df, standard_date=pd.Timestamp("2025-01-01"))
        assert result["max_age_juki_residence"].notna().all()
        addr1 = CleanData.normalize("テスト市仲町5")
        age = result.loc[addr1, "max_age_juki_residence"]
        assert 65 <= age <= 66


# ══════════════════════════════════════════════════════════════════════════════
# touki module
# ══════════════════════════════════════════════════════════════════════════════


class TestTouki:
    """登記簿処理のテスト"""

    def test_load_touki_none_when_no_config(self):
        """touki設定なしの場合Noneを返す"""
        from preprocessing.record_linkage.touki import load_touki

        result = load_touki({"touki": None}, "/tmp")
        assert result is None

    def test_aggregate_touki_basic(self):
        """基本的な登記簿集約"""
        from preprocessing.record_linkage.touki import aggregate_touki

        df = pd.DataFrame({
            "address": ["大手町1-1", "大手町1-1", "駅前2-3"],
            "registration_reason": ["居宅", "相続", "居宅"],
            "structure": ["木造", "木造", "鉄骨"],
            "registration_date": [20200101.0, 20150301.0, 20180601.0],
            "normalized_address": ["大手町1-1", "大手町1-1", "駅前2-3"],
        })
        result = aggregate_touki(df)
        assert len(result) == 2
        assert "touki_residence_flag" in result.columns
        assert "events_count_touki_residence" in result.columns
        assert result.loc["大手町1-1", "events_count_touki_residence"] == 2

    def test_match_touki_to_water_noop(self):
        """touki_agg=None の場合は何もしない"""
        from preprocessing.record_linkage.touki import match_touki_to_water

        df = pd.DataFrame({"a": [1, 2]})
        result = match_touki_to_water(df, None)
        assert len(result) == 2


# ══════════════════════════════════════════════════════════════════════════════
# labels module
# ══════════════════════════════════════════════════════════════════════════════


class TestLabels:
    """ラベル付与のテスト"""

    def test_no_loader_sets_zero(self):
        """未知の都市名ではis_vacant=0"""
        from preprocessing.record_linkage.labels import assign_labels

        df = pd.DataFrame({
            "normalized_address": ["addr1", "addr2"],
            "water_supply_number": ["001", "002"],
        })
        result = assign_labels("未知市", {}, "/tmp", df)
        assert (result["is_vacant"] == 0).all()
        assert "vacant_type" in result.columns
