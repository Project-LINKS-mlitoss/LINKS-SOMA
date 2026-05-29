# IF001
ERROR_00001 = {
    "code": "IF001_e012_err_export_encoding",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングで保存中にエラーが発生しました。 [E-0001]"
}
ERROR_00002 = {
    "code": "IF001_e012_err_export_all_encoding",
    "message": "ファイル {param_st1} をいずれのエンコーディングでも保存できませんでした。 [E-0002]"
}
ERROR_00003 = {
    "code": "IF001_e012_err_import_format",
    "message": "対応していないファイル形式です。CSV形式（UTF-8 BOM付き）のファイルを入力してください。 [E-0003]"
}
ERROR_00004 = {
    "code": "IF001_e012_err_file_loading",
    "message": "ファイルの読み込みに失敗しました。ファイルが破損していないか確認し、CSV形式（UTF-8 BOM付き）で保存し直してください。 [E-0004]"
}
ERROR_00005 = {
    "code": "IF001_e012_err_cleaning",
    "message": "インプットデータが本システムのマニュアルに記載された要件に沿って作成されているかをご確認ください。入力したインプットデータの住所カラムに記載された住所が正しい表記となっているかご確認ください。 [E-0005]"
}
ERROR_00006 = {
    "code": "IF001_e013_err_import_format",
    "message": "対応していないファイル形式です。CSV形式（UTF-8 BOM付き）のファイルを入力してください。 [E-0006]"
}
ERROR_00007 = {
    "code": "IF001_e013_err_file_loading",
    "message": "ファイルの読み込みに失敗しました。ファイルが破損していないか確認し、CSV形式（UTF-8 BOM付き）で保存し直してください。 [E-0007]"
}
ERROR_00008 = {
    "code": "IF001_e013_err_encoding",
    "message": "ファイルの文字コードを判別できませんでした。CSV形式（UTF-8 BOM付き）で保存し直してください。 [E-0008]"
}
ERROR_00009 = {
    "code": "IF001_e013_err_export_encoding",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングで保存中にエラーが発生しました。 [E-0009]"
}
ERROR_00010 = {
    "code": "IF001_e013_err_residential_water_creation",
    "message": "入力したインプットデータ（水道使用量、水道開閉栓状況）の水道番号カラムが正しく記載されているかご確認ください。入力したインプットデータ（水道使用量）のなかに、「推定したい日付」に設定した推定日の月よりも新しい月のデータが含まれている場合には、該当のデータを削除してください。 [E-0010]"
}
ERROR_00011 = {
    "code": "IF001_e014_err_file_loading",
    "message": "ファイル {param_st1} の読み込み中にエラーが発生しました。 [E-0011]"
}
ERROR_00012 = {
    "code": "IF001_e014_err_export_encoding",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングで保存中にエラーが発生しました。 [E-0012]"
}
ERROR_00013 = {
    "code": "IF001_e014_err_text_matching",
    "message": "住所の照合に失敗しました。住所カラムに記載された住所が正しい表記となっているか確認してください。 [E-0013]"
}
ERROR_00014 = {
    "code": "IF001_e016_err_file_loading",
    "message": "ファイル {param_st1} の読み込み中にエラーが発生しました。 [E-0014]"
}
ERROR_00015 = {
    "code": "IF001_e016_err_convert_wkt",
    "message": "建物ポリゴンデータで指定したジオメトリカラムが正しいWKT (Well-Known Text) 方式の文字列となっているかご確認ください。確認方法が不明な場合には、取得した建物ポリゴンデータを管理している部門に問い合わせを推奨します。 [E-0015]"
}
ERROR_00016 = {
    "code": "IF001_e016_err_export_encoding_gpk",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングでGeoPackage形式で保存中にエラーが発生しました。 [E-0016]"
}
ERROR_00017 = {
    "code": "IF001_e016_err_export_encoding",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングでCSV形式で保存中にエラーが発生しました。 [E-0017]"
}
ERROR_00018 = {
    "code": "IF001_e016_err_geodataframe_format",
    "message": "サポートされていない出力形式です: {param_st1} [E-0018]"
}
ERROR_00019 = {
    "code": "IF001_e016_err_spatial_join",
    "message": "建物ポリゴンデータとジオコーディングデータの結合に失敗しました。ジオメトリカラムの指定や緯度経度データに不備がないか確認してください。 [E-0019]"
}
ERROR_00020 = {
    "code": "IF001_e013_err_date_incorrect",
    "message": "入力した水道使用量データの期間に推定日が含まれているかご確認ください。入力した水道使用量データの期間が推定日から遡って1年間が含まれているかご確認ください。 [E-0020]"
}
ERROR_00021 = {
    "code": "IF001_e016_err_allow_ext",
    "message": "対応していないファイル形式です。shp形式（zip）、gpkg形式、csv形式（ジオメトリカラム付）のいずれかを入力してください。 [E-0021]"
}
ERROR_00022 = {
    "code": "IF001_e013_err_meter_reading_date",
    "message": "入力したインプットデータ（水道開閉栓状況）の検針年月カラムが正しく指定されているか、日付が正しく記載されているかご確認ください。 [E-0022]"
}
ERROR_00023 = {
    "code": "IF001_err_data",
    "message": "{param_st1}のデータが異常です。誤ったファイルを読み込んでいないかもう一度データを確認ください。 [E-0023]"
}
ERROR_00024 = {
    "code": "IF001_e016_err_geometry",
    "message": "'geometry' 列または 'lat' と 'lon' 列が必要です。 [E-0024]"
}
ERROR_00025 = {
    "code": "IF001_e016_err_encoding",
    "message": "適切なエンコーディングが見つかりませんでした: {param_st1} [E-0025]"
}
ERROR_00026 = {
    "code": "IF001_e014_err_import_format",
    "message": "CSVファイル以外は対応していません: {param_st1} [E-0026]"
}
ERROR_00027 = {
    "code": "IF001_e014_err_encoding",
    "message": "適切なエンコーディングが見つかりませんでした: {param_st1} [E-0027]"
}
ERROR_00028 = {
    "code": "IF001_e013_err_residential_juki_creation",
    "message": "入力したインプットデータ（住民基本台帳）の世帯番号カラムが正しく記載されているかご確認ください。 [E-0028]"
}
ERROR_00029 = {
    "code": "IF001_e013_err_residential_toki_creation",
    "message": "入力したインプットデータ（登記情報）が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。 [E-0029]"
}
ERROR_00030 = {
    "code": "IF001_e016_err_building_id",
    "message": "buildingIDカラムが見当たらず、エラーが生じています。入力したインプットデータ（建物ポリゴンデータ）の「データの種類」の指定を見直してください。 [E-0030]"
}
ERROR_00031 = {
    "code": "IF001_e016_err_merge_building_and_textmatchedresult",
    "message": "建物ポリゴンデータと住所照合結果の結合に失敗しました。ジオメトリカラムや座標系に誤りがないか確認してください。 [E-0031]"
}
ERROR_00032 = {
    "code": "IF001_e016_err_add_keycode",
    "message": "国勢調査データにはKEY_CODEカラムとS_NAMEカラム、geometryカラムが必要です。元データに不備がある場合には国勢調査データの管理部署（総務省）に問い合わせを推奨します。 [E-0032]"
}
ERROR_00033 = {
    "code": "IF001_e016_err_data_format",
    "message": "ZIPファイル内にShapefileが見つかりませんでした。ZIP内にshp、shx、prj、dbfファイルが含まれているか確認してください。 [E-0033]"
}
ERROR_00034 = {
    "code": "IF001_e016_err_merge_geometry_failure",
    "message": "Shapefile形式で建物ポリゴンデータを入力している場合、座標系情報が正しくZIP内に保存されているかなどをご確認ください。CSV形式で建物ポリゴンデータを入力している場合、ジオメトリカラムの指定や記載に誤りがないかなどをご確認ください。 [E-0034]"
}
ERROR_00035 = {
    "code": "IF001_e012_err_water_usage",
    "message": "入力したインプットデータ（水道使用量）が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。 [E-0035]"
}
ERROR_00036 = {
    "code": "IF001_e012_err_create_data_processed",
    "message": "入力したインプットデータ（{param_st1}）が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。 [E-0036]"
}
ERROR_00037 = {
    "code": "IF001_e013_err_suido_number",
    "message": "水道番号が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。 [E-0037]"
}
ERROR_00038 = {
    "code": "IF001_e013_err_building_information",
    "message": "水道データが本システムのマニュアルに記載された要件に沿って作成されているか、誤ったカラムが指定されていないかご確認ください。 [E-0038]"
}
ERROR_00039 = {
    "code": "IF001_e013_err_data_birth",
    "message": "住民基本台帳の生年月日情報が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。 [E-0039]"
}
ERROR_00040 = {
    "code": "IF001_e013_err_data_move_date",
    "message": "住定異動年月日が本システムのマニュアルに記載された要件に沿って作成されているかご確認ください。 [E-0040]"
}
ERROR_00041 = {
    "code": "IF001_e016_err_format_ext_building_polygon",
    "message": "建物ポリゴンデータのファイル形式が「データの種類」の指定と一致しません。正しいファイルを選択しているか確認してください。 [E-0041]"
}
ERROR_00042 = {
    "code": "IF001_e016_err_csv_geometry",
    "message": "ジオメトリカラムを読み取れませんでした。ジオメトリカラムの指定や内容に誤りがないか確認してください。 [E-0042]"
}
ERROR_00043 = {
    "code": "IF001_e016_err_data_building_polygon",
    "message": "誤って別のファイルを読み込んでいないか、ご確認ください。データに不備がある場合にはデータ提供元に問い合わせを推奨します。 [E-0043]"
}
ERROR_00044 = {
    "code": "IF001_e016_err_data_gpkg",
    "message": "Geopackage形式の場合、座標系情報が正しくZIP内に保存されているかなどをご確認ください。他に複数レイヤが入っている場合にデータ提供元に問い合わせを推奨します。 [E-0044]"
}

ERROR_00046 = {
    "code": "IF001_e016_err_load_data",
    "message": "{param_st1}のデータが異常です。もう一度データを確認ください。 [E-0046]"
}
ERROR_00047 = {
    "code": "IF001_e016_err_data_join_polygon",
    "message": "建物ポリゴンデータとジオコーディングデータの結合に失敗しました。ジオメトリカラムの指定や緯度経度データに不備がないか確認してください。 [E-0047]"
}
ERROR_00048 = {
    "code": "IF001_e016_err_file_extension",
    "message": "ファイルの拡張子が想定と一致しません。正しいファイルを選択しているか確認してください。 [E-0048]"
}
ERROR_00049 = {
    "code": "IF001_e016_err_centroid_empty",
    "message": "建物ポリゴンデータの重心を計算できませんでした。ジオメトリカラムの内容が正しいか確認してください。 [E-0049]"
}
ERROR_00050 = {
    "code": "IF001_e017_err_text_matching",
    "message": "住所の類似度判定に失敗しました。住所カラムに記載された住所が正しい表記となっているか確認してください。 [E-0050]"
}
ERROR_00051 = {
    "code": "IF001_err_no_input_files",
    "message": "処理に必要なファイルが選択されていません。名寄せ処理にはデータファイルを指定してください。 [E-0051]"
}

# IF003
ERROR_20001 = {
    "code": "IF003_e022_err_import_format",
    "message": "対応していないファイル形式です。CSV形式（UTF-8 BOM付き）のファイルを入力してください。 [E-20001]"
}
ERROR_20002 = {
    "code": "IF003_e022_err_import_encoding",
    "message": "ファイルの文字コードを判別できませんでした。CSV形式（UTF-8 BOM付き）で保存し直してください。 [E-20002]"
}
ERROR_20003 = {
    "code": "IF003_e022_err_import_path",
    "message": "入力ファイルが見つかりませんでした。ファイルが正しく配置されているか確認してください。 [E-20003]"
}
ERROR_20004 = {
    "code": "IF003_e022_err_model_missing",
    "message": "学習に使用したデータと予測に使用するデータの列が一致しないため、エラーが発生しています。不足している特徴量: {param_st1} [E-20004]"
}
ERROR_20005 = {
    "code": "IF003_e022_err_export_encoding",
    "message": "ファイル {param_st1} を {param_st2} エンコーディングで保存中にエラーが発生しました。 [E-20005]"
}
ERROR_20006 = {
    "code": "IF003_e022_err_export_path",
    "message": "ファイル {param_st1} をいずれのエンコーディングでも保存できませんでした。 [E-20006]"
}
ERROR_20007 = {
    "code": "IF003_e022_err_insert_sql",
    "message": "セキュリティソフト等により、アプリケーションの実行ファイル内にあるデータベースシステム（SQLite）の実行がブロックされてる可能性があります。情報システム部門への問い合わせを推奨します。 [E-20007]"
}
ERROR_20008 = {
    "code": "IF003_e022_err_perform_determination",
    "message": "AIモデルの際に用いた名寄せ処理済データと空き家推定の分析対象に選択した名寄せ処理済データのカラム構成が異なっている可能性があります。ご確認ください。 [E-20008]"
}
ERROR_20009 = {
    "code": "IF003_e032_err_areadata_csv",
    "message": "地域集計用データ（CSV形式）にジオメトリカラム（WKTフォーマット）を加えてください。 [E-20009]"
}
ERROR_20010 = {
    "code": "IF003_e032_err_areadata_format",
    "message": "対応していないファイル形式です。shp形式（zip）、gpkg形式、csv形式（ジオメトリカラム付）のいずれかを入力してください。 [E-20010]"
}
ERROR_20011 = {
    "code": "IF003_e032_err_areadata_import",
    "message": "地域集計用データの読み込みに失敗しました。ファイルの内容が空でないか、データ形式が正しいか確認してください。 [E-20011]"
}
ERROR_20012 = {
    "code": "IF003_e032_err_aggregation",
    "message": "集計に用いている地域集計処理データの座標系が付与されているかご確認ください。元データに不備がある場合にはデータ提供元に問い合わせを推奨します。 [E-20012]"
}
ERROR_20013 = {
    "code": "IF003_e032_err_insert_sql",
    "message": "セキュリティソフト等により、アプリケーションの実行ファイル内にあるデータベースシステム（SQLite）の実行がブロックされてる可能性があります。情報システム部門への問い合わせを推奨します。 [E-20013]"
}
ERROR_20014 = {
    "code": "IF003_e032_err_allow_ext",
    "message": "対応していないファイル形式です。shp形式（zip）、gpkg形式、csv形式（ジオメトリカラム付）のいずれかを入力してください。 [E-20014]"
}
ERROR_20015 = {
    "code": "IF003_err_aggregation_data",
    "message": "地域集計用データがzipに含まれていない可能性があります。shapefileの読み込みにはshp, shx, prj, dbfの４種類のファイルが必要となります。 [E-20015]"
}
ERROR_20016 = {
    "code": "IF003_e032_err_areadata_import_gpkg",
    "message": "Geopackage形式の場合、座標系情報が正しくZIP内に保存されているかなどをご確認ください。他に複数レイヤが入っている場合にデータ提供元に問い合わせを推奨します。 [E-20016]"
}
ERROR_20017 = {
    "code": "IF003_e032_err_areadata_import_shp",
    "message": "Shapefile形式の場合、座標系情報が正しくZIP内に保存されているかなどをご確認ください。Shapefileの読み込みにはshp, shx, prj, dbfの４種類のファイルが必要となります。 [E-20017]"
}
ERROR_20018 = {
    "code": "IF003_err_no_normalized_dataset",
    "message": "名寄せ処理済データが選択されていません。空き家推定にはデータセットを指定してください。 [E-20018]"
}

# IF004
ERROR_30001 = {
    "code": "IF004_e033_err_import_path",
    "message": "ファイルの読み込み中にエラーが発生しました。 [E-30001]"
}
ERROR_30002 = {
    "code": "IF004_e033_err_export_path",
    "message": "ファイルを出力中にエラーが発生しました。 [E-30002]"
}
ERROR_30003 = {
    "code": "IF004_e033_err_conversion",
    "message": "正しいCRS（参照座標系）になっているかご確認ください。 [E-30003]"
}
ERROR_30004 = {
    "code": "IF004_e033_err_allow_ext",
    "message": "CSV形式、GeoPackage形式、GeoJSON形式のファイルを指定してください。 [E-30004]"
}

# IF005
ERROR_50001 = {
    "code": "IF005_err_no_input_files",
    "message": "処理に必要なファイルが選択されていません。結合チェックにはデータファイルを指定してください。 [E-50001]"
}

TRANSLATE_COLUMNS_AREA = {
    "id":"地域データ番号",
    "data_set_result_id":"地域データ出力番号",
    "reference_date":"推定日",
    "young_population_ratio":"若年層率（15歳以下人口）",
    "elderly_population_ratio":"高齢者率（65歳以上人口）",
    "total_building_count":"家屋数",
    "area":"地域面積",
    "geometry":"地域ポリゴンジオメトリ",
    "key_code":"地域コード",
    "created_at":"作成日",
    "updated_at":"更新日",
    "vacant_house_count":"推定空き家数",
    "predicted_probability":"推定空き家割合",
    "area_group":"地域名称",
}

TRANSLATE_COLUMNS_IF001 = {
    "suido_status_address": "水道栓住所",
    "appearanceSrcDesc": "LODアピアランス原典資料",
    "areaClassificationType": "土地区分",
    "bldgDmAttribute": "図形表現情報",
    "bldgFacilityAttribute": "施設管理情報",
    "bldgFacilityIdAttribute": "施設識別情報",
    "bldgFacilityTypeAttribute": "施設分類情報",
    "bldgRealEstateIDAttribute": "建築物に紐づく不動産IDの情報",
    "bldgUsecaseAttribute": "建築物を使用するユースケースのための属性",
    "boundedBy": "外壁、屋根等の境界面情報",
    "buildingDataQualityAttribute": "データ品質情報",
    "buildingDetailAttribute": "基礎情報",
    "buildingDisasterRiskAttribute": "災害リスク情報",
    "buildingDisasterRiskAttribute|BuildingHighTideRiskAttribute|depth": "高潮浸水時の浸水の深さ",
    "buildingDisasterRiskAttribute|BuildingHighTideRiskAttribute|depth_uom": "高潮浸水時の浸水の深さの単位",
    "buildingDisasterRiskAttribute|BuildingHighTideRiskAttribute|description": "高潮浸水時の説明",
    "buildingDisasterRiskAttribute|BuildingHighTideRiskAttribute|rank": "高潮浸水時の浸水ランク",
    "buildingDisasterRiskAttribute|BuildingInlandFloodingRiskAttribute|depth": "内水浸水リスク深さ",
    "buildingDisasterRiskAttribute|BuildingInlandFloodingRiskAttribute|depth_uom": "内水浸水リスク深さの単位",
    "buildingDisasterRiskAttribute|BuildingInlandFloodingRiskAttribute|description": "内水浸水リスク説明",
    "buildingDisasterRiskAttribute|BuildingInlandFloodingRiskAttribute|rank": "内水浸水リスクランク",
    "buildingDisasterRiskAttribute|BuildingLandSlideRiskAttribute|areaType": "土砂災害警戒区域の有無",
    "buildingDisasterRiskAttribute|BuildingLandSlideRiskAttribute|description": "土砂災害警戒区域における災害種類",
    "buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|adminType": "洪水予報河川又は水位周知河川を指定した機関の種類",
    "buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|depth": "洪水浸水想定時の深さ",
    "buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|depth_uom": "洪水浸水想定時の深さの単位",
    "buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|description": "指定河川の名称",
    "buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|duration": "洪水浸水想定時の継続する時間",
    "buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|duration_uom": "洪水浸水想定時の継続する時間の単位",
    "buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|rank": "洪水浸水想定時の浸水深区分",
    "buildingDisasterRiskAttribute|BuildingRiverFloodingRiskAttribute|scale": "洪水浸水想定時の想定最大規模降雨あるいは計画規模降雨区分",
    "buildingDisasterRiskAttribute|BuildingTsunamiRiskAttribute|depth": "津波浸水想定時の深さ",
    "buildingDisasterRiskAttribute|BuildingTsunamiRiskAttribute|depth_uom": "津波浸水想定時の深さ単位",
    "buildingDisasterRiskAttribute|BuildingTsunamiRiskAttribute|description": "津波浸水想定属性情報",
    "buildingDisasterRiskAttribute|BuildingTsunamiRiskAttribute|rank": "津波浸水想定の水位区分",
    "buildingFootprintArea": "建築物の壁や柱の中心線で囲まれた部分の水平投影面積",
    "buildingFootprintArea_uom": "建築物の壁や柱の中心線で囲まれた部分の水平投影面積の単位",
    "buildingHeight": "建築物高さ",
    "buildingHeight_uom": "建築物高さの単位",
    "buildingIDAttribute": "建築物の識別情報",
    "buildingStructureType": "構造種別",
    "city": "土地が所在する市区町村の市区町村コ−ド",
    "class": "PLATEAUクラス",
    "consistsOfBuildingPart": "部品建築物",
    "creationDate": "データ作成日",
    "description": "都市オブジェクトの概要",
    "districtsAndZonesType": "地域地区",
    "fid": "fid",
    "function": "機能",
    "genericAttribute": "汎用属性",
    "geometrySrcDesc": "ジオメトリ原典資料",
    "id": "建物データ番号",
    "ifcBuildingAttribute": "IFC属性",
    "indoorBuildingAttribute": "屋内ナビゲーション属性",
    "interiorBuildingInstallation": "屋内付属物",
    "interiorRoom": "部屋",
    "keyValuePairAttribute": "拡張属性",
    "largeCustomerFacilityAttribute": "大規模小売店舗情報",
    "lod1HeightType": "LOD1標高種類",
    "lodType": "LOD種別",
    "measuredHeight": "標高",
    "measuredHeight_uom": "標高単位",
    "name": "名称",
    "orgUsage2": "建物利用現況（小分類）",
    "outerBuildingInstallation": "建物付属物",
    "parentType": "親タイプ",
    "prefecture": "土地が所在する都道府県の都道府県コ−ド",
    "roofType": "屋根形状の種類",
    "srcScale": "地図情報レベル",
    "storeyHeightsAboveGround": "地上階の階数",
    "storeyHeightsBelowGround": "地下階の階数",
    "storeysAboveGround": "地上の各階の高さ",
    "storeysBelowGround": "地下の各階の高さ",
    "surveyYear": "建物利用現況調査の実施年",
    "terminationDate": "データが削除された日",
    "thematicSrcDesc": "主題属性原典資料",
    "totalFloorArea": "当該建築物の各階の床⾯積の合計",
    "totalFloorArea_uom": "当該建築物の各階の床⾯積の単位",
    "usage": "建築用途コード",
    "yearOfConstruction": "建築された年",
    "yearOfDemolition": "解体された年",
    "geometry_plateau": "建物ポリゴンジオメトリ情報",
    "normalized_address": "正規化住所",
    "building_id": "建物ID",
    "latitude_geocoding_cleaned": "緯度",
    "longitude_geocoding_cleaned": "経度",
    "level_geocoding": "空間レベル",
    "confidency_geocoding": "空間精度",
    "KEY_CODE": "地域名称コード",
    "S_NAME": "地域名称",
    "residenceID": "residenceID",
    "address_building_type_determination": "推定対象選定用データ住所",
    "latitude_building_type_determination": "推定対象選定用データ緯度",
    "longitude_building_type_determination": "推定対象選定用データ経度",
    "usage_building_type_determination": "家屋種別",
    "household_code_juki_residence": "世帯番号",
    "household_size_juki_residence": "世帯人数",
    "under_15_count_juki_residence": "15歳未満人数",
    "over_65_count_juki_residence": "65歳以上人数",
    "max_age_juki_residence": "最大年齢",
    "residence_duration_juki_residence": "住定期間",
    "num_deaths_juki_residence": "死亡人数",
    "num_inmigrants_juki_residence": "転入数",
    "num_outmigrants_relocations_juki_residence": "転出・転居数",
    "reference_date_juki_residence": "reference_date",
    "water_supply_number": "水道番号",
    "water_disconnection_flag": "閉栓フラグ",
    "usage_start_date": "水道使用開始日",
    "usage_end_date": "水道使用中止日",
    "max_water_usage": "年間最大検針水量",
    "avg_water_usage": "平均検針水量",
    "total_water_usage": "年間合計検針水量",
    "years_since_closure": "閉栓後年数",
    "average_waterusage_person": "一人当たり検針水量",
    "change_rate_waterusage_over_last4months": "直近４ヶ月の使用量増減率",
    "structure_touki_residence": "登記構造",
    "registration_date_touki_residence": "登記日付",
    "days_since_registration_event": "登記事由発生からの経過日",
    "flag_concreteblock": "コンクリートブロック造",
    "flag_brick": "煉瓦造",
    "flag_reinforcedconcreteconstruction": "鉄筋コンクリート造",
    "flag_steelframe": "鉄骨造",
    "flag_wood": "木造",
    "flag_earthen": "土造",
    "flag_otherstructures": "その他構造",
    "flag_inheritance": "相続",
    "flag_gift": "贈与",
    "flag_sale": "売買",
    "flag_seizure": "差押",
    "date_registration_event": "登記事由発生日",
    "juki_residence_flag": "住民データ有無フラグ",
    "geocoding_cleaned_flag": "ジオコーディング有無フラグ",
    "suido_residence_flag": "水道データ有無フラグ",
    "touki_residence_flag": "登記情報データ有無フラグ",
    "buildingtype_determination_not_possible_flag": "家屋種別判定不可フラグ",
    "suido_usage_f1": "検針水量（推定月の11・12ヶ月前）",
    "suido_usage_f2": "検針水量（推定月の9・10ヶ月前）",
    "suido_usage_f3": "検針水量（推定月の7・8ヶ月前）",
    "suido_usage_f4": "検針水量（推定月の5・6ヶ月前）",
    "suido_usage_f5": "検針水量（推定月の3・4ヶ月前）",
    "suido_usage_f6": "検針水量（推定月の1・2ヶ月前）",
    "usage_first_half_avg": "前半平均使用水量",
    "usage_second_half_avg": "後半平均使用水量",
    "usage_half_year_change_rate": "半期変化率",
    "recent_usage_avg": "直近使用水量",
    "is_vacant": "is_vacant",
    "vacant_type": "vacant_type",
    "vacant_source": "vacant_source",
    "vacant_year": "vacant_year",
    "address_precision_flag": "address_precision_flag",
    "num_zero_periods": "ゼロ使用期数",
    "min_water_usage": "最小水道使用量",
    "has_usage_data": "使用量データあり",
    "usage_data_unavailable_flag": "使用量データなし",
    "max_age_juki_residence_isnull": "最大年齢欠損",
    "has_cancellation_event": "消除イベントあり",
    "num_outmigrant_events": "転出イベント数",
    "years_since_last_transfer": "最終異動後経過年数",
    "years_since_last_transfer_is_missing": "最終異動経過年数欠損",
    "sole_elderly_resident": "独居高齢者",
    "death_no_replacement": "死亡後入居者なし",
    "household_shrinkage_rate": "世帯縮小率",
    "composite_rule_score": "複合ルールスコア",
    "disconnected_and_no_resident": "閉栓かつ住基なし",
    "juki_elderly_proxy_flag": "職権記載高齢者フラグ",
    "std_water_usage": "使用量標準偏差",
    "usage_cv": "使用量変動係数",
    "usage_trend_slope": "使用量トレンド傾き",
    "usage_trend_slope_is_missing": "トレンド傾き欠損",
    "max_consecutive_zero_periods": "最大連続ゼロ期数",
    "zero_usage_no_resident": "ゼロ使用かつ住基なし",
    "death_closed_meter": "死亡かつ閉栓",
    "sole_elderly_closed_meter": "独居高齢者かつ閉栓",
    "death_no_replacement_closed": "死亡後無入居かつ閉栓",
    "has_death_event": "死亡イベントあり",
}

MAPPING_E022_TO_IF001 = {
    "水道栓住所": "address",
    "LODアピアランス原典資料": "appearance_src_desc",
    "土地区分": "area_classification_type",
    "図形表現情報": "bldg_dm_attribute",
    "施設管理情報": "bldg_facility_attribute",
    "施設識別情報": "bldg_facility_id_attribute",
    "施設分類情報": "bldg_facility_type_attribute",
    "建築物に紐づく不動産IDの情報": "bldg_real_estate_id_attribute",
    "建築物を使用するユースケースのための属性": "bldg_usecase_attribute",
    "外壁、屋根等の境界面情報": "bounded_by",
    "データ品質情報": "building_data_quality_attribute",
    "基礎情報": "building_detail_attribute",
    "災害リスク情報": "building_disaster_risk_attribute",
    "高潮浸水時の浸水の深さ": "hightide_risk_depth",
    "高潮浸水時の浸水の深さの単位": "hightide_risk_depth_uom",
    "高潮浸水時の説明": "hightide_risk_description",
    "高潮浸水時の浸水ランク": "hightide_risk_rank",
    "内水浸水リスク深さ": "inland_flooding_risk_depth",
    "内水浸水リスク深さの単位": "inland_flooding_risk_depth_uom",
    "内水浸水リスク説明": "inland_flooding_risk_desc",
    "内水浸水リスクランク": "inland_flooding_risk_rank",
    "土砂災害警戒区域の有無": "landslide_risk_areatype",
    "土砂災害警戒区域における災害種類": "landslide_risk_description",
    "洪水予報河川又は水位周知河川を指定した機関の種類": "river_flooding_risk_admin_type",
    "洪水浸水想定時の深さ": "river_flooding_risk_depth",
    "洪水浸水想定時の深さの単位": "river_flooding_risk_depth_uom",
    "指定河川の名称": "river_flooding_risk_description",
    "洪水浸水想定時の継続する時間": "river_flooding_risk_duration",
    "洪水浸水想定時の継続する時間の単位": "river_flooding_risk_duration_uom",
    "洪水浸水想定時の浸水深区分": "river_flooding_risk_rank",
    "洪水浸水想定時の想定最大規模降雨あるいは計画規模降雨区分": "river_flooding_risk_scale",
    "津波浸水想定時の深さ": "tsunami_risk_depth",
    "津波浸水想定時の深さ単位": "tsunami_risk_depth_uom",
    "津波浸水想定属性情報": "tsunami_risk_description",
    "津波浸水想定の水位区分": "tsunami_risk_rank",
    "建築物の壁や柱の中心線で囲まれた部分の水平投影面積": "building_footprint_area",
    "建築物の壁や柱の中心線で囲まれた部分の水平投影面積の単位": "building_footprint_area_uom",
    "建築物高さ": "building_height",
    "建築物高さの単位": "building_height_uom",
    "建築物の識別情報": "building_id_attribute",
    "構造種別": "building_structure_type",
    "土地が所在する市区町村の市区町村コ−ド": "bldg_city",
    "PLATEAUクラス": "bldg_class",
    "部品建築物": "consists_of_building_part",
    "データ作成日": "bldg_creation_date",
    "都市オブジェクトの概要": "bldg_description",
    "地域地区": "districts_and_zones_type",
    "fid": "fid",
    "機能": "function_plateau",
    "汎用属性": "generic_attribute",
    "ジオメトリ原典資料": "geometry_src_desc",
    "建物データ番号": "bldg_id",
    "IFC属性": "ifc_building_attribute",
    "屋内ナビゲーション属性": "indoor_building_attribute",
    "屋内付属物": "interior_building_installation",
    "部屋": "interior_room",
    "拡張属性": "key_value_pair_attribute",
    "大規模小売店舗情報": "large_customer_facility_attribute",
    "LOD1標高種類": "lod1_height_type",
    "LOD種別": "lod_type",
    "標高": "measured_height",
    "標高単位": "measured_height_uom",
    "名称": "name",
    "建物利用現況（小分類）": "org_usage2",
    "建物付属物": "outer_building_installation",
    "親タイプ": "parent_type",
    "土地が所在する都道府県の都道府県コ−ド": "prefecture",
    "屋根形状の種類": "roof_type",
    "地図情報レベル": "src_scale",
    "地上階の階数": "storey_heights_above_ground",
    "地下階の階数": "storey_heights_below_ground",
    "地上の各階の高さ": "storeys_above_ground",
    "地下の各階の高さ": "storeys_below_ground",
    "建物利用現況調査の実施年": "survey_year",
    "データが削除された日": "termination_date",
    "主題属性原典資料": "thematic_src_desc",
    "当該建築物の各階の床⾯積の合計": "total_floor_area",
    "当該建築物の各階の床⾯積の単位": "total_floor_area_uom",
    "建築用途コード": "building_use",
    "建築された年": "year_of_construction",
    "解体された年": "year_of_demolition",
    "建物ポリゴンジオメトリ情報": "bldg_geometry",
    "正規化住所": "normalized_address",
    "建物ID": "building_id",
    "経度": "lon_geocoding",
    "緯度": "lat_geocoding",
    "空間レベル": "level_geocoding",
    "空間精度": "confidency_geocoding",
    "地域名称コード": "key_code",
    "地域名称": "area_group",
    "residenceID": "residence_id",
    "推定対象選定用データ住所": "address_for_building_type",
    "推定対象選定用データ緯度": "latitude_for_building_type",
    "推定対象選定用データ経度": "longitude_for_building_type",
    "家屋種別": "building_type",
    "世帯番号": "household_code",
    "世帯人数": "household_size",
    "15歳未満人数": "members_under_15",
    "65歳以上人数": "members_over_65",
    "最大年齢": "max_age",
    "住定期間": "residence_duration",
    "死亡人数": "num_deaths",
    "転入数": "num_inmigrants",
    "転出・転居数": "num_outmigrants_relocations",
    "推定日": "reference_date",
    "水道番号": "water_supply_number",
    "閉栓フラグ": "water_disconnection_flag",
    "水道使用開始日": "water_startdate",
    "水道使用中止日": "water_enddate",
    "年間最大検針水量": "max_water_usage",
    "平均検針水量": "avg_water_usage",
    "年間合計検針水量": "total_water_usage",
    "閉栓後年数": "years_water_closure",
    "一人当たり検針水量": "average_waterusage_person",
    "直近４ヶ月の使用量増減率": "change_rate_waterusage_over_last4months",
    "登記構造": "structure_name",
    "登記事由発生からの経過日": "days_since_registration_event",
    "コンクリートブロック造": "flag_concreteblock",
    "煉瓦造": "flag_brick",
    "鉄筋コンクリート造": "flag_reinforcedconcreteconstruction",
    "鉄骨造": "flag_steelframe",
    "木造": "flag_wood",
    "土造": "flag_earthen",
    "その他構造": "flag_otherstructures",
    "相続": "flag_inheritance",
    "贈与": "flag_gift",
    "売買": "flag_sale",
    "差押": "flag_seizure",
    "登記日付": "registration_date",
    "登記事由発生日": "date_registration_event",
    "住民データ有無フラグ": "has_juki_registry",
    "ジオコーディング有無フラグ": "has_geocoding",
    "水道データ有無フラグ": "has_water_supply",
    "登記情報データ有無フラグ": "has_touki_registry",
    "家屋種別判定不可フラグ": "buildingtype_determination_not_possible_flag",
    "空き家推定結果": "predicted_label",
    "空き家推定確率": "predicted_probability",
    "空き家推定データ作成日": "created_at",
    "建物データ出力番号": "data_set_result_id",
    "検針水量（推定月の11・12ヶ月前）": "waterusage_11to12m_ago",
    "検針水量（推定月の9・10ヶ月前）": "waterusage_9to10m_ago",
    "検針水量（推定月の7・8ヶ月前）": "waterusage_7to8m_ago",
    "検針水量（推定月の5・6ヶ月前）": "waterusage_5to6m_ago",
    "検針水量（推定月の3・4ヶ月前）": "waterusage_3to4m_ago",
    "検針水量（推定月の1・2ヶ月前）": "waterusage_1to2m_ago",
    "前半平均使用水量": "usage_first_half_avg",
    "後半平均使用水量": "usage_second_half_avg",
    "半期変化率": "usage_half_year_change_rate",
    "直近使用水量": "recent_usage_avg",
    "再入居フラグ": "usage_recovery_flag",
    "ゼロ使用期数": "num_zero_periods",
    "最小水道使用量": "min_water_usage",
    "使用量データあり": "has_usage_data",
    "使用量データなし": "usage_data_unavailable_flag",
    "最大年齢欠損": "max_age_juki_residence_isnull",
    "消除イベントあり": "has_cancellation_event",
    "転出イベント数": "num_outmigrant_events",
    "最終異動後経過年数": "years_since_last_transfer",
    "最終異動経過年数欠損": "years_since_last_transfer_is_missing",
    "独居高齢者": "sole_elderly_resident",
    "死亡後入居者なし": "death_no_replacement",
    "世帯縮小率": "household_shrinkage_rate",
    "複合ルールスコア": "composite_rule_score",
    "閉栓かつ住基なし": "disconnected_and_no_resident",
    "職権記載高齢者フラグ": "juki_elderly_proxy_flag",
    "使用量標準偏差": "std_water_usage",
    "使用量変動係数": "usage_cv",
    "使用量トレンド傾き": "usage_trend_slope",
    "トレンド傾き欠損": "usage_trend_slope_is_missing",
    "最大連続ゼロ期数": "max_consecutive_zero_periods",
    "ゼロ使用かつ住基なし": "zero_usage_no_resident",
    "死亡かつ閉栓": "death_closed_meter",
    "独居高齢者かつ閉栓": "sole_elderly_closed_meter",
    "死亡後無入居かつ閉栓": "death_no_replacement_closed",
    "死亡イベントあり": "has_death_event",
}

DEFAULT_RESULT_SUMMARIZATION = {
    "taskResultType": "preprocess_summary",
    "estimation_target_total_count": 0,
    "record_combinations": [
        {
            "has_water_supply": True,
            "has_juki_registry": True,
            "has_touki_registry": True,
            "percentage": 0,
            "count": 0,
        },
        {
            "has_water_supply": True,
            "has_juki_registry": True,
            "has_touki_registry": False,
            "percentage": 0,
            "count": 0,
        },
        {
            "has_water_supply": False,
            "has_juki_registry": True,
            "has_touki_registry": True,
            "percentage": 0,
            "count": 0,
        },
        {
            "has_water_supply": True,
            "has_juki_registry": False,
            "has_touki_registry": True,
            "percentage": 0,
            "count": 0,
        },
        {
            "has_water_supply": False,
            "has_juki_registry": False,
            "has_touki_registry": False,
            "percentage": 0,
            "count": 0,
        },
    ],
    "record_combinations_total": 0,
    "building_type_breakdown": {
        "user_specified": {
            "percentage": 0,
            "count": 0,
        },
        "unknown": {
            "percentage": 0,
            "count": 0
        },
    },
    "building_type_breakdown_total": 0,
    "building_polygon_breakdown": {
        "with_polygon": {
            "percentage": 0,
            "count": 0,
        },
        "without_polygon": {
            "percentage": 0,
            "count": 0,
        },
    },
    "building_polygon_breakdown_total": 0,
}

COLUMNS_TO_LEARN = [
    "年間最大検針水量",
    "平均検針水量",
    "一人当たり検針水量",
    "直近４ヶ月の使用量増減率",
    "閉栓後年数",
    "検針水量（推定月の11・12ヶ月前）",
    "検針水量（推定月の9・10ヶ月前）",
    "検針水量（推定月の7・8ヶ月前）",
    "検針水量（推定月の5・6ヶ月前）",
    "検針水量（推定月の3・4ヶ月前）",
    "検針水量（推定月の1・2ヶ月前）",
    "前半平均使用水量",
    "後半平均使用水量",
    "半期変化率",
    "直近使用水量",
    "住定期間",
    "最大年齢",
    "世帯人数",
    "死亡人数",
    "転入数",
    "転出・転居数",
    "15歳未満人数",
    "65歳以上人数",
    "登記事由発生からの経過日",
    "コンクリートブロック造",
    "鉄筋コンクリート造",
    "鉄骨造",
    "木造",
    "土造",
    "煉瓦造",
    "その他構造",
    "相続",
    "贈与",
    "売買",
    "差押",
    "ゼロ使用期数",
    "最小水道使用量",
    "使用量データあり",
    "使用量データなし",
    "最大年齢欠損",
    "消除イベントあり",
    "転出イベント数",
    "最終異動後経過年数",
    "最終異動経過年数欠損",
    "独居高齢者",
    "死亡後入居者なし",
    "世帯縮小率",
    "複合ルールスコア",
    "閉栓かつ住基なし",
    "職権記載高齢者フラグ",
    "使用量トレンド傾き",
    "使用量標準偏差",
    "使用量変動係数",
    "最大連続ゼロ期数",
    "ゼロ使用かつ住基なし",
    "死亡かつ閉栓",
    "独居高齢者かつ閉栓",
    "死亡後無入居かつ閉栓",
]

COLUMNS_EXPORT_BUILDING_IF004 = {
   "area_classification_type": "土地区分",
   "bldg_real_estate_id_attribute": "建築物に紐づく不動産IDの情報",
   "hightide_risk_depth": "高潮浸水時の浸水の深さ",
   "inland_flooding_risk_depth": "内水浸水リスク深さ",
   "landslide_risk_areatype": "土砂災害警戒区域の有無",
   "river_flooding_risk_depth": "洪水浸水想定時の深さ",
   "river_flooding_risk_description": "指定河川の名称",
   "tsunami_risk_depth": "津波浸水想定時の深さ",
   "building_structure_type": "構造種別",
   "measured_height": "標高",
   "outer_building_installation": "建物付属物",
   "storey_heights_above_ground": "地上階の階数",
   "total_floor_area": "当該建築物の各階の床⾯積の合計",
   "year_of_construction": "建築された年",
   "year_of_demolition": "解体された年",
   "bldg_geometry": "建物ポリゴンジオメトリ情報",
   "normalized_address": "正規化住所",
   "building_id": "建物ID",
   "lon_geocoding": "経度",
   "lat_geocoding": "緯度",
   "key_code": "地域名称コード",
   "area_group": "地域名称",
   "residence_id": "residenceID",
   "building_type": "家屋種別",
   "household_code": "世帯番号",
   "household_size": "世帯人数",
   "members_under_15": "15歳未満人数",
   "members_over_65": "65歳以上人数",
   "max_age": "最大年齢",
   "residence_duration": "住定期間",
   "num_deaths": "死亡人数",
   "num_inmigrants": "転入数",
   "num_outmigrants_relocations": "転出・転居数",
   "reference_date": "推定日",
   "water_supply_number": "水道番号",
   "water_disconnection_flag": "閉栓フラグ",
   "water_startdate": "水道使用開始日",
   "water_enddate": "水道使用中止日",
   "max_water_usage": "年間最大検針水量",
   "avg_water_usage": "平均検針水量",
   "total_water_usage": "年間合計検針水量",
   "years_water_closure": "閉栓後年数",
   "average_waterusage_person": "一人当たり検針水量",
   "change_rate_waterusage_over_last4months": "直近４ヶ月の使用量増減率",
   "structure_name": "登記構造",
   "days_since_registration_event": "登記事由発生からの経過日",
   "flag_concreteblock": "コンクリートブロック造",
   "flag_brick": "煉瓦造",
   "flag_reinforcedconcreteconstruction": "鉄筋コンクリート造",
   "flag_steelframe": "鉄骨造",
   "flag_wood": "木造",
   "flag_earthen": "土造",
   "flag_otherstructures": "その他構造",
   "flag_inheritance": "相続",
   "flag_gift": "贈与",
   "flag_sale": "売買",
   "flag_seizure": "差押",
   "registration_date": "登記日付",
   "date_registration_event": "登記事由発生日",
   "has_juki_registry": "住民データ有無フラグ",
   "has_water_supply": "水道データ有無フラグ",
   "has_touki_registry": "登記情報データ有無フラグ",
   "buildingtype_determination_not_possible_flag": "家屋種別判定不可フラグ",
   "predicted_label": "空き家推定結果",
   "predicted_probability": "空き家推定確率",
   "created_at": "空き家推定データ作成日",
   "waterusage_11to12m_ago": "検針水量（推定月の11・12ヶ月前）",
   "waterusage_9to10m_ago": "検針水量（推定月の9・10ヶ月前）",
   "waterusage_7to8m_ago": "検針水量（推定月の7・8ヶ月前）",
   "waterusage_5to6m_ago": "検針水量（推定月の5・6ヶ月前）",
   "waterusage_3to4m_ago": "検針水量（推定月の3・4ヶ月前）",
   "waterusage_1to2m_ago": "検針水量（推定月の1・2ヶ月前）",
   "usage_first_half_avg": "前半平均使用水量",
   "usage_second_half_avg": "後半平均使用水量",
   "usage_half_year_change_rate": "半期変化率",
   "recent_usage_avg": "直近使用水量",
   "usage_recovery_flag": "再入居フラグ",
   "num_zero_periods": "ゼロ使用期数",
   "min_water_usage": "最小水道使用量",
   "has_usage_data": "使用量データあり",
   "usage_data_unavailable_flag": "使用量データなし",
   "max_age_juki_residence_isnull": "最大年齢欠損",
   "has_cancellation_event": "消除イベントあり",
   "num_outmigrant_events": "転出イベント数",
   "years_since_last_transfer": "最終異動後経過年数",
   "years_since_last_transfer_is_missing": "最終異動経過年数欠損",
   "sole_elderly_resident": "独居高齢者",
   "death_no_replacement": "死亡後入居者なし",
   "household_shrinkage_rate": "世帯縮小率",
   "composite_rule_score": "複合ルールスコア",
   "disconnected_and_no_resident": "閉栓かつ住基なし",
   "juki_elderly_proxy_flag": "職権記載高齢者フラグ",
   "std_water_usage": "使用量標準偏差",
   "usage_cv": "使用量変動係数",
   "usage_trend_slope": "使用量トレンド傾き",
   "usage_trend_slope_is_missing": "トレンド傾き欠損",
   "max_consecutive_zero_periods": "最大連続ゼロ期数",
   "zero_usage_no_resident": "ゼロ使用かつ住基なし",
   "death_closed_meter": "死亡かつ閉栓",
   "sole_elderly_closed_meter": "独居高齢者かつ閉栓",
   "death_no_replacement_closed": "死亡後無入居かつ閉栓",
   "has_death_event": "死亡イベントあり",
}
