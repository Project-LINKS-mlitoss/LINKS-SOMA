"""IF003のしきい値解決ロジックのテスト

しきい値は3段のフォールバックで解決される:
  UI指定値 > モデル内蔵値(threshold > recall_target) > デフォルト(0.5)

resolve_threshold_from_artifactは純粋関数として抽出済み。
resolve_thresholdはファイルI/Oを伴うため、モデルZIPを使うテストのみ統合的に検証する。
"""

import os
import tempfile
import zipfile

import joblib
import pytest

from threshold import (
    DEFAULT_THRESHOLD,
    resolve_threshold,
    resolve_threshold_from_artifact,
)


class TestResolveThresholdFromArtifact:
    """モデルアーティファクトからしきい値を解決する純粋関数のテスト"""

    def test_threshold_key_used(self):
        """thresholdキーがあればその値を返す"""
        artifact = {"threshold": 0.3, "recall_target": 0.7}
        assert resolve_threshold_from_artifact(artifact) == 0.3

    def test_recall_target_fallback(self):
        """thresholdキーがなくrecall_targetがあればその値を返す"""
        artifact = {"recall_target": 0.7}
        assert resolve_threshold_from_artifact(artifact) == 0.7

    def test_default_when_no_keys(self):
        """どちらのキーもなければデフォルト(0.5)を返す"""
        artifact = {"models": []}
        assert resolve_threshold_from_artifact(artifact) == DEFAULT_THRESHOLD

    def test_non_dict_returns_default(self):
        """dictでない場合はデフォルト(0.5)を返す"""
        assert resolve_threshold_from_artifact(None) == DEFAULT_THRESHOLD
        assert resolve_threshold_from_artifact("string") == DEFAULT_THRESHOLD


class TestResolveThreshold:
    """しきい値解決の統合テスト（UI指定 / モデルZIP / デフォルト）"""

    def test_ui_value_takes_priority(self):
        """UI指定値がある場合はモデルを読まずにその値を返す"""
        result = resolve_threshold("0.35", model_path="/nonexistent", logger=None)
        assert result == 0.35

    def test_ui_value_converted_to_float(self):
        """UI指定値は文字列からfloatに変換される"""
        result = resolve_threshold("0.8", model_path="/nonexistent", logger=None)
        assert isinstance(result, float)

    def test_model_threshold_extracted_from_zip(self, tmp_path):
        """モデルZIPからthresholdを読み取る"""
        artifact = {"threshold": 0.42, "models": []}
        pkl_path = tmp_path / "model.pkl"
        joblib.dump(artifact, pkl_path)

        zip_path = str(tmp_path / "model.zip")
        with zipfile.ZipFile(zip_path, "w") as zf:
            zf.write(pkl_path, "model.pkl")

        result = resolve_threshold(None, zip_path, logger=None)
        assert result == 0.42

    def test_default_when_model_path_invalid(self):
        """モデルパスが不正な場合はデフォルト(0.5)を返す"""
        result = resolve_threshold(None, "/nonexistent/model.zip", logger=None)
        assert result == DEFAULT_THRESHOLD
