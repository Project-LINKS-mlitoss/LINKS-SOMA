import {
  integer,
  real,
  sqliteTable,
  text,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { type JobParameters } from "../shared/types/job-parameters";
import { type JobTaskResult } from "../shared/types/job-task-result";
import { type OptionalDataSourceEntry } from "../shared/types/optional-data-source";
import { type Parameter } from "../features/bi/types";
import { VIEW_STYLES } from "../shared/config/view-styles";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey(),
  name: text("name"),
});

export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const workbooks = sqliteTable("workbooks", {
  id: integer("id").primaryKey(),
  title: text("title"),
  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectWorkbook = typeof workbooks.$inferSelect;
export type InsertWorkbook = typeof workbooks.$inferInsert;

export const result_sheets = sqliteTable("result_sheets", {
  id: integer("id").primaryKey(),
  workbook_id: integer("workbook_id"),
  title: text("title"),
  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectResultSheet = typeof result_sheets.$inferSelect;
export type InsertResultSheet = typeof result_sheets.$inferInsert;

export const result_views = sqliteTable("result_views", {
  id: integer("id").primaryKey(),
  sheet_id: integer("sheet_id"),
  data_set_result_id: integer("data_set_result_id"),

  title: text("title"),
  unit: text("unit", { enum: ["building", "area"] }),
  style: text("style", { enum: VIEW_STYLES }),

  layoutIndex:
    integer(
      "layoutIndex",
    ) /** レイアウトの順序を制御するための配列インデックスを保持(1~4) */,

  /**
   * チャートの動的カラム対応のためのフィールドをkey-valueのオブジェクト配列で保持するためのカラム
   * SQLiteにはBlobかText型しかなく、DrizzleのレイヤーでObectとして扱わせるために mode;json を指定
   *
   * {
   *  key: string // inputのname属性に対応
   *  value: string // inputのvalue属性に対応
   * }
   */
  parameters: text("parameters", {
    mode: "json",
  })
    .$type<Parameter[]>()
    .notNull(),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectResultView = typeof result_views.$inferSelect;
export type InsertResultView = typeof result_views.$inferInsert;

export const data_set_results = sqliteTable("data_set_results", {
  id: integer("id").primaryKey(),
  title: text("title"),
  job_id: integer("job_id").references(() => jobs.id),
  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectDataSetResult = typeof data_set_results.$inferSelect;
export type InsertDataSetResult = typeof data_set_results.$inferInsert;

export const data_set_detail_buildings = sqliteTable(
  "data_set_detail_buildings",
  {
    id: integer("id").primaryKey(),
    data_set_result_id: integer("data_set_result_id"),

    /**
     * 世帯番号
     *
     * 文字列：任意の文字列
     */
    household_code: text("household_code"),

    /**
     * 正規化住所
     *
     * 文字列：任意の文字列
     */
    normalized_address: text("normalized_address"),

    /**
     * 建物所属地域区分
     *
     * 文字列：町丁目レベルやの地域区分
     */
    area_group: text("area_group"),

    /**
     * 推定日
     *
     * 推定の基準となる日付
     *
     * YYYY-MM-DD形式の文字列
     */
    reference_date: text("reference_date").notNull(),

    /**
     * 世帯人数（settled − departed: 住定人数 − 転出/死亡人数）
     *
     * 0以上の整数
     */
    household_size: integer("household_size"),

    /**
     *  住定期間
     *
     *  整数：住定期間（年）
     */
    residence_duration: integer("residence_duration"),
    /**
     * 水道番号
     *
     * 文字列：任意の文字列
     */
    water_supply_number: text("water_supply_number"),
    /**
     * 閉栓フラグ
     *
     * 1: 閉栓 / 0: 開栓
     */
    water_disconnection_flag: integer("water_disconnection_flag"), // SQLiteにはbool型がないため、0,1で表現する
    /**
     * 最大水道使用量
     *
     * 単位：m^3
     * 小数で表現（8byte 浮動小数点）
     */
    max_water_usage: real("max_water_usage"),
    /**
     * 平均水道使用量
     *
     * 単位：m^3
     * 小数で表現（8byte 浮動小数点）
     */
    avg_water_usage: real("avg_water_usage"),
    /**
     * 合計水道使用量
     *
     * 単位：m^3
     * 小数で表現（8byte 浮動小数点）
     */
    total_water_usage: real("total_water_usage"),

    /**
     * 登記上の構造名称
     *
     * 文字列：任意の文字列
     */
    structure_name: text("structure_name"),
    /**
     * 住所_空き家結果_データクレンジング済
     *
     * 文字列：任意の文字列
     */
    has_water_supply: integer("has_water_supply"),
    has_juki_registry: integer("has_juki_registry"),
    has_touki_registry: integer("has_touki_registry"),

    fid: text("fid"),
    /**
     * GML ID
     */
    bldg_class: text("bldg_class"), // PLATEAUクラス

    /**
     * ジオメトリデータ
     *
     * 文字列：任意の文字列
     */
    bldg_geometry: text("bldg_geometry"), // 建物ポリゴンジオメトリ情報（ジオメトリなしの場合はnull）

    /**
     * 計測高
     *
     * 単位：m
     * 小数で表現
     */
    measured_height: real("measured_height"),

    measured_height_uom: text("measured_height_uom"), // 標高単位
    src_scale: text("src_scale"),
    geometry_src_desc: text("geometry_src_desc"),
    thematic_src_desc: text("thematic_src_desc"),
    lod1_height_type: text("lod1_height_type"),
    building_id: text("building_id"),
    prefecture: text("prefecture"),
    bldg_city: text("bldg_city"), // 土地が所在する市区町村の市区町村コ−ド
    bldg_description: text("bldg_description"), // 都市オブジェクトの概要

    /**
     * 洪水浸水リスク属性_建物
     *
     * 文字列：任意の文字列
     */
    inland_flooding_risk_desc: text("inland_flooding_risk_desc"),
    /**
     * 洪水浸水リスク属性_ランク
     *
     * 整数
     */
    inland_flooding_risk_rank: integer("inland_flooding_risk_rank"),
    /**
     * 洪水浸水リスク属性_浸水深
     *
     * 単位：m
     * 小数で表現
     */
    inland_flooding_risk_depth: real("inland_flooding_risk_depth"),
    inland_flooding_risk_depth_uom: text("inland_flooding_risk_depth_uom"),
    /**
     * 洪水氾濫リスク属性_建物
     *
     * 文字列：任意の文字列
     */
    river_flooding_risk_description: text("river_flooding_risk_description"),
    /**
     * 洪水氾濫リスク属性_ランク
     *
     * 整数
     */
    river_flooding_risk_rank: integer("river_flooding_risk_rank"),
    /**
     * 洪水氾濫リスク属性_氾濫深長
     *
     * 単位：m
     * 小数で表現
     */
    river_flooding_risk_depth: real("river_flooding_risk_depth"),
    river_flooding_risk_depth_uom: text("river_flooding_risk_depth_uom"),
    /**
     * 地滑りリスク属性_建物
     *
     * 文字列：任意の文字列
     */
    landslide_risk_description: text("landslide_risk_description"),

    appearance_src_desc: text("appearance_src_desc"),
    residence_id: text("residence_id"),

    /**
     * 建物名
     *
     * 文字列：任意の文字列
     */
    name: text("name"),

    /**
     * 空き家推定結果
     *
     * 1: 空き家 / 0: 居住
     */
    predicted_label: integer("predicted_label"),
    /**
     * 空き家推定確率
     *
     * 0~1の小数で表現（8byte 浮動小数点）
     */
    predicted_probability: real("predicted_probability"),

    /** 閾値別空き家推定結果（5%刻み、19パターン） */
    predicted_label_05: integer("predicted_label_05"),
    predicted_label_10: integer("predicted_label_10"),
    predicted_label_15: integer("predicted_label_15"),
    predicted_label_20: integer("predicted_label_20"),
    predicted_label_25: integer("predicted_label_25"),
    predicted_label_30: integer("predicted_label_30"),
    predicted_label_35: integer("predicted_label_35"),
    predicted_label_40: integer("predicted_label_40"),
    predicted_label_45: integer("predicted_label_45"),
    predicted_label_50: integer("predicted_label_50"),
    predicted_label_55: integer("predicted_label_55"),
    predicted_label_60: integer("predicted_label_60"),
    predicted_label_65: integer("predicted_label_65"),
    predicted_label_70: integer("predicted_label_70"),
    predicted_label_75: integer("predicted_label_75"),
    predicted_label_80: integer("predicted_label_80"),
    predicted_label_85: integer("predicted_label_85"),
    predicted_label_90: integer("predicted_label_90"),
    predicted_label_95: integer("predicted_label_95"),

    max_age: integer("max_age") /** 最大年齢 */,

    /** R7追加分 */
    buildingtype_determination_not_possible_flag: integer(
      "buildingtype_determination_not_possible_flag",
    ), // 1: 家屋種別の判定ができない / 0: 家屋種別の判定ができる
    days_since_registration_event: integer("days_since_registration_event"), // 1: 相続がある / 0: 相続がない

    /** R7新規追加分 */
    address: text("address"), // 建築物住所
    area_classification_type: text("area_classification_type"), // 土地区分
    bldg_dm_attribute: text("bldg_dm_attribute"), // 図形表現情報
    bldg_facility_attribute: text("bldg_facility_attribute"), // 施設管理情報
    bldg_facility_id_attribute: text("bldg_facility_id_attribute"), // 施設識別情報
    bldg_facility_type_attribute: text("bldg_facility_type_attribute"), // 施設分類情報
    bldg_real_estate_id_attribute: text("bldg_real_estate_id_attribute"), // 建築物に紐づく不動産IDの情報
    bldg_usecase_attribute: text("bldg_usecase_attribute"), // 建築物を使用するユースケースのための属性
    bounded_by: text("bounded_by"), // 外壁、屋根等の境界面情報
    building_data_quality_attribute: text("building_data_quality_attribute"), // データ品質情報
    building_detail_attribute: text("building_detail_attribute"), // 基礎情報
    building_disaster_risk_attribute: text("building_disaster_risk_attribute"), // 災害リスク情報
    hightide_risk_depth: real("hightide_risk_depth"), // 高潮浸水時の浸水の深さ
    hightide_risk_depth_uom: text("hightide_risk_depth_uom"), // 高潮浸水時の浸水の深さの単位
    hightide_risk_description: text("hightide_risk_description"), // 高潮浸水時の説明
    hightide_risk_rank: integer("hightide_risk_rank"), // 高潮浸水時の浸水ランク
    landslide_risk_areatype: text("landslide_risk_areatype"), // 土砂災害警戒区域の有無
    river_flooding_risk_admin_type: text("river_flooding_risk_admin_type"), // 洪水予報河川又は水位周知河川を指定した機関の種類
    tsunami_risk_depth: real("tsunami_risk_depth"), // 津波浸水想定時の深さ
    tsunami_risk_depth_uom: text("tsunami_risk_depth_uom"), // 津波浸水想定時の深さ単位
    tsunami_risk_description: text("tsunami_risk_description"), // 津波浸水想定属性情報
    tsunami_risk_rank: text("tsunami_risk_rank"), // 津波浸水想定の水位区分
    building_footprint_area: real("building_footprint_area"), // 建築物の壁や柱の中心線で囲まれた部分の水平投影面積
    building_footprint_area_uom: text("building_footprint_area_uom"), // 建築物の壁や柱の中心線で囲まれた部分の水平投影面積の単位
    building_height: real("building_height"), // 建築物高さ
    building_height_uom: text("building_height_uom"), // 建築物高さの単位
    building_id_attribute: text("building_id_attribute"), // 建築物の識別情報
    building_structure_type: text("building_structure_type"), // 構造種別
    consists_of_building_part: text("consists_of_building_part"), // 部品建築物
    bldg_creation_date: text("bldg_creation_date"), // データ作成日
    districts_and_zones_type: text("districts_and_zones_type"), // 地域地区
    function_plateau: text("function_plateau"), // 機能
    generic_attribute: text("generic_attribute"), // 汎用属性
    ifc_building_attribute: text("ifc_building_attribute"), // IFC属性
    indoor_building_attribute: text("indoor_building_attribute"), // 屋内ナビゲーション属性
    interior_building_installation: text("interior_building_installation"), // 屋内付属物
    interior_room: text("interior_room"), // 部屋
    key_value_pair_attribute: text("key_value_pair_attribute"), // 拡張属性
    large_customer_facility_attribute: text(
      "large_customer_facility_attribute",
    ), // 大規模小売店舗情報
    lod_type: text("lod_type"), // LOD種別
    org_usage2: text("org_usage2"), // 建物利用現況（小分類）
    outer_building_installation: text("outer_building_installation"), // 建物付属物
    parent_type: text("parent_type"), // 親タイプ
    roof_type: text("roof_type"), // 屋根形状の種類
    storey_heights_above_ground: real("storey_heights_above_ground"), // 地上の各階の高さ
    storey_heights_below_ground: real("storey_heights_below_ground"), // 地下の各階の高さ
    storeys_above_ground: integer("storeys_above_ground"), // 地上階の階数
    storeys_below_ground: integer("storeys_below_ground"), // 地下の各階の高さ
    survey_year: integer("survey_year"), // 建物利用現況調査の実施年
    termination_date: text("termination_date"), // データが削除された日
    total_floor_area: real("total_floor_area"), // 当該建築物の各階の床面積の合計
    total_floor_area_uom: text("total_floor_area_uom"), // 当該建築物の各階の床面積の単位
    year_of_construction: integer("year_of_construction"), // 建築された年
    year_of_demolition: integer("year_of_demolition"), // 解体された年
    key_code: text("key_code"), // 地域名称コード
    building_type: text("building_type"), // 家屋種別
    water_startdate: text("water_startdate"), // 水道使用開始日
    water_enddate: text("water_enddate"), // 水道使用中止日
    building_use: text("building_use"), // 建築用途コード
    river_flooding_risk_scale: text("river_flooding_risk_scale"), // 洪水浸水想定時の想定最大規模降雨あるいは計画規模降雨区分
    river_flooding_risk_duration: text("river_flooding_risk_duration"), // 洪水浸水想定時の継続する時間
    river_flooding_risk_duration_uom: text("river_flooding_risk_duration_uom"), // 洪水浸水想定時の継続する時間の単位
    lon_geocoding: real("lon_geocoding"), // 経度
    lat_geocoding: real("lat_geocoding"), // 緯度
    level_geocoding: text("level_geocoding"), // 空間レベル
    confidency_geocoding: text("confidency_geocoding"), // 空間精度
    address_for_building_type: text("address_for_building_type"), // 推定対象選定用データ住所
    latitude_for_building_type: real("latitude_for_building_type"), // 推定対象選定用データ緯度
    longitude_for_building_type: real("longitude_for_building_type"), // 推定対象選定用データ経度
    num_deaths: integer("num_deaths"), // 死亡人数
    num_inmigrants: integer("num_inmigrants"), // 転入数
    num_outmigrants_relocations: integer("num_outmigrants_relocations"), // 転出・転居数
    num_cancellations: integer("num_cancellations"), // 職権消除数
    years_water_closure: real("years_water_closure"), // 閉栓後年数
    average_waterusage_person: real("average_waterusage_person"), // 一人当たり平均使用量
    change_rate_waterusage_over_last4months: real(
      "change_rate_waterusage_over_last4months",
    ), // 直近４ヶ月の使用量増減率
    flag_zero_usage_over4consecutivemonths: integer(
      "flag_zero_usage_over4consecutivemonths",
    ), // 連続4か月使用量0フラグ
    flag_concreteblock: integer("flag_concreteblock"), // コンクリートブロック造
    flag_brick: integer("flag_brick"), // 煉瓦造
    flag_reinforcedconcreteconstruction: integer(
      "flag_reinforcedconcreteconstruction",
    ), // 鉄筋コンクリート造
    flag_steelframe: integer("flag_steelframe"), // 鉄骨造
    flag_wood: integer("flag_wood"), // 木造
    flag_earthen: integer("flag_earthen"), // 土造
    flag_otherstructures: integer("flag_otherstructures"), // その他構造
    flag_inheritance: integer("flag_inheritance"), // 相続
    flag_gift: integer("flag_gift"), // 贈与
    flag_sale: integer("flag_sale"), // 売買
    flag_seizure: integer("flag_seizure"), // 差押
    date_inheritance: text("date_inheritance"), // 相続日
    has_geocoding: integer("has_geocoding"), // ジオコーディング有無フラグ
    bldg_id: text("bldg_id"), // 建物データ番号
    members_under_15: integer("members_under_15"), // 15歳未満人数
    members_over_65: integer("members_over_65"), // 65歳以上人数
    registration_date: text("registration_date"), // 登記日付
    date_registration_event: text("date_registration_event"), // 登記事由発生日
    waterusage_11to12m_ago: real("waterusage_11to12m_ago"), // 検針水量（推定月の11・12ヶ月前）
    waterusage_9to10m_ago: real("waterusage_9to10m_ago"), // 検針水量（推定月の9・10ヶ月前）
    waterusage_7to8m_ago: real("waterusage_7to8m_ago"), // 検針水量（推定月の7・8ヶ月前）
    waterusage_5to6m_ago: real("waterusage_5to6m_ago"), // 検針水量（推定月の5・6ヶ月前）
    waterusage_3to4m_ago: real("waterusage_3to4m_ago"), // 検針水量（推定月の3・4ヶ月前）
    waterusage_1to2m_ago: real("waterusage_1to2m_ago"), // 検針水量（推定月の1・2ヶ月前）

    // 水道時系列特徴量（water.py:add_water_features）
    has_usage_data: integer("has_usage_data"), // 使用量データあり
    num_zero_periods: real("num_zero_periods"), // ゼロ使用期数
    min_water_usage: real("min_water_usage"), // 最小水道使用量
    usage_data_unavailable_flag: integer("usage_data_unavailable_flag"), // 使用量データなし
    usage_first_half_avg: real("usage_first_half_avg"), // 前半平均使用水量
    usage_second_half_avg: real("usage_second_half_avg"), // 後半平均使用水量
    usage_half_year_change_rate: real("usage_half_year_change_rate"), // 半期変化率
    recent_usage_avg: real("recent_usage_avg"), // 直近使用水量

    // 住基イベント特徴量（juki.py:add_juki_features）
    max_age_juki_residence_isnull: integer("max_age_juki_residence_isnull"), // 最大年齢欠損
    has_cancellation_event: integer("has_cancellation_event"), // 消除イベントあり
    num_outmigrant_events: real("num_outmigrant_events"), // 転出イベント数
    years_since_last_transfer: real("years_since_last_transfer"), // 最終異動後経過年数
    years_since_last_transfer_is_missing: integer(
      "years_since_last_transfer_is_missing",
    ), // 最終異動経過年数欠損
    sole_elderly_resident: integer("sole_elderly_resident"), // 独居高齢者
    death_no_replacement: integer("death_no_replacement"), // 死亡後入居者なし
    household_shrinkage_rate: real("household_shrinkage_rate"), // 世帯縮小率

    // 交差・ルール特徴量（interactions.py:add_interaction_features）
    composite_rule_score: real("composite_rule_score"), // 複合ルールスコア

    /** ユーザーが任意で取り込んだ追加説明変数データ（JSON配列） */
    optional_data_source: text("optional_data_source", {
      mode: "json",
    }).$type<OptionalDataSourceEntry[]>(),

    created_at: text("created_at")
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull(),
    updated_at: text("updated_at")
      .default(sql`(CURRENT_TIMESTAMP)`)
      .notNull()
      .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => ({
    filterIdx: index("idx_buildings_filter").on(
      table.data_set_result_id,
      table.reference_date,
      table.area_group,
    ),
    spatialIdx: index("idx_buildings_spatial").on(
      table.lat_geocoding,
      table.lon_geocoding,
    ),
  }),
);

export type SelectDataSetDetailBuilding =
  typeof data_set_detail_buildings.$inferSelect;
export type InsertDataSetDetailBuilding =
  typeof data_set_detail_buildings.$inferInsert;

export const isBuildingColumn = (
  column: keyof SelectDataSetDetailBuilding | keyof SelectDataSetDetailArea,
): column is keyof SelectDataSetDetailBuilding => {
  return column in data_set_detail_buildings;
};

export const data_set_detail_areas = sqliteTable("data_set_detail_areas", {
  id: integer("id").primaryKey(),
  data_set_result_id: integer("data_set_result_id"),

  /**
   * 推定日
   *
   * 推定の基準となる日付
   *
   * YYYY-MM-DD形式の文字列
   */
  reference_date: text("reference_date").notNull(),

  /**
   * 地域区分
   *
   * 文字列：町丁目レベルやの地域区分
   */
  area_group: text("area_group"),

  /**
   * 若年層率
   *
   * 0~1の小数で表現（8byte 浮動小数点）
   */
  young_population_ratio: real("young_population_ratio"),

  /**
   * 高齢者率
   *
   * 0~1の小数で表現（8byte 浮動小数点）
   */
  elderly_population_ratio: real("elderly_population_ratio"),

  /**
   * 建物数
   *
   * 0以上の整数
   */
  total_building_count: integer("total_building_count"),

  /**
   * 空き家件数
   *
   * 0以上の整数
   */
  vacant_house_count: integer("vacant_house_count"),

  /**
   * 面積
   *
   * 単位：m^2
   * 小数で表現（8byte 浮動小数点）
   */
  area: real("area"),

  /**
   * ジオメトリ
   *
   * 文字列：任意の文字列
   */
  geometry: text("geometry").notNull(),

  /**
   * KEYCODE
   *
   * 任意の文字列
   */
  key_code: text("key_code"),

  /**
   * 空き家推定確率
   *
   * 0~1の小数で表現（8byte 浮動小数点）
   */
  predicted_probability: real("predicted_probability"),

  /** 閾値別空き家件数（5%刻み、19パターン） */
  vacant_house_count_05: integer("vacant_house_count_05"),
  vacant_house_count_10: integer("vacant_house_count_10"),
  vacant_house_count_15: integer("vacant_house_count_15"),
  vacant_house_count_20: integer("vacant_house_count_20"),
  vacant_house_count_25: integer("vacant_house_count_25"),
  vacant_house_count_30: integer("vacant_house_count_30"),
  vacant_house_count_35: integer("vacant_house_count_35"),
  vacant_house_count_40: integer("vacant_house_count_40"),
  vacant_house_count_45: integer("vacant_house_count_45"),
  vacant_house_count_50: integer("vacant_house_count_50"),
  vacant_house_count_55: integer("vacant_house_count_55"),
  vacant_house_count_60: integer("vacant_house_count_60"),
  vacant_house_count_65: integer("vacant_house_count_65"),
  vacant_house_count_70: integer("vacant_house_count_70"),
  vacant_house_count_75: integer("vacant_house_count_75"),
  vacant_house_count_80: integer("vacant_house_count_80"),
  vacant_house_count_85: integer("vacant_house_count_85"),
  vacant_house_count_90: integer("vacant_house_count_90"),
  vacant_house_count_95: integer("vacant_house_count_95"),

  /** 閾値別空き家割合（5%刻み、19パターン） */
  predicted_probability_05: real("predicted_probability_05"),
  predicted_probability_10: real("predicted_probability_10"),
  predicted_probability_15: real("predicted_probability_15"),
  predicted_probability_20: real("predicted_probability_20"),
  predicted_probability_25: real("predicted_probability_25"),
  predicted_probability_30: real("predicted_probability_30"),
  predicted_probability_35: real("predicted_probability_35"),
  predicted_probability_40: real("predicted_probability_40"),
  predicted_probability_45: real("predicted_probability_45"),
  predicted_probability_50: real("predicted_probability_50"),
  predicted_probability_55: real("predicted_probability_55"),
  predicted_probability_60: real("predicted_probability_60"),
  predicted_probability_65: real("predicted_probability_65"),
  predicted_probability_70: real("predicted_probability_70"),
  predicted_probability_75: real("predicted_probability_75"),
  predicted_probability_80: real("predicted_probability_80"),
  predicted_probability_85: real("predicted_probability_85"),
  predicted_probability_90: real("predicted_probability_90"),
  predicted_probability_95: real("predicted_probability_95"),

  /**
   * R7追加分
   */
  unestimable_count: integer("unestimable_count"), // 推定不可件数

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectDataSetDetailArea = typeof data_set_detail_areas.$inferSelect;
export type InsertDataSetDetailArea = typeof data_set_detail_areas.$inferInsert;

export const isAreaColumn = (
  column: keyof SelectDataSetDetailBuilding | keyof SelectDataSetDetailArea,
): column is keyof SelectDataSetDetailArea => {
  return column in data_set_detail_areas;
};

/** データセット:正規化済み */
export const normalized_data_sets = sqliteTable("normalized_data_sets", {
  id: integer("id").primaryKey(),
  // 表示・編集用のファイル名 初期値はnullになる
  file_name: text("file_name"),
  // job_resultsの内部パス / NOT NULL
  file_path: text("file_path").notNull(),
  job_results_id: integer("job_results_id").references(() => job_results.id),
  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectNormalizedDataSet = typeof normalized_data_sets.$inferSelect;
export type InsertNormalizedDataSet = typeof normalized_data_sets.$inferInsert;

/** データセット:シード */
export const raw_data_sets = sqliteTable("raw_data_sets", {
  id: integer("id").primaryKey(),
  // 表示・編集用のファイル名 / NOT NULL
  file_name: text("file_name").notNull(),
  // job_resultsの内部パス / NOT NULL
  file_path: text("file_path").notNull(),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectRawDataSet = typeof raw_data_sets.$inferSelect;
export type InsertRawDataSet = typeof raw_data_sets.$inferInsert;

export const jobs = sqliteTable("jobs", {
  id: integer("id").primaryKey(),
  status: text("status", { enum: ["draft", "", "complete", "error"] }),
  type: text("type", {
    enum: ["preprocess", "ml", "result", "export", "join_check"],
  }),
  process_id: integer("process_id"),
  is_named: integer("is_named", { mode: "boolean" }).notNull(), // 1: 名前をつけて保存済み / 0: 未保存

  parameters: text("parameters", { mode: "json" })
    .$type<JobParameters>()
    .notNull(),
  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectJob = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;

export const job_tasks = sqliteTable("job_tasks", {
  id: integer("id").primaryKey(),
  job_id: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  progress_percent: text("progress_percent") /** @memo 結局使ってないかも */,
  preprocess_type: text("preprocess_type", {
    enum: [
      "e014",
      "e016",
      "e015",
    ] /** 実際にはバックエンドはこれ以外の値も保存する。FEはこの値しか使用しないのでこの定義とする */,
  }),
  error_code: text("error_code", { enum: ["undefined_error"] }),
  error_msg: text("error_msg"),

  // 完了したら設定される
  result: text("result", {
    mode: "json",
  }).$type<JobTaskResult>(),

  // 完了したら設定される
  finished_at: text("finished_at").default(sql`(CURRENT_TIMESTAMP)`),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectJobTask = typeof job_tasks.$inferSelect;
export type InsertJobTask = typeof job_tasks.$inferInsert;

export const job_results = sqliteTable("job_results", {
  id: integer("id").primaryKey(),
  job_id: integer("job_id")
    .references(() => jobs.id)
    .notNull(),
  // Pythonが吐き出した内部パス(path/to/normalizeの名前)
  file_path: text("file_path").notNull(),

  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectJobResult = typeof job_results.$inferSelect;
export type InsertJobResult = typeof job_results.$inferInsert;

export const model_files = sqliteTable("model_files", {
  id: integer("id").primaryKey(),
  file_name: text("file_name"),
  note: text("note"),
  // 内部パス
  file_path: text("file_path"),

  created_by_job_id: integer("created_by_job_id")
    .references(() => jobs.id)
    .notNull(), // 手動アップロードの場合は擬似的にジョブを作成して紐づける
  created_at: text("created_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull(),
  updated_at: text("updated_at")
    .default(sql`(CURRENT_TIMESTAMP)`)
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
});

export type SelectModelFile = typeof model_files.$inferSelect;
export type InsertModelFile = typeof model_files.$inferInsert;
