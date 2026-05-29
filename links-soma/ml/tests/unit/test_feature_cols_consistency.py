"""特徴量カラムの一貫性テスト（#1663）

FEATURE_COLS（39個）を正とし、以下の一貫性を検証する:
- TRANSLATE_COLUMNS_IF001 が FEATURE_COLS 全カラムを翻訳できること
- _JP_TO_EN_FEATURE_MAP が FEATURE_COLS 全カラムを逆引きできること
- years_since_closure（water.py）に統一されていること
"""

import sys
import os

import pytest

# src/ と async_tasks/ を sys.path に追加
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "async_tasks"))

from shared import FEATURE_COLS


class TestYearsSinceClosureUnification:
    """years_since_closure（water.py）への統一を検証"""

    def test_translate_columns_has_years_since_closure(self):
        """TRANSLATE_COLUMNS_IF001 に years_since_closure が存在する"""
        from constants import TRANSLATE_COLUMNS_IF001

        assert "years_since_closure" in TRANSLATE_COLUMNS_IF001, (
            "TRANSLATE_COLUMNS_IF001 に years_since_closure がない"
        )

    def test_translate_columns_no_years_water_closure(self):
        """TRANSLATE_COLUMNS_IF001 に years_water_closure が存在しない"""
        from constants import TRANSLATE_COLUMNS_IF001

        assert "years_water_closure" not in TRANSLATE_COLUMNS_IF001, (
            "TRANSLATE_COLUMNS_IF001 に廃止済みの years_water_closure が残っている"
        )

    def test_jp_to_en_map_resolves_to_years_since_closure(self):
        """_JP_TO_EN_FEATURE_MAP の「閉栓後年数」が years_since_closure にマッピングされる"""
        from E002_Classification.E021 import _JP_TO_EN_FEATURE_MAP

        assert _JP_TO_EN_FEATURE_MAP["閉栓後年数"] == "years_since_closure", (
            f"「閉栓後年数」のマッピング先が {_JP_TO_EN_FEATURE_MAP['閉栓後年数']} "
            f"（期待: years_since_closure）"
        )


class TestFeatureColsConsistency:
    """FEATURE_COLS（39個）と各定義箇所の一貫性を検証"""

    def test_all_feature_cols_in_translate_columns(self):
        """FEATURE_COLS の全カラムが TRANSLATE_COLUMNS_IF001 に存在する"""
        from constants import TRANSLATE_COLUMNS_IF001

        missing = [col for col in FEATURE_COLS
                   if col not in TRANSLATE_COLUMNS_IF001]
        assert missing == [], (
            f"TRANSLATE_COLUMNS_IF001 に不足: {missing}"
        )

    def test_all_feature_cols_in_jp_to_en_map_values(self):
        """FEATURE_COLS の全カラムが _JP_TO_EN_FEATURE_MAP の値に存在する"""
        from E002_Classification.E021 import _JP_TO_EN_FEATURE_MAP

        en_values = set(_JP_TO_EN_FEATURE_MAP.values())
        missing = [col for col in FEATURE_COLS if col not in en_values]
        assert missing == [], (
            f"_JP_TO_EN_FEATURE_MAP の値に不足: {missing}"
        )

    def test_feature_cols_jp_names_roundtrip(self):
        """FEATURE_COLS → 日本語名 → 英語名の往復変換が一致する

        TRANSLATE_COLUMNS_IF001 で日本語化した名前を
        _JP_TO_EN_FEATURE_MAP で英語に戻し、元の英語名と一致することを確認。
        """
        from constants import TRANSLATE_COLUMNS_IF001
        from E002_Classification.E021 import _JP_TO_EN_FEATURE_MAP

        mismatches = []
        for en_col in FEATURE_COLS:
            jp_name = TRANSLATE_COLUMNS_IF001.get(en_col)
            if jp_name is None:
                mismatches.append(f"{en_col}: TRANSLATE_COLUMNS_IF001 に不在")
                continue
            roundtrip = _JP_TO_EN_FEATURE_MAP.get(jp_name)
            if roundtrip != en_col:
                mismatches.append(
                    f"{en_col} → {jp_name} → {roundtrip}（期待: {en_col}）"
                )
        assert mismatches == [], (
            f"往復変換の不一致:\n" + "\n".join(mismatches)
        )
