"""エラー文面へ添える「対象ファイル」文脈解決（FR004-007 / #1849）の単体テスト。

ねらい:
- 登録ファイル名（raw_data_sets.file_name）を payload の path / canonical 名から解決できる
- 解決不能（未登録・未接続・不整合）でも空文字へ安全にフォールバックし本文を壊さない
- 種別名の有無で文脈行の形が変わる（E-0008=名前＋種別 / E-101=名前のみ）
"""

from error_file_context import (
    annotate_registered_files,
    build_path_label_map,
    file_context_prefix,
    prepend_file_context,
    resolve_by_dataset,
    resolve_by_datasets,
    resolve_by_path,
)


class TestFileContextPrefix:
    """文脈行の組み立て: 種別名の有無で形が変わる"""

    def test_名前と種別名を括弧で添える(self):
        assert (
            file_context_prefix("err_usage_.csv", "水道使用量")
            == "【対象ファイル】err_usage_.csv（水道使用量）"
        )

    def test_種別名なしは名前のみ(self):
        assert file_context_prefix("err_usage_.csv") == "【対象ファイル】err_usage_.csv"

    def test_ファイル名が空なら空文字(self):
        assert file_context_prefix("") == ""
        assert file_context_prefix(None) == ""


class TestPrependFileContext:
    """本文への前置: prefix が空なら本文不変"""

    def test_prefixありは改行で前置(self):
        assert prepend_file_context("本文", "【対象ファイル】x") == "【対象ファイル】x\n本文"

    def test_prefixなしは本文のまま(self):
        assert prepend_file_context("本文", "") == "本文"


class TestBuildPathLabelMap:
    """data_dict → {file_path(basename): 種別名}: 未登録スロットは空種別"""

    def test_既知スロットは種別名_未知スロットは空(self):
        data_dict = {
            "water_status": {"path": "uuid-a.csv"},
            "water_usage": {"path": "dir/uuid-b.csv"},  # basename に正規化される
            "unknown_slot": {"path": "uuid-c.csv"},
            "no_path": {"columns": {}},  # path 無しは無視
        }
        result = build_path_label_map(data_dict)
        assert result == {
            "uuid-a.csv": "水道閉開栓状況",
            "uuid-b.csv": "水道使用量",
            "uuid-c.csv": "",
        }


class TestResolveByPath:
    """パス起点の解決（E-0008 用）"""

    def _fixture(self):
        name_map = {"uuid-a.csv": "err_status_noaddr.csv"}
        label_map = {"uuid-a.csv": "水道閉開栓状況"}
        return name_map, label_map

    def test_登録名と種別名を解決(self):
        name_map, label_map = self._fixture()
        assert (
            resolve_by_path("/tmp/job/uuid-a.csv", name_map, label_map)
            == "【対象ファイル】err_status_noaddr.csv（水道閉開栓状況）"
        )

    def test_種別名が空なら名前のみ(self):
        name_map, _ = self._fixture()
        assert (
            resolve_by_path("uuid-a.csv", name_map, {"uuid-a.csv": ""})
            == "【対象ファイル】err_status_noaddr.csv"
        )

    def test_登録名なしは空文字(self):
        assert resolve_by_path("uuid-x.csv", {}, {}) == ""

    def test_パスなしは空文字(self):
        name_map, label_map = self._fixture()
        assert resolve_by_path(None, name_map, label_map) == ""


class TestAnnotateRegisteredFiles:
    """本文中の内部ファイル名(UUID)を登録名へ一括置換（記録の単一口用）"""

    def test_本文のfile_pathを登録名へ置換(self):
        name_map = {"uuid-a.csv": "err_polygon.csv"}
        msg = "ファイル uuid-a.csv の読み込み中にエラーが発生しました。 [E-0014]"
        assert (
            annotate_registered_files(msg, name_map)
            == "ファイル err_polygon.csv の読み込み中にエラーが発生しました。 [E-0014]"
        )

    def test_フルパスでもbasename一致で置換(self):
        name_map = {"uuid-a.gpkg": "建物ポリゴン.gpkg"}
        msg = "ファイル /tmp/out/uuid-a.gpkg を読み込めません。"
        assert "建物ポリゴン.gpkg" in annotate_registered_files(msg, name_map)

    def test_登録に無いパスは素通し(self):
        msg = "ファイル intermediate.csv の読み込み中にエラー。"
        assert annotate_registered_files(msg, {"uuid-x.csv": "x.csv"}) == msg

    def test_空マップ_空本文は不変(self):
        assert annotate_registered_files("本文", {}) == "本文"
        assert annotate_registered_files("", {"a": "b"}) == ""


class TestResolveByDataset:
    """canonical データセット起点の解決（E-101 用）: 名前のみ添える"""

    def test_canonicalからスロット経由で登録名を解決(self):
        data_dict = {"water_status": {"path": "uuid-a.csv"}}
        name_map = {"uuid-a.csv": "err_status_noaddr.csv"}
        # suido_status → water_status → uuid-a.csv → err_status_noaddr.csv（種別名は本文側）
        assert (
            resolve_by_dataset("suido_status", data_dict, name_map)
            == "【対象ファイル】err_status_noaddr.csv"
        )

    def test_未知canonicalは空文字(self):
        assert resolve_by_dataset("unknown", {"water_status": {"path": "a.csv"}}, {}) == ""

    def test_スロット欠落は空文字(self):
        assert resolve_by_dataset("suido_status", {}, {"a.csv": "x"}) == ""

    def test_登録名なしは空文字(self):
        data_dict = {"water_status": {"path": "uuid-a.csv"}}
        assert resolve_by_dataset("suido_status", data_dict, {}) == ""


class TestResolveByDatasets:
    """複数 canonical 起点の解決（E-103 用）: 関与ファイルを併記し各々へ種別名を添える"""

    def _data_dict(self):
        return {
            "water_status": {"path": "uuid-a.csv"},
            "water_usage": {"path": "dir/uuid-b.csv"},  # basename に正規化される
        }

    def _name_map(self):
        return {"uuid-a.csv": "水道閉開栓状況.csv", "uuid-b.csv": "水道使用量.csv"}

    def test_関与2ファイルを種別名つきで併記(self):
        assert (
            resolve_by_datasets(
                ["suido_status", "suido_use"], self._data_dict(), self._name_map()
            )
            == "【対象ファイル】水道閉開栓状況.csv（水道閉開栓状況）・水道使用量.csv（水道使用量）"
        )

    def test_解決できたものだけを並べる(self):
        # 片方が未登録でも、解決できた側は案内に残す（両方消すと手掛かりが無くなる）
        assert (
            resolve_by_datasets(
                ["suido_status", "suido_use"],
                self._data_dict(),
                {"uuid-a.csv": "水道閉開栓状況.csv"},
            )
            == "【対象ファイル】水道閉開栓状況.csv（水道閉開栓状況）"
        )

    def test_1つも解決できなければ空文字(self):
        assert resolve_by_datasets(["suido_status", "suido_use"], {}, {}) == ""

    def test_未知canonicalは読み飛ばす(self):
        assert (
            resolve_by_datasets(
                ["unknown", "suido_status"], self._data_dict(), self._name_map()
            )
            == "【対象ファイル】水道閉開栓状況.csv（水道閉開栓状況）"
        )
