"""処理対象選定用データ（建物ポリゴン）の家屋種別判定と内訳集計のテスト

検証対象: building_type_filter の純粋関数2つ。
- classify_building_type: 重なった建物ポリゴンの種別から、残す/除外する/種別不明 を決める
- summarize_building_types: 結果画面の【家屋種別】に出す内訳を作る

期待値の根拠:
- 内訳の2件数の合計は母数に一致する（受け取った側が検算できる状態を保つ）
- 指定種別を1つでも含むなら残す（住宅の誤除外は利用者が気付けないため）
"""

import pandas as pd

from building_type_filter import (
    classify_building_type,
    normalize_building_type_column,
    summarize_building_types,
)

RESIDENTIAL = ["住宅", "店舗等併用住宅"]


class TestClassifyBuildingType:
    """点に重なった建物ポリゴンの種別から、その行の扱いを決める"""

    def test_指定種別のポリゴン内なら種別を返す(self):
        """spec: 残す行には確定した家屋種別を記録する"""
        assert classify_building_type({"住宅"}, RESIDENTIAL) == "住宅"

    def test_指定種別以外のポリゴン内なら除外(self):
        """spec: 推定対象から外す行は None で示す"""
        assert classify_building_type({"工場"}, RESIDENTIAL) is None

    def test_どのポリゴンにも重ならなければ種別不明(self):
        """spec: 建物が無い場所の行は残すが種別は特定できない"""
        assert classify_building_type(set(), RESIDENTIAL) == ""

    def test_種別が空のポリゴン内なら種別不明(self):
        """spec: 種別が分からないことは住宅でないことを意味しないため残す"""
        assert classify_building_type({""}, RESIDENTIAL) == ""

    def test_種別が不明のポリゴン内なら種別不明(self):
        """spec: 文字列「不明」は空欄と同じく種別未確定として扱う"""
        assert classify_building_type({"不明"}, RESIDENTIAL) == ""

    def test_指定種別と非住宅が重なったら残す(self):
        """spec: 建物ポリゴンが重複する地点では指定種別を優先して残す

        住宅を誤って除外すると推定結果に一切現れず利用者が気付けない。
        非住宅を残した場合は一覧に出るため目視で気付ける。
        """
        assert classify_building_type({"住宅", "工場"}, RESIDENTIAL) == "住宅"

    def test_非住宅と種別不明が重なったら除外(self):
        """spec: 指定種別を1つも含まず判明した種別があるなら対象外の建物"""
        assert classify_building_type({"工場", ""}, RESIDENTIAL) is None

    def test_不明を選択種別に含めたら残す(self):
        """spec: 「不明」も選択肢に出るため選ばれうる。選ばれていれば残す対象

        残すかどうかと、種別を特定できたかは別の問い。残したうえで内訳の
        「種別不明」に数える（summarize_building_types 側）。
        """
        assert classify_building_type({"不明"}, ["住宅", "不明"]) == "不明"

    def test_不明を選択種別に含めたら非住宅と重なっても残す(self):
        """spec: 指定種別を1つでも含めば残す、という規則は「不明」にも同じく効く"""
        assert classify_building_type({"不明", "工場"}, ["住宅", "不明"]) == "不明"

    def test_複数の指定種別が重なったら選択順で先の種別を採る(self):
        """spec: 同じ入力なら毎回同じ種別を採る（集合の反復順に依存させない）"""
        matched = {"店舗等併用住宅", "住宅"}
        assert classify_building_type(matched, RESIDENTIAL) == "住宅"
        assert classify_building_type(matched, ["店舗等併用住宅", "住宅"]) == "店舗等併用住宅"


class TestSummarizeBuildingTypes:
    """結果画面の【家屋種別】に出す内訳を組み立てる"""

    def test_指定種別と種別不明の件数が母数に一致する(self):
        """spec: 2件数の合計が母数と合わないと受け取った側が検算できない"""
        result = summarize_building_types(
            ["住宅", "住宅", "", "店舗等併用住宅", ""], RESIDENTIAL
        )
        breakdown = result["building_type_breakdown"]
        assert breakdown["user_specified"]["count"] == 3
        assert breakdown["unknown"]["count"] == 2
        assert result["building_type_breakdown_total"] == 5

    def test_構成比は母数に対する百分率(self):
        """spec: 4件中1件が指定種別なら25%"""
        result = summarize_building_types(["住宅", "", "", ""], RESIDENTIAL)
        breakdown = result["building_type_breakdown"]
        assert breakdown["user_specified"]["percentage"] == 25.0
        assert breakdown["unknown"]["percentage"] == 75.0

    def test_0件でもゼロ除算しない(self):
        """spec: 絞り込み結果が0件でも構成比は0%として出す"""
        result = summarize_building_types([], RESIDENTIAL)
        breakdown = result["building_type_breakdown"]
        assert breakdown["user_specified"]["percentage"] == 0.0
        assert breakdown["unknown"]["percentage"] == 0.0
        assert result["building_type_breakdown_total"] == 0

    def test_不明は指定種別に数えない(self):
        """spec: 「不明」を選択種別に含めても種別確定としては数えない"""
        result = summarize_building_types(["不明", "住宅"], ["住宅", "不明"])
        breakdown = result["building_type_breakdown"]
        assert breakdown["user_specified"]["count"] == 1
        assert breakdown["unknown"]["count"] == 1


class TestNormalizeBuildingTypeColumn:
    """建物ポリゴンの家屋種別を、利用者が選択肢として見た文字列表現に揃える"""

    def test_文字列の列はそのまま(self):
        """spec: 文字列の種別は変換しない。欠損は空文字にする"""
        values = pd.Series(["住宅", None, "工場"])
        assert normalize_building_type_column(values).tolist() == ["住宅", "", "工場"]

    def test_整数コードは小数点を付けない(self):
        """spec: 欠損を含む整数列は float64 で読まれるが選択肢は "401" 形式

        小数点付き（"401.0"）にすると選択値と一致せず、建物ポリゴン内の行が
        全件「指定外の種別」と判定されて除外される。
        """
        values = pd.Series([401.0, None, 402.0])
        assert normalize_building_type_column(values).tolist() == ["401", "", "402"]

    def test_整数型の列も文字列にする(self):
        """spec: 欠損がなければ int64 で読まれる。表現は同じ"""
        values = pd.Series([401, 402], dtype="int64")
        assert normalize_building_type_column(values).tolist() == ["401", "402"]

    def test_小数を持つ値は小数のまま(self):
        """spec: 実際に小数部を持つ値まで整数へ丸めない"""
        values = pd.Series([1.5, 2.0])
        assert normalize_building_type_column(values).tolist() == ["1.5", "2"]
