"""しきい値解決ロジック

IF003で使用する推定しきい値を解決する。
優先順位: UI指定値 > モデル内蔵値(threshold > recall_target) > デフォルト(0.5)
"""

import os
import shutil


DEFAULT_THRESHOLD = 0.5


def resolve_threshold_from_artifact(artifact):
    """モデルアーティファクト(dict)からしきい値を解決する。

    優先順位: threshold > recall_target > DEFAULT_THRESHOLD(0.5)
    """
    if not isinstance(artifact, dict):
        return DEFAULT_THRESHOLD
    return artifact.get("threshold", artifact.get("recall_target", DEFAULT_THRESHOLD))


def resolve_threshold(ui_value, model_path, logger=None):
    """しきい値を解決する。UI指定値 > モデル内蔵値 > デフォルト(0.5)"""
    if ui_value is not None:
        return float(ui_value)

    # モデルからしきい値を読み取り（新形式PU Bagging対応）
    try:
        import joblib
        import zipfile as _zf
        import tempfile
        with tempfile.TemporaryDirectory() as _tmp:
            with _zf.ZipFile(model_path) as zf:
                zf.extractall(_tmp)
            _pkl = os.path.join(_tmp, "model.pkl")
            if os.path.exists(_pkl):
                _artifact = joblib.load(_pkl)
                threshold_value = resolve_threshold_from_artifact(_artifact)
                if logger:
                    logger.info(f"  モデルからしきい値を取得: {threshold_value}")
            else:
                threshold_value = DEFAULT_THRESHOLD
    except Exception:
        threshold_value = DEFAULT_THRESHOLD
    return threshold_value
