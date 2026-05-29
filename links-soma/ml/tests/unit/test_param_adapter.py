"""param_adapter モジュールの単体テスト

UIパラメータ（JSON）から内部設定（city_cfg）への変換ロジックの検証。
"""


def _sample_params():
    return {
        "data": {
            "water_status": {
                "path": "uploads/1_suido.csv",
                "columns": {
                    "water_supply_number": "水道番号",
                    "address": "設置場所",
                    "water_connection_date": "使用開始日",
                    "water_disconnection_date": "使用中止日",
                },
            },
            "water_usage": {
                "path": "uploads/2_suido_use.csv",
                "columns": {
                    "water_supply_number": "水道番号",
                    "water_recorded_date": "検針年月日",
                    "water_usage": "使用水量",
                },
            },
            "resident_registry": {
                "path": "uploads/3_juki.csv",
                "columns": {
                    "household_code": "世帯コード",
                    "address": "住所",
                    "birth_date": "生年月日",
                    "resident_date": "住定異動年月日",
                    "reason_transfer": "住記異動事由",
                    "date_transfer": "異動年月日",
                },
            },
            "building_registry": {
                "path": "uploads/4_touki.csv",
                "columns": {
                    "address": "住所",
                    "structure_name": "建物構造",
                    "registration_reason": "登記種類",
                    "registration_date": "登記日付",
                },
            },
            "geocoding": {
                "path": "uploads/7_geocoding.csv",
                "columns": {
                    "address": "住所",
                    "latitude": "緯度",
                    "longitude": "経度",
                },
            },
        },
        "settings": {
            "reference_date": "2024-03-31",
        },
    }


class TestParamAdapter:
    """UIパラメータ→city_cfg変換のテスト"""

    def test_basic_conversion(self):
        """基本的なパラメータ変換"""
        from preprocessing.param_adapter import build_runtime_config

        cfg = build_runtime_config(_sample_params(), "/app/data")
        assert cfg["standard_date"] == "2024-03-31"
        assert cfg["has_touki"] is True

    def test_water_status_columns(self):
        """水道データのカラムマッピング"""
        from preprocessing.param_adapter import build_runtime_config

        cfg = build_runtime_config(_sample_params(), "/app/data")
        ws = cfg["suido_status"]["columns"]
        assert ws["water_supply_number"] == "水道番号"
        assert ws["address"] == "設置場所"
        assert ws["usage_start_date"] == "使用開始日"
        assert ws["usage_end_date"] == "使用中止日"

    def test_juki_columns(self):
        """住民基本台帳のカラムマッピング"""
        from preprocessing.param_adapter import build_runtime_config

        cfg = build_runtime_config(_sample_params(), "/app/data")
        juki = cfg["juki"]["columns"]
        assert juki["household_code"] == "世帯コード"
        assert juki["move_date"] == "住定異動年月日"

    def test_touki_columns(self):
        """登記簿のカラムマッピング"""
        from preprocessing.param_adapter import build_runtime_config

        cfg = build_runtime_config(_sample_params(), "/app/data")
        touki = cfg["touki"]["columns"]
        assert touki["registration_reason"] == "登記種類"
        assert touki["structure"] == "建物構造"

    def test_no_touki(self):
        """登記簿なしの場合"""
        from preprocessing.param_adapter import build_runtime_config

        params = _sample_params()
        del params["data"]["building_registry"]
        cfg = build_runtime_config(params, "/app/data")
        assert cfg["has_touki"] is False
        assert cfg["touki"] is None

    def test_no_labels_by_default(self):
        """ラベルパラメータなし（デフォルト）"""
        from preprocessing.param_adapter import build_runtime_config

        cfg = build_runtime_config(_sample_params(), "/app/data")
        assert cfg["labels"] is None

    def test_labels_when_provided(self):
        """ラベルパラメータあり"""
        from preprocessing.param_adapter import build_runtime_config

        params = _sample_params()
        params["data"]["labels"] = {
            "path": "uploads/akiya.csv",
            "address_col": "住所",
            "vacant_type_val": "空き家",
            "vacant_source_val": "テスト市",
        }
        cfg = build_runtime_config(params, "/app/data")
        assert cfg["labels"] is not None
        assert cfg["labels"]["address_col"] == "住所"

    def test_file_basename_extraction(self):
        """ファイルパスからbasenameが正しく抽出される"""
        from preprocessing.param_adapter import build_runtime_config

        cfg = build_runtime_config(_sample_params(), "/app/data")
        assert cfg["suido_status"]["file"] == "1_suido.csv"
        assert cfg["suido_use"]["files"] == ["2_suido_use.csv"]

    def test_optional_data_source_in_config(self):
        """optional_data_sourceを含むパラメータが正しく変換される"""
        from preprocessing.param_adapter import build_runtime_config

        params = _sample_params()
        params["data"]["optional_data_source"] = {
            "path": "uploads/custom_data.csv",
            "columns": {"address": "所在地"},
        }
        cfg = build_runtime_config(params, "/app/data")
        assert cfg["optional_data_source"] is not None
        assert cfg["optional_data_source"]["file"] == "custom_data.csv"
        assert cfg["optional_data_source"]["columns"]["address"] == "所在地"

    def test_optional_data_source_absent(self):
        """optional_data_sourceなしの場合はNone"""
        from preprocessing.param_adapter import build_runtime_config

        cfg = build_runtime_config(_sample_params(), "/app/data")
        assert cfg.get("optional_data_source") is None

