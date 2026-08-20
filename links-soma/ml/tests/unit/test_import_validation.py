"""インポート時の構造ガード（FR004-007）の単体テスト。

処理本体が入力を消費する前の致命チェックを固定する:
必須カラム未指定（E-101・ensure_required_columns）/ 文字コード判別不能（read_csv_checked）/
説明変数ゼロ一致（E-20004・feature_columns_all_absent）。

行単位の品質サマリー（取込成功率・E-202/E-203 集計）は本モジュールに無いためテストも持たない。
品質の定義がデータの業務的文脈に依存し機械判定できないため（検討: issue #1901）。
"""

import pandas as pd
import pytest

from preprocessing.import_validation import (
    REQUIRED_COLUMNS_BY_DATASET,
    EncodingDetectionError,
    MissingRequiredColumnsError,
    describe_missing_columns,
    ensure_required_columns,
    feature_columns_all_absent,
    read_csv_checked,
)


class TestEnsureRequiredColumns:
    """宣言契約に対する必須カラムガード（E-101・致命）"""

    def test_必須カラムが揃っていれば例外を出さない(self):
        ensure_required_columns(["address", "water_supply_number", "他"], "suido_status")

    def test_必須カラムが無ければ例外を送出しdatasetと列名を持つ(self):
        with pytest.raises(MissingRequiredColumnsError) as exc:
            ensure_required_columns(["別の列"], "suido_status")
        assert exc.value.dataset == "suido_status"
        assert exc.value.columns == ["address", "water_supply_number"]

    def test_使用量データは3つの必須カラムを要求する(self):
        with pytest.raises(MissingRequiredColumnsError) as exc:
            ensure_required_columns(["water_supply_number"], "suido_use")
        assert exc.value.columns == ["meter_reading_date", "suido_usage"]

    def test_契約の無いdatasetは検査しない(self):
        ensure_required_columns([], "未登録データセット")

    def test_契約は4つの入力データを宣言している(self):
        assert set(REQUIRED_COLUMNS_BY_DATASET) == {
            "suido_status",
            "suido_use",
            "juki",
            "touki",
        }


class TestDescribeMissingColumns:
    """E-101 メッセージ用の職員向け日本語整形（内部名を画面語彙へ）"""

    def test_データセットとカラムを日本語ラベルで整形する(self):
        assert (
            describe_missing_columns("suido_status", ["address", "water_supply_number"])
            == "水道閉開栓状況: 住所・水道番号"
        )

    def test_使用量の検針日と使用量も日本語になる(self):
        assert (
            describe_missing_columns("suido_use", ["meter_reading_date", "suido_usage"])
            == "水道使用量: 水道検針年月日・水道使用量"
        )

    def test_未登録の名前はそのまま返す_フォールバック(self):
        assert describe_missing_columns("未知DS", ["未知列"]) == "未知DS: 未知列"


class TestReadCsvChecked:
    """文字コード判別不能（E-001）の検出。read_csv のラッパ。"""

    def test_UTF8は通常通り読める(self, tmp_path):
        path = tmp_path / "ok.csv"
        path.write_text("住所,水道番号\n東京,A1\n", encoding="utf-8")
        df = read_csv_checked(path)
        assert list(df.columns) == ["住所", "水道番号"]
        assert len(df) == 1

    def test_UTF8として読めない文字コードは例外に変換する(self, tmp_path):
        path = tmp_path / "sjis.csv"
        # Shift-JIS の日本語は UTF-8 デコードで必ず失敗する
        path.write_bytes("住所,水道番号\n大阪,B2\n".encode("shift_jis"))
        with pytest.raises(EncodingDetectionError) as exc:
            read_csv_checked(path)
        assert str(path) == exc.value.path


class TestFeatureColumnsAllAbsent:
    """R-055(E-20004) 判定: モデルの説明変数が入力列に1つも無いか（ゼロ一致）"""

    def test_全ての説明変数が存在すればFalse(self):
        cols = ["a", "b", "c"]
        assert feature_columns_all_absent(cols, ["a", "b"]) is False

    def test_一部だけ存在すればFalse_部分欠損は許容(self):
        # 部分欠損は predict 側の median 補完で吸収する設計のため致命ではない
        cols = ["a", "x"]
        assert feature_columns_all_absent(cols, ["a", "b"]) is False

    def test_1つも存在しなければTrue_別データセット(self):
        cols = ["x", "y"]
        assert feature_columns_all_absent(cols, ["a", "b"]) is True

    def test_説明変数が空ならFalse_モデルが要求しない(self):
        assert feature_columns_all_absent(["x"], []) is False

    def test_pandas_Indexを列として受け取れる(self):
        df = pd.DataFrame({"x": [1], "y": [2]})
        assert feature_columns_all_absent(df.columns, ["a"]) is True
        assert feature_columns_all_absent(df.columns, ["x"]) is False
