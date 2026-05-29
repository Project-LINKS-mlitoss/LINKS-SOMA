"""reference_dateがIF001の出力CSVに含まれることを検証する。

背景:
  旧パイプライン(E013)では reference_date_juki_residence カラムを住基台帳処理内で生成し、
  translate_column_name で推定日(reference_date)に変換して出力していた。
  新パイプライン(record_linkage)では同カラムの生成が欠落していたため、
  E022/E032のSQLite挿入で空文字になり、分析画面の地図ビューが表示できなかった。
"""

import os
import tempfile

import pandas as pd
import pytest

from constants import TRANSLATE_COLUMNS_IF001
from E014 import translate_column_name


class TestTranslateColumnsIF001ContainsReferenceDate:
    """TRANSLATE_COLUMNS_IF001にreference_date変換のマッピングが存在すること"""

    def test_reference_date_juki_residence_maps_to_reference_date(self):
        """reference_date_juki_residenceがreference_dateに変換される"""
        assert TRANSLATE_COLUMNS_IF001.get("reference_date_juki_residence") == "reference_date"


class TestTranslateColumnNamePreservesReferenceDate:
    """translate_column_nameがreference_date_juki_residenceを推定日として出力すること"""

    @pytest.fixture
    def csv_with_reference_date(self, tmp_path):
        """reference_date_juki_residenceを含む最小限のCSV"""
        df = pd.DataFrame({
            "normalized_address": ["東京都千代田区1-1"],
            "reference_date_juki_residence": ["2024-01-01"],
        })
        input_path = str(tmp_path / "input.csv")
        output_path = str(tmp_path / "output.csv")
        df.to_csv(input_path, index=False, encoding="utf-8-sig")
        return input_path, output_path

    @pytest.fixture
    def csv_without_reference_date(self, tmp_path):
        """reference_date_juki_residenceを含まないCSV"""
        df = pd.DataFrame({
            "normalized_address": ["東京都千代田区1-1"],
        })
        input_path = str(tmp_path / "input.csv")
        output_path = str(tmp_path / "output.csv")
        df.to_csv(input_path, index=False, encoding="utf-8-sig")
        return input_path, output_path

    def test_reference_date_appears_in_output(self, csv_with_reference_date):
        """カラムが存在する場合、reference_dateとして出力される"""
        input_path, output_path = csv_with_reference_date
        translate_column_name(input_path, output_path)
        result = pd.read_csv(output_path, encoding="utf-8-sig")

        assert "reference_date" in result.columns
        assert result["reference_date"].iloc[0] == "2024-01-01"

    def test_reference_date_absent_when_source_column_missing(self, csv_without_reference_date):
        """カラムが存在しない場合、reference_dateは出力されない"""
        input_path, output_path = csv_without_reference_date
        translate_column_name(input_path, output_path)
        result = pd.read_csv(output_path, encoding="utf-8-sig")

        assert "reference_date" not in result.columns
