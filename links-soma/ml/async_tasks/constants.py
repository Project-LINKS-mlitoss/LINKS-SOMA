# IF001
ERROR_00001 = {
    "code": "IF001_e012_err_export_encoding",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングで保存中にエラーが発生しました。"
}
ERROR_00002 = {
    "code": "IF001_e012_err_export_all_encoding",
    "message": "ファイル {param_st1} をいずれのエンコーディングでも保存できませんでした。"
}
ERROR_00003 = {
    "code": "IF001_e012_err_import_format",
    "message": "CSV形式（UTF-8 BOM付き）のファイルを入力してください。"
}
ERROR_00004 = {
    "code": "IF001_e012_err_file_loading",
    "message": "CSV形式（UTF-8 BOM付き）のファイルを入力してください。"
}
ERROR_00005 = {
    "code": "IF001_e012_err_cleaning",
    "message": "インプットデータが本システムのマニュアルに記載された要件に沿って作成されているかをご確認ください。入力したインプットデータの住所カラムに記載された住所が正しい表記となっているかご確認ください。"
}
ERROR_00006 = {
    "code": "IF001_e013_err_import_format",
    "message": "CSV形式（UTF-8 BOM付き）のファイルを入力してください。"
}
ERROR_00007 = {
    "code": "IF001_e013_err_file_loading",
    "message": "CSV形式（UTF-8 BOM付き）のファイルを入力してください。"
}
ERROR_00008 = {
    "code": "IF001_e013_err_encoding",
    "message": "CSV形式（UTF-8 BOM付き）のファイルを入力してください。"
}
ERROR_00009 = {
    "code": "IF001_e013_err_export_encoding",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングで保存中にエラーが発生しました"
}
ERROR_00010 = {
    "code": "IF001_e013_err_residential_water_creation",
    "message": "入力したインプットデータ（水道使用量、水道開閉栓状況）の水道番号カラムが正しく記載されているかご確認ください。入力したインプットデータ（水道使用量）のなかに、「推定したい日付」に設定した推定日の月よりも新しい月のデータが含まれている場合には、該当のデータを削除してください。"
}
ERROR_00011 = {
    "code": "IF001_e014_err_file_loading",
    "message": "ファイル {param_st1} の読み込み中にエラーが発生しました"
}
ERROR_00012 = {
    "code": "IF001_e014_err_export_encoding",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングで保存中にエラーが発生しました"
}
ERROR_00013 = {
    "code": "IF001_e014_err_text_matching",
    "message": "入力したインプットデータの住所カラムに記載された住所が正しい表記となっているかご確認ください。"
}
ERROR_00014 = {
    "code": "IF001_e016_err_file_loading",
    "message": "ファイル {param_st1} の読み込み中にエラーが発生しました"
}
ERROR_00015 = {
    "code": "IF001_e016_err_convert_wkt",
    "message": "建物ポリゴンデータで指定したジオメトリカラムが正しいWKT (Well-Known Text) 方式の文字列となっているかご確認ください。確認方法が不明な場合には、取得した建物ポリゴンデータを管理している部門に問い合わせを推奨します。"
}
ERROR_00016 = {
    "code": "IF001_e016_err_export_encoding_gpk",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングでGeoPackage形式で保存中にエラーが発生しました"
}
ERROR_00017 = {
    "code": "IF001_e016_err_export_encoding",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングでCSV形式で保存中にエラーが発生しました"
}
ERROR_00018 = {
    "code": "IF001_e016_err_geodataframe_format",
    "message": "サポートされていない出力形式です: {param_st1}"
}
ERROR_00019 = {
    "code": "IF001_e016_err_spatial_join",
    "message": "CSV形式で建物ポリゴンデータを入力している場合、ジオメトリカラムの指定や記載に誤りがないかなどをご確認ください。ジオコーディング済みデータのファイル形式や緯度経度のカラム指定に誤りがないか、緯度経度データに不備がないかご確認ください。"
}
ERROR_00020 = {
    "code": "IF001_e013_err_date_incorrect",
    "message": "入力した水道使用量データの期間に推定日が含まれているかご確認ください 。入力した水道使用量データの期間が推定日から遡って1年間が含まれているかご確認ください。"
}
ERROR_00021 = {
    "code": "IF001_e016_err_allow_ext",
    "message": "本システムでサポートしているファイル形式（shp形式(zip)、gpkg形式、csv形式（geometryカラム付））を入力してください。"
}
ERROR_00022 = {
    "code": "IF001_e013_err_meter_reading_date",
    "message": "入力したインプットデータ（水道開閉栓状況）の検針年月カラムが正しく指定されているか、日付が正しく記載されているかご確認ください。"
}
ERROR_00023 = {
    "code": "IF001_err_data",
    "message": "{param_st1}のデータが異常です。誤ったファイルを読み込んでいないかもう一度データを確認ください。"
}
ERROR_00024 = {
    "code": "IF001_e016_err_geometry",
    "message": "'geometry' 列または 'lat_geocoding_cleaned' と 'lon_geocoding_cleaned' 列が必要です。"
}
ERROR_00025 = {
    "code": "IF001_e016_err_encoding",
    "message": "適切なエンコーディングが見つかりませんでした: {param_st1}"
}
ERROR_00026 = {
    "code": "IF001_e014_err_import_format",
    "message": "CSVファイル以外は対応していません: {param_st1}"
}
ERROR_00027 = {
    "code": "IF001_e014_err_encoding",
    "message": "適切なエンコーディングが見つかりませんでした: {param_st1}"
}
ERROR_00028 = {
    "code": "IF001_e013_err_residential_juki_creation",
    "message": "入力したインプットデータ（住民基本台帳）の世帯番号カラムが正しく記載されているかご確認ください。"
}
ERROR_00029 = {
    "code": "IF001_e013_err_residential_toki_creation",
    "message": "入力したインプットデータ（建物情報）が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。"
}
ERROR_00030 = {
    "code": "IF001_e016_err_building_id",
    "message": "正常なbuildingIDカラムを付与して、再度お試しください。"
}
ERROR_00031 = {
    "code": "IF001_e016_err_merge_building_and_textmatchedresult",
    "message": "CSV形式で建物ポリゴンデータを入力している場合、ジオメトリカラムの指定や記載に誤りがないかなどをご確認ください。ジオコーディング済みデータのファイル形式や緯度経度のカラム指定に誤りがないか、緯度経度データに不備がないかご確認ください。"
}
ERROR_00032 = {
    "code": "IF001_e016_err_add_keycode",
    "message": "国勢調査データにはKEY_CODEカラムとS_NAMEカラム、geometryカラムが必要です。元データに不備がある場合には国勢調査データの管理部署（総務省）に問い合わせを推奨します。"
}
ERROR_00033 = {
    "code": "IF001_e016_err_data_format",
    "message": "本システムでサポートしているファイル形式（shp形式(zip)、gpkg形式、csv形式（geometryカラム付））を入力してください。"
}
ERROR_00034 = {
    "code": "IF001_e016_err_merge_geometry_failure",
    "message": "Shapefile形式で建物ポリゴンデータを入力している場合、座標系情報が正しくZIP内に保存されているかなどをご確認ください。CSV形式で建物ポリゴンデータを入力している場合、ジオメトリカラムの指定や記載に誤りがないかなどをご確認ください。"
}
ERROR_00035 = {
    "code": "IF001_e012_err_water_usage",
    "message": "入力したインプットデータ（水道使用量）が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。"
}
ERROR_00036 = {
    "code": "IF001_e012_err_create_data_processed",
    "message": "入力したインプットデータ（{param_st1}）が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。"
}
ERROR_00037 = {
    "code": "IF001_e013_err_suido_number",
    "message": "水道番号が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。"
}
ERROR_00038 = {
    "code": "IF001_e013_err_building_information",
    "message": "建物情報が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。"
}
ERROR_00039 = {
    "code": "IF001_e013_err_data_birth",
    "message": "住民基本台帳の生年月日情報が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。"
}
ERROR_00040 = {
    "code": "IF001_e013_err_data_move_date",
    "message": "住定異動年月日が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。"
}
ERROR_00041 = {
    "code": "IF001_e016_err_format_ext_building_polygon",
    "message": "誤って別のファイルを読み込んでいないか、ご確認ください。"
}
ERROR_00042 = {
    "code": "IF001_e016_err_csv_geometry",
    "message": "入力しているジオメトリカラムの指定や内容に誤りがないかなどをご確認ください。"
}
ERROR_00043 = {
    "code": "IF001_e016_err_data_building_polygon",
    "message": "誤って別のファイルを読み込んでいないか、ご確認ください。データに不備がある場合にはデータ提供元に問い合わせを推奨します。"
}
ERROR_00044 = {
    "code": "IF001_e016_err_data_gpkg",
    "message": "Geopackage形式の場合、座標系情報が正しくZIP内に保存されているかなどをご確認ください。他に複数レイヤが入っている場合にデータ提供元に問い合わせを推奨します。"
}

# IF002
ERROR_10001 = {
    "code": "IF002_e021_err_import_format",
    "message": "CSV形式（UTF-8 BOM付き）ファイルを入力してください。"
}
ERROR_10002 = {
    "code": "IF002_e021_err_import_encoding",
    "message": "文字エンコーディングがUTF-8BOM付きのCSV形式ファイルを登録してください。"
}
ERROR_10003 = {
    "code": "IF002_e021_err_import_path",
    "message": "CSV形式（UTF-8 BOM付き）ファイルを入力してください。"
}
ERROR_10004 = {
    "code": "IF002_e021_err_export_format",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングで保存中にエラーが発生しました"
}
ERROR_10005 = {
    "code": "IF002_e021_err_export_path",
    "message": "ファイル {param_st1} をいずれのエンコーディングでも保存できませんでした。"
}
ERROR_10006 = {
    "code": "IF002_e021_err_model_learning",
    "message": "説明変数に使用できないカラムが選択されています。操作マニュアルに記載の説明変数に用いることができるカラムを参照してください。"
}
ERROR_10007 = {
    "code": "IF002_e021_err_convert_str_to_list",
    "message": "説明変数に指定したカラム名が文字化けしているなど読み取れない状態になっている可能性があります。ご確認ください。説明変数に指定したカラムのうち、同じカラム名称のものが複数ある可能性があります。ご確認ください。"
}

# IF003
ERROR_20001 = {
    "code": "IF003_e022_err_import_format",
    "message": "CSV形式（UTF-8 BOM付き）ファイルを入力してください。"
}
ERROR_20002 = {
    "code": "IF003_e022_err_import_encoding",
    "message": "CSV形式（UTF-8 BOM付き）ファイルを入力してください。"
}
ERROR_20003 = {
    "code": "IF003_e022_err_import_path",
    "message": "CSV形式（UTF-8 BOM付き）ファイルを入力してください。"
}
ERROR_20004 = {
    "code": "IF003_e022_err_model_missing",
    "message": "学習に使用したデータと予測に使用するデータの列が一致しないため、エラーが発生しています。不足している特徴量: {param_st1}"
}
ERROR_20005 = {
    "code": "IF003_e022_err_export_encoding",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングで保存中にエラーが発生しました"
}
ERROR_20006 = {
    "code": "IF003_e022_err_export_path",
    "message": "ファイル {param_st1} をいずれのエンコーディングでも保存できませんでした。"
}
ERROR_20007 = {
    "code": "IF003_e022_err_insert_sql",
    "message": "セキュリティソフト等により、アプリケーションの実行ファイル内にあるデータベースシステム（SQLite）の実行がブロックされてる可能性があります。情報システム部門への問い合わせを推奨します。"
}
ERROR_20008 = {
    "code": "IF003_e022_err_perform_determination",
    "message": "AIモデルの際に用いた名寄せ処理済データと空き家推定の分析対象に選択した名寄せ処理済データのカラム構成が異なっている可能性があります。ご確認ください。"
}
ERROR_20009 = {
    "code": "IF003_e032_err_areadata_csv",
    "message": "地域集計用データ（CSV形式）にジオメトリカラム（WKTフォーマット）を加えてください。"
}
ERROR_20010 = {
    "code": "IF003_e032_err_areadata_format",
    "message": "本システムでサポートしているファイル形式（shp形式(zip)、gpkg形式、csv形式（geometryカラム付））を入力してください。"
}
ERROR_20011 = {
    "code": "IF003_e032_err_areadata_import",
    "message": "本システムでサポートしているファイル形式（shp形式(zip)、gpkg形式、csv形式（geometryカラム付））を入力してください。"
}
ERROR_20012 = {
    "code": "IF003_e032_err_aggregation",
    "message": "集計に用いている地域集計処理データの座標系が付与されているかご確認ください。元データに不備がある場合にはデータ提供元に問い合わせを推奨します。"
}
ERROR_20013 = {
    "code": "IF003_e032_err_insert_sql",
    "message": "セキュリティソフト等により、アプリケーションの実行ファイル内にあるデータベースシステム（SQLite）の実行がブロックされてる可能性があります。情報システム部門への問い合わせを推奨します。"
}
ERROR_20014 = {
    "code": "IF003_e032_err_allow_ext",
    "message": "本システムでサポートしているファイル形式（shp形式(zip)、gpkg形式、csv形式（geometryカラム付））を入力してください。"
}
ERROR_20015 = {
    "code": "IF003_err_aggregation_data",
    "message": "地域集計用データがzipに含まれていない可能性があります。shapefileの読み込みにはshp, shx, prj, dbfの４種類のファイルが必要となります。"
}
ERROR_20016 = {
    "code": "IF003_e032_err_areadata_import_gpkg",
    "message": "Geopackage形式の場合、座標系情報が正しくZIP内に保存されているかなどをご確認ください。他に複数レイヤが入っている場合にデータ提供元に問い合わせを推奨します。"
}
ERROR_20017 = {
    "code": "IF003_e032_err_areadata_import_shp",
    "message": "Shapefile形式の場合、座標系情報が正しくZIP内に保存されているかなどをご確認ください。Shapefileの読み込みにはshp, shx, prj, dbfの４種類のファイルが必要となります。"
}

# IF004
ERROR_30001 = {
    "code": "IF004_e033_err_import_path",
    "message": "ファイル の読み込み中にエラーが発生しました"
}
ERROR_30002 = {
    "code": "IF004_e033_err_export_path",
    "message": "ファイルを出力中にエラーが発生しました"
}
ERROR_30003 = {
    "code": "IF004_e033_err_conversion",
    "message": "正しいCRS（参照座標系）になっているかご確認ください。"
}
ERROR_30004 = {
    "code": "IF004_e033_err_allow_ext",
    "message": "CSV形式、GeoPackage形式、GeoJSON形式のファイルを指定してください。"
}

TRANSLATE_COLUMNS_BUILDING = {
    "id":"建物データ番号",
    "data_set_result_id":"建物データ出力番号",
    "household_code":"世帯コード",
    "normalized_address":"正規化住所",
    "reference_date":"推定日",
    "household_size":"世帯人数",
    "members_under_15":"15歳未満人数",
    "percentage_under_15":"15歳未満構成比",
    "members_15_to_64":"15歳以上64歳以下人数",
    "percentage_15_to_64":"15歳以上64歳以下構成比",
    "members_over_65":"65歳以上人数",
    "percentage_over_65":"65歳以上構成比",
    "max_age":"最大年齢",
    "min_age":"最小年齢",
    "gender_ratio":"男女比",
    "residence_duration":"住定期間",
    "water_supply_number":"水道番号",
    "water_disconnection_flag":"閉栓フラグ",
    "max_water_usage":"最大使用水量",
    "avg_water_usage":"平均使用水量",
    "total_water_usage":"合計使用水量",
    "min_water_usage":"最小使用水量",
    "change_ratio_water_usage":"水道使用量変化率",
    "water_supply_source_info":"水道名寄せ元情報",
    "structure_name":"構造名称",
    "registration_date":"登記日付",
    "registration_source_info":"登記名寄せ元情報",
    "vacant_house_address":"空き家調査住所",
    "vacant_house_source_info":"空き家調査名寄せ元情報",
    "geocoded_address":"ジオコーディング住所",
    "geocoded_longitude":"ジオコーディング緯度",
    "geocoded_latitude":"ジオコーディング経度",
    "geocoding_source_info":"ジオコーディング名寄せ元情報",
    "has_water_supply":"水道データ有無フラグ",
    "has_juki_registry":"住民データ有無フラグ",
    "has_touki_registry":"建物情報データ有無フラグ",
    "has_juki_and_water":"住民基本台帳・水道データ結合フラグ",
    "has_vacant_result":"空き家調査情報有無",
    "has_juki_water_property":"住民基本台帳・建物情報データ結合フラグ",
    "has_geocoding":"ジオコーディング情報有無",
    "has_juki_water_property_vacant":"住民基本台帳・空き家調査結合フラグ",
    "fid":"fid",
    "gml_id":"PLATEAU gml id",
    "class":"PLATEAUクラス ",
    "geometry":"建物ポリゴンジオメトリ情報",
    "measuredheight":"標高",
    "measuredheight_uom":"標高単位",
    "src_scale":"地図情報レベル",
    "geometry_src_desc":"ジオメトリ原典資料",
    "thematic_src_desc":"主題属性原典資料",
    "lod1_height_type":"LOD1標高種類",
    "building_id":"建物ID",
    "prefecture":"⼟地が所在する都道府県の都道府県コ−ド",
    "city":"⼟地が所在する市区町村の市区町村コ−ド",
    "description":"概要",
    "rank":"洪水浸水想定区域　浸水ランク",
    "depth":"洪水浸水想定区域　浸水深",
    "depth_uom":"洪水浸水想定区域　浸水深の単位",
    "admin_type":"洪水浸水想定区域　指定機関",
    "scale":"洪水浸水想定区域　浸水規模",
    "duration":"洪水浸水想定区域　継続時間",
    "duration_uom":"洪水浸水想定区域　継続時間の単位",
    "building_use":"建築用途コード",
    "floors_above_ground":"地上階数",
    "floors_below_ground":"地下階数",
    "value":"拡張属性",
    "value_uom":"拡張属性の単位",
    "inland_flooding_risk_desc":"内水浸水リスク説明",
    "inland_flooding_risk_rank":"内水浸水リスクランク",
    "inland_flooding_risk_depth":"内水浸水リスク深さ",
    "inland_flooding_risk_depth_uom":"内水浸水リスク深さの単位",
    "river_flooding_risk_desc":"指定河川名称",
    "river_flooding_risk_rank":"浸水ランク",
    "river_flooding_risk_depth":"浸水深",
    "river_flooding_risk_depth_uom":"浸水深の単位",
    "landslide_risk_desc":"土砂災害リスク　現象区分",
    "large_store_name":"大規模小売店舗コード",
    "appearance_src_desc":"LODアピアランス原典資料",
    "residence_id":"住居ID",
    "is_test":"テスト用フラグ",
    "area_type":"土砂災害リスク区域区分",
    "predicted_label":"空き家推定結果",
    "predicted_probability":"空き家推定確率",
    "created_at":"空き家推定データ作成日",
    "area_group":"地域名称"
}

TRANSLATE_COLUMNS_AREA = {
    "id":"地域データ番号",
    "data_set_result_id":"地域データ出力番号",
    "reference_date":"推定日",
    "young_population_ratio":"若年層率（15歳以下人口）",
    "elderly_population_ratio":"高齢者率（65歳以上人口）",
    "total_building_count":"住宅数",
    "area":"地域面積",
    "geometry":"地域ポリゴンジオメトリ",
    "key_code":"地域コード",
    "created_at":"作成日",
    "updated_at":"更新日",
    "vacant_house_count":"推定空き家数",
    "predicted_probability":"推定空き家割合",
    "area_group":"地域名称"
}