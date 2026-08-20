"""optional_data_source モジュールの単体テスト

建物関連データの住所結合・_odsサフィックス付与ロジックの検証。
"""

import pandas as pd


class TestOptionalDataSource:
    """建物関連データの結合テスト"""

    def test_merge_adds_columns_with_ods_suffix(self, tmp_path):
        """追加データのカラムが_odsサフィックス付きで結合される"""
        from preprocessing.record_linkage.optional_data_source import merge_optional_data_source

        main_df = pd.DataFrame({
            "water_supply_number": ["001", "002", "003"],
            "normalized_address": ["大手町1-1", "駅前2-3", "山手5"],
        })

        csv_path = tmp_path / "custom.csv"
        csv_path.write_text(
            "所在地,課税標準額,建築年\n"
            "テスト市大手町1丁目1番,5000000,1990\n"
            "テスト市駅前町2丁目3番,3000000,2005\n",
            encoding="utf-8",
        )

        cfg = {
            "file": "custom.csv",
            "columns": {"address": "所在地"},
        }
        result = merge_optional_data_source(main_df, cfg, tmp_path, municipality="テスト市")

        assert "課税標準額_ods" in result.columns
        assert "建築年_ods" in result.columns
        assert "所在地_ods" not in result.columns
        assert len(result) == 3

    def test_merge_unmatched_rows_have_nan(self, tmp_path):
        """マッチしない行はNaN"""
        from preprocessing.record_linkage.optional_data_source import merge_optional_data_source

        main_df = pd.DataFrame({
            "water_supply_number": ["001", "002"],
            "normalized_address": ["大手町1-1", "存在しない住所"],
        })

        csv_path = tmp_path / "custom.csv"
        csv_path.write_text(
            "住所,スコア\n"
            "テスト市大手町1丁目1番,99\n",
            encoding="utf-8",
        )

        cfg = {
            "file": "custom.csv",
            "columns": {"address": "住所"},
        }
        result = merge_optional_data_source(main_df, cfg, tmp_path, municipality="テスト市")

        assert result.loc[0, "スコア_ods"] == "99"
        assert pd.isna(result.loc[1, "スコア_ods"])

    def test_merge_deduplicates_by_address(self, tmp_path):
        """同一住所の重複は先頭行を採用"""
        from preprocessing.record_linkage.optional_data_source import merge_optional_data_source

        main_df = pd.DataFrame({
            "water_supply_number": ["001"],
            "normalized_address": ["大手町1-1"],
        })

        csv_path = tmp_path / "custom.csv"
        csv_path.write_text(
            "住所,値\n"
            "テスト市大手町1丁目1番,first\n"
            "テスト市大手町1丁目1番,second\n",
            encoding="utf-8",
        )

        cfg = {
            "file": "custom.csv",
            "columns": {"address": "住所"},
        }
        result = merge_optional_data_source(main_df, cfg, tmp_path, municipality="テスト市")

        assert result.loc[0, "値_ods"] == "first"

    def test_merge_returns_original_when_no_config(self):
        """config=Noneの場合は元のDFをそのまま返す"""
        from preprocessing.record_linkage.optional_data_source import merge_optional_data_source

        main_df = pd.DataFrame({
            "water_supply_number": ["001"],
            "normalized_address": ["大手町1-1"],
        })

        result = merge_optional_data_source(main_df, None, "/tmp")
        assert list(result.columns) == list(main_df.columns)

    def test_merge_stats_uses_sub_side_denominator(self, tmp_path):
        """stats: 分母=追加用データ側の一意住所数、分子=水道に一致した数（#1775 結合率表示）

        水道側=大手町1-1・駅前2-3。追加データ=大手町1-1(一致)・山奥9-9(不一致)。
        → sub_rows=2, matched=1。
        """
        from preprocessing.record_linkage.optional_data_source import merge_optional_data_source

        main_df = pd.DataFrame({
            "water_supply_number": ["001", "002"],
            "normalized_address": ["大手町1-1", "駅前2-3"],
        })

        csv_path = tmp_path / "custom.csv"
        csv_path.write_text(
            "住所,値\n"
            "テスト市大手町1丁目1番,a\n"
            "テスト市山奥9丁目9番,b\n",
            encoding="utf-8",
        )

        cfg = {"file": "custom.csv", "columns": {"address": "住所"}}
        stats = {}
        merge_optional_data_source(main_df, cfg, tmp_path, municipality="テスト市", stats=stats)

        assert stats["sub_rows"] == 2
        assert stats["matched"] == 1
