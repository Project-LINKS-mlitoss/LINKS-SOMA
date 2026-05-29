"""E021 モデル構築モジュールの単体テスト

M6 Prior-Rebalanced PU Baggingの各コンポーネントを検証する。
"""

import numpy as np
import pandas as pd
import pytest


class TestFeatureResolution:
    """説明変数のカラム名解決テスト"""

    def test_resolve_english_names(self):
        """英語カラム名はそのまま解決"""
        from E002_Classification.E021 import _resolve_feature_cols

        result = _resolve_feature_cols(
            ["water_disconnection_flag", "avg_water_usage"],
            ["water_disconnection_flag", "avg_water_usage", "other_col"],
        )
        assert result == ["water_disconnection_flag", "avg_water_usage"]

    def test_resolve_japanese_names(self):
        """日本語カラム名は英語名に変換"""
        from E002_Classification.E021 import _resolve_feature_cols

        result = _resolve_feature_cols(
            ["閉栓フラグ"],
            ["water_disconnection_flag", "avg_water_usage"],
        )
        assert result == ["water_disconnection_flag"]

    def test_resolve_missing_columns_skipped(self):
        """DataFrameに存在しないカラムはスキップ"""
        from E002_Classification.E021 import _resolve_feature_cols

        result = _resolve_feature_cols(
            ["nonexistent_col", "water_disconnection_flag"],
            ["water_disconnection_flag", "avg_water_usage"],
        )
        assert result == ["water_disconnection_flag"]

    def test_resolve_empty_list(self):
        """空リストの場合"""
        from E002_Classification.E021 import _resolve_feature_cols

        result = _resolve_feature_cols([], ["col1", "col2"])
        assert result == []


class TestPrepareFeatures:
    """特徴量準備のテスト"""

    def test_nan_imputation(self):
        """NaN値がmedianで補完される"""
        from E002_Classification.E021 import _prepare_features

        df = pd.DataFrame({
            "feat1": [1.0, 2.0, np.nan, 4.0],
            "feat2": [10.0, np.nan, 30.0, 40.0],
        })
        X, cols = _prepare_features(df, ["feat1", "feat2"])
        assert not np.isnan(X).any()
        assert X.shape == (4, 2)

    def test_ysc_cap(self):
        """years_since_closureが15年で上限設定される（F-7）"""
        from E002_Classification.E021 import _prepare_features, YSC_CAP

        df = pd.DataFrame({
            "years_since_closure": [5.0, 20.0, 50.0, 0.0],
        })
        X, cols = _prepare_features(df, ["years_since_closure"])
        assert X[0, 0] == 5.0
        assert X[1, 0] == YSC_CAP
        assert X[2, 0] == YSC_CAP
        assert X[3, 0] == 0.0

    def test_missing_cols_excluded(self):
        """DataFrameに存在しないカラムは除外"""
        from E002_Classification.E021 import _prepare_features

        df = pd.DataFrame({"feat1": [1.0, 2.0]})
        X, cols = _prepare_features(df, ["feat1", "nonexistent"])
        assert cols == ["feat1"]
        assert X.shape == (2, 1)


class TestPriorRebalancing:
    """Prior-Rebalanced Samplingのテスト"""

    def test_basic_rebalancing(self):
        """正例比率がtarget_priorに近づく"""
        from E002_Classification.E021 import _build_prior_rebalanced_data

        rng = np.random.RandomState(42)
        n = 10000
        y = np.zeros(n)
        y[:100] = 1  # 1% positive
        X = rng.randn(n, 5)

        X_rebal, y_rebal = _build_prior_rebalanced_data(X, y, target_prior=0.02)

        actual_prior = y_rebal.mean()
        assert 0.015 < actual_prior < 0.025  # ~2% target

    def test_no_positives(self):
        """正例0件の場合はそのまま返す"""
        from E002_Classification.E021 import _build_prior_rebalanced_data

        X = np.ones((100, 3))
        y = np.zeros(100)
        X_out, y_out = _build_prior_rebalanced_data(X, y)
        assert len(X_out) == 100


class TestPUBagging:
    """PU Baggingのテスト"""

    def test_train_produces_models(self):
        """N_BAGS個のモデルが生成される"""
        from E002_Classification.E021 import _train_pu_bags, DEFAULT_LGB_PARAMS

        rng = np.random.RandomState(42)
        n = 500
        X = rng.randn(n, 5)
        y = np.zeros(n)
        y[:50] = 1

        params = dict(DEFAULT_LGB_PARAMS)
        params["n_estimators"] = 10  # テスト高速化
        models = _train_pu_bags(X, y, params, n_bags=3)

        assert len(models) == 3
        for m in models:
            assert hasattr(m, "predict_proba")

    def test_predict_bags_shape(self):
        """予測の形状が入力行数と一致"""
        from E002_Classification.E021 import _train_pu_bags, _predict_bags, DEFAULT_LGB_PARAMS

        rng = np.random.RandomState(42)
        X_train = rng.randn(200, 3)
        y_train = np.zeros(200)
        y_train[:20] = 1

        params = dict(DEFAULT_LGB_PARAMS)
        params["n_estimators"] = 5
        models = _train_pu_bags(X_train, y_train, params, n_bags=2)

        X_test = rng.randn(50, 3)
        scores = _predict_bags(models, X_test)
        assert scores.shape == (50,)
        assert (scores >= 0).all() and (scores <= 1).all()


class TestEvaluation:
    """評価メトリクスのテスト"""

    def test_evaluate_model_keys(self):
        """必要なメトリクスキーが返される"""
        from E002_Classification.E021 import _evaluate_model

        y_true = np.array([1, 1, 0, 0, 1, 0])
        scores = np.array([0.9, 0.7, 0.3, 0.1, 0.6, 0.2])

        result = _evaluate_model(y_true, scores, recall_target=0.65)
        assert "precisionAt100" in result
        assert "precisionAt500" in result
        assert "precisionAt1000" in result
        assert "precisionAt3000" in result
        assert "precisionAt5000" in result
        assert "liftAt1000" in result
        assert "liftAt5000" in result
        assert "recallTarget" in result
        assert "threshold" in result
        assert "candidateCount" in result
        assert "candidateRatio" in result

    def test_feature_importance_sorted(self):
        """特徴量重要度が降順でソートされる"""
        from E002_Classification.E021 import _compute_feature_importance, DEFAULT_LGB_PARAMS
        import lightgbm as lgb

        rng = np.random.RandomState(42)
        X = rng.randn(200, 3)
        y = (X[:, 0] > 0).astype(int)  # feat0が重要

        m = lgb.LGBMClassifier(**{**DEFAULT_LGB_PARAMS, "n_estimators": 10})
        m.fit(X, y)

        result = _compute_feature_importance([m], ["feat0", "feat1", "feat2"])
        assert len(result) == 3
        # 重要度が降順でソートされている（値の順序を検証）
        values = [float(r["value"]) for r in result]
        assert values == sorted(values, reverse=True)


class TestOdsFeatureResolution:
    """_odsサフィックス付きカラム（説明変数追加用データ）の解決テスト"""

    def test_resolve_ods_columns_by_exact_name(self):
        """_odsカラムはそのままの名前で解決される"""
        from E002_Classification.E021 import _resolve_feature_cols

        result = _resolve_feature_cols(
            ["課税標準額_ods", "建築年_ods", "water_disconnection_flag"],
            ["課税標準額_ods", "建築年_ods", "water_disconnection_flag", "other_col"],
        )
        assert "課税標準額_ods" in result
        assert "建築年_ods" in result
        assert "water_disconnection_flag" in result

    def test_resolve_ods_missing_from_df_skipped(self):
        """DataFrameに存在しない_odsカラムはスキップされる"""
        from E002_Classification.E021 import _resolve_feature_cols

        result = _resolve_feature_cols(
            ["課税標準額_ods", "water_disconnection_flag"],
            ["water_disconnection_flag"],  # _odsカラムなし
        )
        assert result == ["water_disconnection_flag"]
        assert "課税標準額_ods" not in result

    def test_prepare_features_with_numeric_ods(self):
        """数値型の_odsカラムが特徴量行列に正しく含まれる"""
        from E002_Classification.E021 import _prepare_features

        df = pd.DataFrame({
            "water_disconnection_flag": [0, 1, 0, 1],
            "課税標準額_ods": [5000000.0, 3000000.0, np.nan, 4000000.0],
            "建築年_ods": [1990.0, 2005.0, 2010.0, np.nan],
        })
        X, cols = _prepare_features(df, ["water_disconnection_flag", "課税標準額_ods", "建築年_ods"])
        assert len(cols) == 3
        assert "課税標準額_ods" in cols
        assert "建築年_ods" in cols
        assert not np.isnan(X).any()  # NaNがmedianで補完されている
        assert X.shape == (4, 3)

    def test_ods_only_features(self):
        """_odsカラムのみでも特徴量行列が作成できる"""
        from E002_Classification.E021 import _prepare_features

        df = pd.DataFrame({
            "score_ods": [1.0, 2.0, 3.0],
            "rank_ods": [10.0, 20.0, 30.0],
        })
        X, cols = _prepare_features(df, ["score_ods", "rank_ods"])
        assert X.shape == (3, 2)
        assert cols == ["score_ods", "rank_ods"]


class TestDefaultExplanatoryColumns:
    """デフォルト説明変数の整合性テスト

    experiments/shared.py の FEATURE_COLS と同等の説明変数が
    アプリのデフォルト設定から利用可能であることを保証する。
    """

    # experiments/shared.py の FEATURE_COLS に対応する日本語名（39個）
    # TRANSLATE_COLUMNS_IF001 による英→日変換後の名前
    EXPECTED_DEFAULTS = [
        # 水道系
        "閉栓フラグ", "平均検針水量", "年間最大検針水量", "年間合計検針水量",
        "直近４ヶ月の使用量増減率",
        "検針水量（推定月の11・12ヶ月前）", "検針水量（推定月の9・10ヶ月前）",
        "検針水量（推定月の7・8ヶ月前）", "検針水量（推定月の5・6ヶ月前）",
        "検針水量（推定月の3・4ヶ月前）", "検針水量（推定月の1・2ヶ月前）",
        "使用量データあり", "ゼロ使用期数", "最小水道使用量",
        "閉栓後年数",
        "使用量データなし", "前半平均使用水量", "後半平均使用水量",
        "半期変化率", "直近使用水量",
        # 住基系
        "住民データ有無フラグ", "世帯人数", "最大年齢",
        "最大年齢欠損", "65歳以上人数", "15歳未満人数",
        "住定期間", "死亡人数", "転入数", "転出・転居数",
        "一人当たり検針水量",
        # 住基イベント系
        "消除イベントあり", "転出イベント数",
        "最終異動後経過年数", "最終異動経過年数欠損",
        "独居高齢者", "死亡後入居者なし", "世帯縮小率",
        # 交差・ルール系
        "複合ルールスコア",
    ]

    def test_default_columns_exist_in_jp_to_en_map(self):
        """デフォルト説明変数の全カラムが _JP_TO_EN_FEATURE_MAP に存在する"""
        from E002_Classification.E021 import _JP_TO_EN_FEATURE_MAP

        missing = [col for col in self.EXPECTED_DEFAULTS
                   if col not in _JP_TO_EN_FEATURE_MAP]
        assert missing == [], (
            f"_JP_TO_EN_FEATURE_MAP に存在しないデフォルト説明変数: {missing}"
        )

    def test_default_columns_resolvable_with_japanese_csv(self):
        """デフォルト説明変数の全カラムが日本語CSVヘッダーに対して解決可能"""
        from E002_Classification.E021 import _resolve_feature_cols
        from constants import TRANSLATE_COLUMNS_IF001

        # IF001出力CSVのヘッダー（TRANSLATE_COLUMNS_IF001 の日本語値）をシミュレート
        csv_columns = list(TRANSLATE_COLUMNS_IF001.values())

        resolved = _resolve_feature_cols(self.EXPECTED_DEFAULTS, csv_columns)
        unresolved = [col for col in self.EXPECTED_DEFAULTS
                      if col not in resolved]
        assert len(resolved) == len(self.EXPECTED_DEFAULTS), (
            f"解決できなかった説明変数: {unresolved}"
        )


class TestReadCSV:
    """CSV読み込みのテスト"""

    def test_read_utf8_bom(self, tmp_path):
        """UTF-8 BOM付きCSVの読み込み"""
        from E002_Classification.E021 import _read_csv

        path = tmp_path / "test.csv"
        path.write_bytes(b"\xef\xbb\xbfa,b\n1,2\n3,4\n")
        df = _read_csv(str(path))
        assert len(df) == 2
        assert list(df.columns) == ["a", "b"]
