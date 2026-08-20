import type { MapWithTableView } from "../../../../types";

// バッチ処理
export const BATCH_SIZE = 2000;

// IPCチャンネル
export const IPC_CHANNELS = {
  SELECT_BUILDINGS_COUNT: "selectBuildingsCount",
  SELECT_BUILDINGS_LAST_ID: "selectBuildingsLastId",
  SELECT_BUILDINGS_CHUNK: "selectBuildingsChunk",
  SELECT_BUILDINGS_VIEWPORT_CHUNK: "selectBuildingsViewportChunk",
  SELECT_BUILDINGS_VIEWPORT_COUNT: "selectBuildingsViewportCount",
  SELECT_AREAS_VIEWPORT_CHUNK: "selectAreasViewportChunk",
  SELECT_AREAS_VIEWPORT_COUNT: "selectAreasViewportCount",
} as const;

// マップイベント
export const MAP_EVENTS = {
  CLOSE_ALL_POPUPS: "closeAllPopups",
  CLICK: "click",
  MOUSE_ENTER: "mouseenter",
  MOUSE_LEAVE: "mouseleave",
} as const;

// レイヤーIDサフィックス
export const LAYER_SUFFIXES = {
  POINTS: "-points",
  POLYGONS: "-polygons",
  /** 重複ポリゴン・ポイント用のサフィックス */
  OVERLAP: "-overlap",
} as const;

// ポップアップ関連
// ポップアップのボタンテキスト定数
export const POPUP_BUTTON_TEXT = {
  SHOW_ALL: "すべての項目を表示",
  BACK_TO_SIMPLE: "戻る",
} as const;

// ポップアップのDOM要素ID定数
export const POPUP_ELEMENT_IDS = {
  TOGGLE_BUTTON: "toggle-all-columns-button",
  ALL_COLUMNS_VIEW: "popup-all-columns",
  SIMPLE_VIEW: "popup-simple-view",
  // 重複レコードナビゲーション用
  OVERLAP_NAV_PREV: "overlap-nav-prev",
  OVERLAP_NAV_NEXT: "overlap-nav-next",
  OVERLAP_NAV_INDICATOR: "overlap-nav-indicator",
} as const;

// ポップアップのTransform値定数
export const POPUP_TRANSFORM_VALUES = {
  SIMPLE_VIEW_VISIBLE: "translateX(0%)",
  SIMPLE_VIEW_HIDDEN: "translateX(-100%)",
  ALL_COLUMNS_VISIBLE: "translateX(0%)",
  ALL_COLUMNS_HIDDEN: "translateX(100%)",
} as const;

// 除外カラムの設定（修正しやすいように設定として外部化）
export const EXCLUDED_COLUMN_PATTERNS = {
  // ID系
  idColumns: [
    "id",
    "uuid",
    "_id",
    "gml_id",
    "building_id",
    "vacant_house_id",
    "fid",
    "bldg_id",
    "building_id_attribute",
  ] as const,

  // 日時系
  dateTimeColumns: [
    "created_at",
    "updated_at",
    "deleted_at",
    "reference_date",
    "bldg_creation_date",
    "termination_date",
    "survey_year",
  ] as const,

  // ジオメトリ系
  geometryColumns: [
    "geometry",
    "geom",
    "coordinates",
    "geocoded_longitude",
    "geocoded_latitude",
    "vacant_house_longitude",
    "vacant_house_latitude",
    "geometry_src_desc",
  ] as const,

  // システム内部フラグ
  systemFlags: [
    "is_deleted",
    "version",
    "data_set_result_id",
    "has_geocoding",
  ] as const,

  // その他除外カラム
  others: ["unestimable_count", "total_building_count"] as const,

  // 閾値別カラム（5%刻み20パターン: predicted_label_XX, vacant_house_count_XX, predicted_probability_XX）
  // ※正規表現による除外は閾値別カラム専用。他のカラムは完全一致で除外する
  thresholdPatterns: [
    /^predicted_label_\d+$/,
    /^vacant_house_count_\d+$/,
    /^predicted_probability_\d+$/,
  ] as const,

  // PLATEAUメタデータ系（LOD、アピアランス、属性情報等）
  plateauMetadata: [
    "address",
    "appearance_src_desc",
    "bldg_dm_attribute",
    "bldg_facility_attribute",
    "bldg_facility_id_attribute",
    "bldg_facility_type_attribute",
    "bldg_usecase_attribute",
    "bounded_by",
    "building_data_quality_attribute",
    "building_detail_attribute",
    "building_disaster_risk_attribute",
    "bldg_class",
    "bldg_city",
    "bldg_description",
    "consists_of_building_part",
    "districts_and_zones_type",
    "function_plateau",
    "generic_attribute",
    "ifc_building_attribute",
    "indoor_building_attribute",
    "interior_building_installation",
    "interior_room",
    "key_value_pair_attribute",
    "large_customer_facility_attribute",
    "lod1_height_type",
    "lod_type",
    "name",
    "org_usage2",
    "parent_type",
    "prefecture",
    "roof_type",
    "src_scale",
    "thematic_src_desc",
    "building_use",
  ] as const,

  // 建物寸法系（高さ、面積等）
  buildingDimensions: [
    "building_footprint_area",
    "building_footprint_area_uom",
    "building_height",
    "building_height_uom",
    "storeys_below_ground",
    "storey_heights_above_ground",
    "storey_heights_below_ground",
    "measured_height_uom",
    "total_floor_area_uom",
  ] as const,

  // 災害リスク詳細系（単位、ランク、説明）
  disasterRiskDetails: [
    "hightide_risk_depth_uom",
    "hightide_risk_description",
    "hightide_risk_rank",
    "inland_flooding_risk_depth_uom",
    "inland_flooding_risk_desc",
    "inland_flooding_risk_rank",
    "landslide_risk_description",
    "river_flooding_risk_admin_type",
    "river_flooding_risk_depth_uom",
    "river_flooding_risk_duration",
    "river_flooding_risk_duration_uom",
    "river_flooding_risk_rank",
    "tsunami_risk_depth_uom",
    "tsunami_risk_description",
    "tsunami_risk_rank",
  ] as const,

  // ジオコーディング関連
  geocodingDetails: [
    "level_geocoding",
    "confidency_geocoding",
    "address_for_building_type",
    "latitude_for_building_type",
    "longitude_for_building_type",
  ] as const,
} as const;

// 現在表示中のカラムを取得する関数（各ポップアップで使用されているカラム）
export const CURRENTLY_DISPLAYED_COLUMNS = {
  area: [
    "predicted_probability",
    "area_group",
    "young_population_ratio",
    "elderly_population_ratio",
    "area",
    "vacant_house_count",
    "total_building_count",
  ] as const,

  building: [
    "predicted_probability",
    "predicted_probability_change_rate_from_oldest",
    "predicted_probability_change_rate_from_previous",
    "normalized_address",
    "household_size",
    "members_under_15",
    "members_15_to_64",
    "members_over_65",
    "total_water_usage",
    "water_disconnection_flag",
    "registration_date",
    "structure_name",
    "buildingtype_determination_not_possible_flag",
  ] as const,
} as const;

/**
 * ポリゴン描画をスキップするズームレベルのしきい値
 * このズームレベル未満の場合、描画をスキップして警告を表示する
 */
export const POLYGON_RENDER_MIN_ZOOM: Record<MapWithTableView["unit"], number> =
  {
    building: 13,
    area: 9,
  };

/**
 * 重複レコードナビゲーションの設定
 *
 * パフォーマンス考慮事項:
 * - 蓄積型設計: fetchedFeatures配列にナビゲーション済みレコードを保持
 * - 1レコード ≒ 5-20KB（geometryの複雑さによる）
 * - MAX_NAVIGABLE_OVERLAPS=100で約2MBまでのメモリ使用量に制限
 *
 * 将来の拡張検討:
 * - 100件以上が頻発する場合、スライディングウィンドウ方式への移行を検討
 *   （常に前後N件のみ保持し、それ以外は破棄・再取得）
 * - テーブルビューへのリンクで全件確認を誘導
 */
export const OVERLAP_NAVIGATION = {
  /** 初回取得件数（クリック時に一括取得する最大件数） */
  INITIAL_FETCH_LIMIT: 20,
  /** ナビゲーション可能な最大件数（メモリ安全性のため） */
  MAX_NAVIGABLE_OVERLAPS: 100,
} as const;
