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


class TestRegistrationDurationFeatures:
    """add_registration_duration_features: 案E の経過年数3指標（issue #1777）

    events_json_touki_residence から事由別に満年数を算出する:
    - building_age_years       築年数 = 基準日 − 最古登記日付
    - years_since_inheritance  相続後経過年数 = 基準日 − 直近の相続日
    - years_since_extension    増築後経過年数 = 基準日 − 直近の増築日
    """

    BASE = pd.Timestamp("2025-12-31")

    @staticmethod
    def _df(events):
        import json
        return pd.DataFrame({
            "events_json_touki_residence": [json.dumps(events, ensure_ascii=False)],
        })

    def _run(self, events):
        from src.E001_DataMatching.E014 import add_registration_duration_features
        return add_registration_duration_features(self._df(events), self.BASE)

    def test_case_e_example(self):
        """issue 本文の案E実例: 新築1900 / 相続1954 / 売買1999 → 築125・相続後71・増築なし"""
        result = self._run([
            {"reason": "新築", "date": "19000427", "structure": "木造"},
            {"reason": "相続", "date": "19540101", "structure": "木造"},
            {"reason": "売買", "date": "19990101", "structure": "木造"},
        ])
        assert result["building_age_years"].iloc[0] == "125"
        assert result["years_since_inheritance"].iloc[0] == "71"
        assert result["years_since_extension"].iloc[0] == ""

    def test_extension_detected(self):
        """増築イベントがあれば増築後経過年数を算出（2013増築 → 12年）"""
        result = self._run([
            {"reason": "新築", "date": "19740223", "structure": "木造"},
            {"reason": "増築", "date": "20130201", "structure": "鉄骨造"},
        ])
        assert result["years_since_extension"].iloc[0] == "12"

    def test_multiple_inheritance_uses_latest(self):
        """相続が複数なら直近を採用（判断1）: 1954と2010 → 2010起点の15年"""
        result = self._run([
            {"reason": "相続", "date": "19540101", "structure": "木造"},
            {"reason": "相続", "date": "20100615", "structure": "木造"},
        ])
        assert result["years_since_inheritance"].iloc[0] == "15"

    def test_embedded_date_reason_still_matches(self):
        """登記理由に日付が埋め込まれた形式でも部分一致で相続を検出"""
        result = self._run([
            {"reason": "19540101相続", "date": "19540101", "structure": "木造"},
        ])
        assert result["years_since_inheritance"].iloc[0] == "71"

    def test_future_event_excluded(self):
        """基準日を超える未来日のイベントは除外する"""
        result = self._run([
            {"reason": "新築", "date": "20000101", "structure": "木造"},
            {"reason": "相続", "date": "20990101", "structure": "木造"},
        ])
        assert result["years_since_inheritance"].iloc[0] == ""
        assert result["building_age_years"].iloc[0] == "25"

    def test_no_events_column_adds_empty(self):
        """events_json カラムが無い場合は3指標を空文字で付与"""
        from src.E001_DataMatching.E014 import add_registration_duration_features
        df = pd.DataFrame({"other": [1]})
        result = add_registration_duration_features(df, self.BASE)
        assert result["building_age_years"].iloc[0] == ""
        assert result["years_since_inheritance"].iloc[0] == ""
        assert result["years_since_extension"].iloc[0] == ""
