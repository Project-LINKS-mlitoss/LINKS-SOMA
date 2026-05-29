"""E014 read_large_csv のfloat精度保持テスト

float64→float32ダウンキャスト廃止（PR #1698）の回帰テスト。
YYYYMMDD形式の8桁日付整数値がfloat32精度ロスで変質しないことを検証する。
"""
from pathlib import Path

import numpy as np
import pandas as pd


class TestReadLargeCSVPrecision:
    """read_large_csv のfloat精度保持テスト"""

    def test_8digit_date_values_preserved(self, tmp_path: Path):
        """20121001 のような8桁日付値が正確に読み込まれる"""
        from src.E001_DataMatching.E014 import read_large_csv

        csv_path = tmp_path / "date_precision.csv"
        df_in = pd.DataFrame({
            "move_date": [20121001.0, 19760808.0, 19710909.0, 20210312.0, 20050302.0],
            "other_col": [1.0, 2.0, 3.0, 4.0, 5.0],
        })
        df_in.to_csv(csv_path, index=False)

        df_out = read_large_csv(str(csv_path))

        assert df_out["move_date"].tolist() == [
            20121001.0, 19760808.0, 19710909.0, 20210312.0, 20050302.0
        ], "8桁日付値はfloat32ダウンキャストで精度ロスしてはならない"

    def test_float_dtype_preserved_as_float64(self, tmp_path: Path):
        """float64カラムがfloat32に落とされない"""
        from src.E001_DataMatching.E014 import read_large_csv

        csv_path = tmp_path / "dtype_test.csv"
        df_in = pd.DataFrame({"value": [1.1, 2.2, 3.3]})
        df_in.to_csv(csv_path, index=False)

        df_out = read_large_csv(str(csv_path))

        assert df_out["value"].dtype == np.float64, (
            f"float64カラムはfloat64のまま読み込まれるべき（現状: {df_out['value'].dtype}）"
        )
