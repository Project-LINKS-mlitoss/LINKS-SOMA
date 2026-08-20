"""E022 predict_akiya関数のテスト

predict_akiyaは新形式（PU Bagging dict）と旧形式（Booster/LGBMClassifier）の
両方に対応する純粋関数。入出力カラムの構成を検証する。
"""

import numpy as np
import pandas as pd
import pytest
from sklearn.linear_model import LogisticRegression

import E022
from E022 import predict_akiya
from constants import (
    ERROR_20001,
    ERROR_20002,
    ERROR_20003,
    ERROR_20005,
    ERROR_20006,
)


class TestReadCsvErrorCode:
    """read_csv の失敗時に推定の入力エラーコード(R-052/053/054)が設定されること"""

    def test_存在しないファイルはE20003を設定する(self, tmp_path):
        E022.ERROR_CODE = None
        with pytest.raises(FileNotFoundError):
            E022.read_csv(str(tmp_path / "missing.csv"))
        assert E022.ERROR_CODE == ERROR_20003["code"]

    def test_非CSVファイルはE20001を設定する(self, tmp_path):
        path = tmp_path / "data.txt"
        path.write_text("x")
        E022.ERROR_CODE = None
        with pytest.raises(ValueError):
            E022.read_csv(str(path))
        assert E022.ERROR_CODE == ERROR_20001["code"]

    def test_文字コード検出不能はE20002を設定する(self, tmp_path):
        # 空ファイルは chardet が encoding=None を返し detect_encoding が ValueError を送出する
        path = tmp_path / "empty.csv"
        path.write_bytes(b"")
        E022.ERROR_CODE = None
        with pytest.raises(IOError):
            E022.read_csv(str(path))
        assert E022.ERROR_CODE == ERROR_20002["code"]


class TestSaveCsvEncodingFallback:
    """R-056/057: 予測結果CSVの保存をエンコーディングフォールバックで行い、失敗を採番する"""

    def test_正常時はutf8sigで保存しエラーを解除する(self, tmp_path):
        E022.ERROR_CODE = "stale"  # 直前の失敗が残っていても成功で解除されること
        E022.ERROR_MSG = "stale"
        df = pd.DataFrame({"a": [1, 2], "名前": ["甲", "乙"]})
        path = str(tmp_path / "out.csv")

        used = E022.save_csv_with_encoding_fallback(df, path)

        assert used == "utf-8-sig"
        assert E022.ERROR_CODE is None
        roundtrip = pd.read_csv(path, encoding="utf-8-sig")
        assert list(roundtrip["名前"]) == ["甲", "乙"]

    def test_全エンコーディングで保存失敗ならE20006を設定し送出する(self, tmp_path):
        # 存在しないディレクトリ配下のパスはどのエンコーディングでも書けない
        df = pd.DataFrame({"a": [1]})
        bad_path = str(tmp_path / "no_such_dir" / "out.csv")
        E022.ERROR_CODE = None

        with pytest.raises(IOError):
            E022.save_csv_with_encoding_fallback(df, bad_path)

        # 全滅後に最後に設定されるのは R-057(E-20006)
        assert E022.ERROR_CODE == ERROR_20006["code"]
        assert ERROR_20006["code"] == "IF003_e022_err_export_path"
        # 途中で R-056(E-20005) のメッセージ整形も行われる（コード定義の健全性）
        assert ERROR_20005["code"] == "IF003_e022_err_export_encoding"


def _make_pu_bagging_model(n_models=3, n_features=2):
    """テスト用のPU Bagging形式モデル（dict with "models" key）を生成する"""
    X = np.array([[0, 0], [1, 1], [0, 1], [1, 0]])
    y = np.array([0, 1, 0, 1])
    models = []
    for i in range(n_models):
        m = LogisticRegression(random_state=i)
        m.fit(X, y)
        models.append(m)
    return {"models": models, "threshold": 0.5}


@pytest.fixture
def input_df():
    """predict_akiyaへの入力DataFrame"""
    return pd.DataFrame({
        "normalized_address": ["addr1", "addr2", "addr3"],
        "reference_date": ["2024-01-01", "2024-01-01", "2024-01-01"],
    })


@pytest.fixture
def prepared_df():
    """predict_akiyaへの前処理済みDataFrame（説明変数のみ）"""
    return pd.DataFrame({
        "feature_a": [0.1, 0.9, 0.5],
        "feature_b": [0.2, 0.8, 0.3],
    })


class TestPredictAkiyaWithPUBagging:
    """新形式モデル（PU Bagging dict）での予測"""

    def test_output_contains_prediction_columns(self, input_df, prepared_df):
        """predicted_probabilityとpredicted_labelが出力に含まれる"""
        model = _make_pu_bagging_model(n_features=2)
        result = predict_akiya(input_df, prepared_df, model, thresh=0.5)

        assert "predicted_probability" in result.columns
        assert "predicted_label" in result.columns

    def test_output_contains_threshold_label_columns(self, input_df, prepared_df):
        """predicted_label_{05..95}の19カラムが出力に含まれる"""
        model = _make_pu_bagging_model(n_features=2)
        result = predict_akiya(input_df, prepared_df, model, thresh=0.5)

        expected_cols = [f"predicted_label_{t:02d}" for t in range(5, 96, 5)]
        for col in expected_cols:
            assert col in result.columns, f"{col}が出力に含まれていません"
        assert len(expected_cols) == 19

    def test_input_columns_preserved(self, input_df, prepared_df):
        """入力DataFrameの既存カラムが出力にも維持される"""
        model = _make_pu_bagging_model(n_features=2)
        result = predict_akiya(input_df, prepared_df, model, thresh=0.5)

        for col in input_df.columns:
            assert col in result.columns

    def test_predicted_label_matches_threshold(self, input_df, prepared_df):
        """predicted_labelはpredicted_probability > threshの二値化"""
        model = _make_pu_bagging_model(n_features=2)
        result = predict_akiya(input_df, prepared_df, model, thresh=0.5)

        expected = (result["predicted_probability"] > 0.5).astype(int)
        pd.testing.assert_series_equal(
            result["predicted_label"], expected, check_names=False,
        )

    def test_input_df_not_mutated(self, input_df, prepared_df):
        """入力DataFrameが変更されないこと（copyの検証）"""
        original_cols = list(input_df.columns)
        model = _make_pu_bagging_model(n_features=2)
        predict_akiya(input_df, prepared_df, model, thresh=0.5)

        assert list(input_df.columns) == original_cols


class TestPredictAkiyaWithJapaneseFeatures:
    """日本語feat_colsのモデルと日本語カラムのDataFrameでの推定（方針B: 日本語統一）"""

    def test_japanese_feat_cols_with_japanese_csv(self):
        """日本語 feat_cols のモデル + 日本語カラムの DataFrame で正常に予測"""
        # IF001出力（日本語ヘッダー）と E021が保存するモデル（日本語feat_cols）を模倣
        jp_input = pd.DataFrame({
            "normalized_address": ["addr1", "addr2", "addr3"],
            "reference_date": ["2024-01-01", "2024-01-01", "2024-01-01"],
            "特徴量A": [0.1, 0.9, 0.5],
            "特徴量B": [0.2, 0.8, 0.3],
        })
        jp_prepared = pd.DataFrame({
            "特徴量A": [0.1, 0.9, 0.5],
            "特徴量B": [0.2, 0.8, 0.3],
        })

        X = np.array([[0, 0], [1, 1], [0, 1], [1, 0]])
        y = np.array([0, 1, 0, 1])
        models = []
        for i in range(3):
            m = LogisticRegression(random_state=i)
            m.fit(X, y)
            models.append(m)
        model = {"models": models, "threshold": 0.5}

        result = predict_akiya(jp_input, jp_prepared, model, thresh=0.5)

        assert len(result) == 3
        assert "predicted_probability" in result.columns
        assert "predicted_label" in result.columns
        # スコアが 0〜1 の範囲
        assert (result["predicted_probability"] >= 0).all()
        assert (result["predicted_probability"] <= 1).all()


class TestPrepareForEstimationWithOds:
    """_odsカラムを含むモデルでのprepare_for_estimation"""

    def test_ods_columns_included_when_present(self):
        """入力DFに_odsカラムがあればそのまま含まれる"""
        from E022 import prepare_for_estimation

        input_df = pd.DataFrame({
            "water_disconnection_flag": [0, 1],
            "課税標準額_ods": [5000000.0, 3000000.0],
            "other_col": [1, 2],
        })
        feat_cols = ["water_disconnection_flag", "課税標準額_ods"]
        result = prepare_for_estimation(input_df, feat_cols)

        assert list(result.columns) == feat_cols
        assert result["課税標準額_ods"].iloc[0] == 5000000.0

    def test_ods_columns_filled_with_na_when_missing(self):
        """入力DFに_odsカラムがなければNAで埋められる"""
        from E022 import prepare_for_estimation

        input_df = pd.DataFrame({
            "water_disconnection_flag": [0, 1],
        })
        feat_cols = ["water_disconnection_flag", "課税標準額_ods"]
        result = prepare_for_estimation(input_df, feat_cols)

        assert "課税標準額_ods" in result.columns
        assert result["課税標準額_ods"].isna().all()

    def test_predict_with_ods_model(self):
        """_odsカラムを含むモデルで正常に予測できる"""
        input_df = pd.DataFrame({
            "normalized_address": ["addr1", "addr2"],
            "reference_date": ["2024-01-01", "2024-01-01"],
            "score_ods": [0.5, 0.8],
            "rank_ods": [0.3, 0.7],
        })
        prepared_df = pd.DataFrame({
            "score_ods": [0.5, 0.8],
            "rank_ods": [0.3, 0.7],
        })
        model = _make_pu_bagging_model(n_features=2)
        result = predict_akiya(input_df, prepared_df, model, thresh=0.5)

        assert "predicted_probability" in result.columns
        assert "predicted_label" in result.columns
        assert len(result) == 2


class TestCollectOdsColumnsForSqlite:
    """_odsカラムをoptional_data_source JSONに変換するテスト"""

    def test_ods_columns_collected_to_json(self):
        """_odsカラムがJSON文字列に変換され、元カラムが除去される"""
        from E022 import collect_ods_to_json

        df = pd.DataFrame({
            "water_disconnection_flag": [1, 0],
            "建物評価額_ods": ["5000000", "3000000"],
            "築年数_ods": ["35", "12"],
        })
        result = collect_ods_to_json(df)

        assert "optional_data_source" in result.columns
        assert "建物評価額_ods" not in result.columns
        assert "築年数_ods" not in result.columns
        assert "water_disconnection_flag" in result.columns

        import json
        row0 = json.loads(result["optional_data_source"].iloc[0])
        assert row0 == [
            {"name": "建物評価額", "value": "5000000"},
            {"name": "築年数", "value": "35"},
        ]

    def test_no_ods_columns_returns_unchanged(self):
        """_odsカラムがなければそのまま返す"""
        from E022 import collect_ods_to_json

        df = pd.DataFrame({
            "water_disconnection_flag": [1, 0],
            "avg_water_usage": [10.0, 20.0],
        })
        result = collect_ods_to_json(df)

        assert "optional_data_source" not in result.columns
        assert list(result.columns) == list(df.columns)

    def test_nan_ods_values_preserved(self):
        """NaNの_odsカラムもJSON化される（値はnull）"""
        from E022 import collect_ods_to_json

        df = pd.DataFrame({
            "score_ods": ["99", None],
        })
        result = collect_ods_to_json(df)

        import json
        row1 = json.loads(result["optional_data_source"].iloc[1])
        assert row1 == [{"name": "score", "value": None}]

    def test_empty_dataframe(self):
        """空DataFrameは空のまま返す"""
        from E022 import collect_ods_to_json

        df = pd.DataFrame()
        result = collect_ods_to_json(df)
        assert len(result) == 0
        assert "optional_data_source" not in result.columns

    def test_original_dataframe_not_mutated(self):
        """元のDataFrameは変更されない"""
        from E022 import collect_ods_to_json

        df = pd.DataFrame({
            "water_disconnection_flag": [1],
            "score_ods": ["99"],
        })
        original_cols = list(df.columns)
        collect_ods_to_json(df)
        assert list(df.columns) == original_cols

    def test_existing_optional_data_source_column_overwritten(self):
        """optional_data_sourceカラムが既にあっても_odsから生成された値で上書きされる"""
        from E022 import collect_ods_to_json

        df = pd.DataFrame({
            "optional_data_source": ["old_value"],
            "score_ods": ["99"],
        })
        result = collect_ods_to_json(df)

        import json
        parsed = json.loads(result["optional_data_source"].iloc[0])
        assert parsed == [{"name": "score", "value": "99"}]


class TestPredictAkiyaMedianImputation:
    """medians キーの有無によるNaN補完の分岐テスト"""

    def _make_model_with_medians(self, n_features=2):
        """mediansキー付きのPU Bagging形式モデルを生成"""
        model = _make_pu_bagging_model(n_models=3, n_features=n_features)
        model["medians"] = {"feature_a": 50.0, "feature_b": 100.0}
        model["ysc_cap"] = 15.0
        return model

    def test_with_medians_nan_filled_by_median_value(self):
        """mediansキーありの場合、NaN入力がmedian値で補完された場合と同じスコアになる"""
        input_df = pd.DataFrame({"normalized_address": ["addr1"]})
        # 全NaN入力
        nan_prepared = pd.DataFrame({"feature_a": [np.nan], "feature_b": [np.nan]})
        # median値を直接入力
        filled_prepared = pd.DataFrame({"feature_a": [50.0], "feature_b": [100.0]})

        model = self._make_model_with_medians()

        result_nan = predict_akiya(input_df.copy(), nan_prepared, model, thresh=0.5)
        result_filled = predict_akiya(input_df.copy(), filled_prepared, model, thresh=0.5)

        assert result_nan["predicted_probability"].iloc[0] == pytest.approx(
            result_filled["predicted_probability"].iloc[0]
        )

    def test_without_medians_nan_filled_by_zero(self):
        """mediansキーなしの場合、NaN入力が0で補完された場合と同じスコアになる"""
        input_df = pd.DataFrame({"normalized_address": ["addr1"]})
        nan_prepared = pd.DataFrame({"feature_a": [np.nan], "feature_b": [np.nan]})
        zero_prepared = pd.DataFrame({"feature_a": [0.0], "feature_b": [0.0]})

        model = _make_pu_bagging_model(n_models=3, n_features=2)

        result_nan = predict_akiya(input_df.copy(), nan_prepared, model, thresh=0.5)
        result_zero = predict_akiya(input_df.copy(), zero_prepared, model, thresh=0.5)

        assert result_nan["predicted_probability"].iloc[0] == pytest.approx(
            result_zero["predicted_probability"].iloc[0]
        )

    def test_median_vs_zero_fill_produces_different_scores(self):
        """median補完と0補完でNaN行のスコアが異なること"""
        input_df = pd.DataFrame({"normalized_address": ["addr1"]})
        prepared_df = pd.DataFrame({"feature_a": [np.nan], "feature_b": [np.nan]})

        model_with = self._make_model_with_medians()
        model_without = _make_pu_bagging_model(n_models=3, n_features=2)

        result_with = predict_akiya(input_df.copy(), prepared_df.copy(), model_with, thresh=0.5)
        result_without = predict_akiya(input_df.copy(), prepared_df.copy(), model_without, thresh=0.5)

        score_with = result_with["predicted_probability"].iloc[0]
        score_without = result_without["predicted_probability"].iloc[0]
        assert score_with != score_without

    def test_ysc_cap_clips_years_since_closure(self):
        """years_since_closure=100とysc_cap値(15)で同じスコアになる（クリップの検証）"""
        input_df = pd.DataFrame({"normalized_address": ["addr1", "addr2"]})
        # 100.0はysc_cap=15.0にクリップされるはず
        prepared_over = pd.DataFrame({"feature_a": [0.5], "years_since_closure": [100.0]})
        prepared_cap = pd.DataFrame({"feature_a": [0.5], "years_since_closure": [15.0]})

        model = _make_pu_bagging_model(n_models=3, n_features=2)
        model["medians"] = {"feature_a": 0.0, "years_since_closure": 3.0}
        model["ysc_cap"] = 15.0

        input_one = pd.DataFrame({"normalized_address": ["addr1"]})
        result_over = predict_akiya(input_one.copy(), prepared_over, model, thresh=0.5)
        result_cap = predict_akiya(input_one.copy(), prepared_cap, model, thresh=0.5)

        assert result_over["predicted_probability"].iloc[0] == pytest.approx(
            result_cap["predicted_probability"].iloc[0]
        )

    def test_prepared_df_not_mutated_with_medians(self):
        """mediansキーありでもprepared_dfが変更されないこと"""
        input_df = pd.DataFrame({"normalized_address": ["addr1"]})
        prepared_df = pd.DataFrame({"feature_a": [np.nan], "feature_b": [0.5]})
        original_values = prepared_df.copy()
        model = self._make_model_with_medians()

        predict_akiya(input_df, prepared_df, model, thresh=0.5)

        pd.testing.assert_frame_equal(prepared_df, original_values)


class TestPredictAkiyaWithEmptyInput:
    """空DataFrameでの予測"""

    def test_empty_input_returns_empty_with_all_columns(self):
        """空DataFrameでもエラーにならず、全予測カラムが定義される"""
        empty_input = pd.DataFrame({"normalized_address": pd.Series(dtype="str")})
        empty_prepared = pd.DataFrame({"feature_a": pd.Series(dtype="float")})
        model = _make_pu_bagging_model()

        result = predict_akiya(empty_input, empty_prepared, model, thresh=0.5)

        assert len(result) == 0
        assert "predicted_probability" in result.columns
        assert "predicted_label" in result.columns
        expected_threshold_cols = [f"predicted_label_{t:02d}" for t in range(5, 96, 5)]
        for col in expected_threshold_cols:
            assert col in result.columns
