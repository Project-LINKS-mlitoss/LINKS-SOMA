import { type ChartColumnType } from "../types/chart-column-type";
import {
  type SelectDataSetDetailArea,
  type SelectDataSetDetailBuilding,
} from "../../db/schema";
import { translateColumnToJapanese } from "../column-translation-utils";

// 選択基準のドキュメントなし。コードが正
export type AREA_DATASET_COLUMN = keyof Pick<
  SelectDataSetDetailArea,
  | "area"
  | "area_group"
  | "young_population_ratio"
  | "elderly_population_ratio"
  | "total_building_count"
  | "vacant_house_count"
  | "predicted_probability"
  | "unestimable_count"
>;

export type BUILDING_DATASET_COLUMN = keyof Pick<
  SelectDataSetDetailBuilding,
  | "area_group"
  | "reference_date"
  | "normalized_address"
  | "household_size"
  | "members_under_15"
  | "members_over_65"
  | "water_disconnection_flag"
  | "max_water_usage"
  | "avg_water_usage"
  | "total_water_usage"
  | "structure_name"
  | "residence_duration"
  | "has_juki_registry"
  | "building_use"
  | "measured_height"
  | "inland_flooding_risk_rank"
  | "inland_flooding_risk_depth"
  | "name"
  | "river_flooding_risk_description"
  | "river_flooding_risk_rank"
  | "river_flooding_risk_depth"
  | "landslide_risk_description"
  | "predicted_probability"
  | "predicted_label"
  | "buildingtype_determination_not_possible_flag"
  | "days_since_registration_event"
  | "address"
  | "area_classification_type"
  | "bldg_dm_attribute"
  | "bldg_facility_attribute"
  | "bldg_facility_id_attribute"
  | "bldg_facility_type_attribute"
  | "bldg_real_estate_id_attribute"
  | "bldg_usecase_attribute"
  | "bounded_by"
  | "building_data_quality_attribute"
  | "building_detail_attribute"
  | "building_disaster_risk_attribute"
  | "hightide_risk_depth"
  | "hightide_risk_depth_uom"
  | "hightide_risk_description"
  | "hightide_risk_rank"
  | "landslide_risk_areatype"
  | "river_flooding_risk_admin_type"
  | "tsunami_risk_depth"
  | "tsunami_risk_depth_uom"
  | "tsunami_risk_description"
  | "tsunami_risk_rank"
  | "building_footprint_area"
  | "building_footprint_area_uom"
  | "building_height"
  | "building_height_uom"
  | "building_id_attribute"
  | "building_structure_type"
  | "consists_of_building_part"
  | "bldg_creation_date"
  | "districts_and_zones_type"
  | "function_plateau"
  | "generic_attribute"
  | "ifc_building_attribute"
  | "indoor_building_attribute"
  | "interior_building_installation"
  | "interior_room"
  | "key_value_pair_attribute"
  | "large_customer_facility_attribute"
  | "lod_type"
  | "org_usage2"
  | "outer_building_installation"
  | "parent_type"
  | "roof_type"
  | "storey_heights_above_ground"
  | "storey_heights_below_ground"
  | "storeys_above_ground"
  | "storeys_below_ground"
  | "survey_year"
  | "termination_date"
  | "total_floor_area"
  | "total_floor_area_uom"
  | "year_of_construction"
  | "year_of_demolition"
  | "key_code"
  | "building_type"
  | "water_startdate"
  | "water_enddate"
  | "river_flooding_risk_scale"
  | "river_flooding_risk_duration"
  | "river_flooding_risk_duration_uom"
  | "registration_date"
  | "date_registration_event"
  | "waterusage_11to12m_ago"
  | "waterusage_9to10m_ago"
  | "waterusage_7to8m_ago"
  | "waterusage_5to6m_ago"
  | "waterusage_3to4m_ago"
  | "waterusage_1to2m_ago"
  // 追加カラム
  | "max_age"
  | "num_deaths"
  | "num_inmigrants"
  | "num_outmigrants_relocations"
  | "num_cancellations"
  | "years_water_closure"
  | "average_waterusage_person"
  | "change_rate_waterusage_over_last4months"
  | "flag_zero_usage_over4consecutivemonths"
  | "flag_concreteblock"
  | "flag_brick"
  | "flag_reinforcedconcreteconstruction"
  | "flag_steelframe"
  | "flag_wood"
  | "flag_earthen"
  | "flag_otherstructures"
  | "flag_inheritance"
  | "flag_gift"
  | "flag_sale"
  | "flag_seizure"
  // 水道時系列特徴量
  | "has_usage_data"
  | "num_zero_periods"
  | "min_water_usage"
  | "usage_data_unavailable_flag"
  | "usage_first_half_avg"
  | "usage_second_half_avg"
  | "usage_half_year_change_rate"
  | "recent_usage_avg"
  // 住基イベント特徴量
  | "max_age_juki_residence_isnull"
  | "has_cancellation_event"
  | "num_outmigrant_events"
  | "years_since_last_transfer"
  | "years_since_last_transfer_is_missing"
  | "sole_elderly_resident"
  | "death_no_replacement"
  | "household_shrinkage_rate"
  // 交差・ルール特徴量
  | "composite_rule_score"
>;

export type ColumnMetadataValue = {
  label: string;
  type: ChartColumnType;
  unit?: string;
  groupable?: boolean; // グルーピング可能かどうか
};
export type ColumnMetadata<COLUMN extends string | number | symbol> = {
  [k in COLUMN]: ColumnMetadataValue;
};

/**
 * D903のカラムごとのメタデータをハードコード
 * ここでの設定は、チャートの表示やグルーピングの際に利用される
 */
export const AREA_DATASET_COLUMN_METADATA: ColumnMetadata<AREA_DATASET_COLUMN> =
  {
    area: {
      label: translateColumnToJapanese("area", "area"),
      type: "float",
      groupable: true,
      unit: "m^2",
    },
    area_group: {
      label: translateColumnToJapanese("area_group", "area"),
      type: "text",
      groupable: true,
      unit: "",
    },
    young_population_ratio: {
      label: translateColumnToJapanese("young_population_ratio", "area"),
      type: "float",
      groupable: true,
      unit: "%",
    },
    elderly_population_ratio: {
      label: translateColumnToJapanese("elderly_population_ratio", "area"),
      type: "float",
      groupable: true,
      unit: "%",
    },
    total_building_count: {
      label: translateColumnToJapanese("total_building_count", "area"),
      type: "integer",
      groupable: true,
      unit: "棟",
    },
    predicted_probability: {
      label: translateColumnToJapanese("predicted_probability", "area"),
      type: "float",
      groupable: true,
      unit: "%",
    },
    vacant_house_count: {
      label: translateColumnToJapanese("vacant_house_count", "area"),
      type: "integer",
      groupable: true,
      unit: "件",
    },
    unestimable_count: {
      label: translateColumnToJapanese("unestimable_count", "area"),
      type: "integer",
      groupable: true,
      unit: "件",
    },
  };

/**
 * D902のカラムごとのメタデータをハードコード
 * ここでの設定は、チャートの表示やグルーピングの際に利用される
 */
export const BUILDING_DATASET_COLUMN_METADATA: ColumnMetadata<BUILDING_DATASET_COLUMN> =
  {
    area_group: {
      label: translateColumnToJapanese("area_group", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    normalized_address: {
      label: translateColumnToJapanese("normalized_address", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    reference_date: {
      label: translateColumnToJapanese("reference_date", "building"),
      type: "date",
      groupable: true,
      unit: "",
    },
    household_size: {
      label: translateColumnToJapanese("household_size", "building"),
      type: "integer",
      groupable: true,
      unit: "人",
    },
    members_under_15: {
      label: translateColumnToJapanese("members_under_15", "building"),
      type: "integer",
      groupable: true,
      unit: "人",
    },
    members_over_65: {
      label: translateColumnToJapanese("members_over_65", "building"),
      type: "integer",
      groupable: true,
      unit: "人",
    },
    predicted_probability: {
      label: translateColumnToJapanese("predicted_probability", "building"),
      type: "float",
      groupable: true,
      unit: "%",
    },
    predicted_label: {
      label: translateColumnToJapanese("predicted_label", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    water_disconnection_flag: {
      label: translateColumnToJapanese("water_disconnection_flag", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    max_water_usage: {
      label: translateColumnToJapanese("max_water_usage", "building"),
      type: "integer",
      groupable: true,
      unit: "立米",
    },
    avg_water_usage: {
      label: translateColumnToJapanese("avg_water_usage", "building"),
      type: "integer",
      groupable: true,
      unit: "立米",
    },
    total_water_usage: {
      label: translateColumnToJapanese("total_water_usage", "building"),
      type: "integer",
      groupable: true,
      unit: "立米",
    },
    structure_name: {
      label: translateColumnToJapanese("structure_name", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    measured_height: {
      label: translateColumnToJapanese("measured_height", "building"),
      type: "integer",
      groupable: true,
      unit: "m",
    },
    name: {
      label: translateColumnToJapanese("name", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    inland_flooding_risk_rank: {
      label: translateColumnToJapanese("inland_flooding_risk_rank", "building"),
      type: "integer",
      groupable: true,
      unit: "",
    },
    inland_flooding_risk_depth: {
      label: translateColumnToJapanese(
        "inland_flooding_risk_depth",
        "building",
      ),
      type: "integer",
      groupable: true,
      unit: "m",
    },
    landslide_risk_description: {
      label: translateColumnToJapanese(
        "landslide_risk_description",
        "building",
      ),
      type: "text",
      groupable: true,
      unit: "",
    },
    river_flooding_risk_description: {
      label: translateColumnToJapanese(
        "river_flooding_risk_description",
        "building",
      ),
      type: "text",
      groupable: true,
      unit: "",
    },
    river_flooding_risk_rank: {
      label: translateColumnToJapanese("river_flooding_risk_rank", "building"),
      type: "integer",
      groupable: true,
      unit: "",
    },
    river_flooding_risk_depth: {
      label: translateColumnToJapanese("river_flooding_risk_depth", "building"),
      type: "integer",
      groupable: true,
      unit: "m",
    },
    buildingtype_determination_not_possible_flag: {
      label: translateColumnToJapanese(
        "buildingtype_determination_not_possible_flag",
        "building",
      ),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    days_since_registration_event: {
      label: translateColumnToJapanese(
        "days_since_registration_event",
        "building",
      ),
      type: "integer",
      groupable: true,
      unit: "日",
    },
    address: {
      label: translateColumnToJapanese("address", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    area_classification_type: {
      label: translateColumnToJapanese("area_classification_type", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    bldg_dm_attribute: {
      label: translateColumnToJapanese("bldg_dm_attribute", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    bldg_facility_attribute: {
      label: translateColumnToJapanese("bldg_facility_attribute", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    bldg_facility_id_attribute: {
      label: translateColumnToJapanese(
        "bldg_facility_id_attribute",
        "building",
      ),
      type: "text",
      groupable: false,
      unit: "",
    },
    bldg_facility_type_attribute: {
      label: translateColumnToJapanese(
        "bldg_facility_type_attribute",
        "building",
      ),
      type: "text",
      groupable: true,
      unit: "",
    },
    bldg_real_estate_id_attribute: {
      label: translateColumnToJapanese(
        "bldg_real_estate_id_attribute",
        "building",
      ),
      type: "text",
      groupable: false,
      unit: "",
    },
    bldg_usecase_attribute: {
      label: translateColumnToJapanese("bldg_usecase_attribute", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    bounded_by: {
      label: translateColumnToJapanese("bounded_by", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    building_data_quality_attribute: {
      label: translateColumnToJapanese(
        "building_data_quality_attribute",
        "building",
      ),
      type: "text",
      groupable: false,
      unit: "",
    },
    building_detail_attribute: {
      label: translateColumnToJapanese("building_detail_attribute", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    building_disaster_risk_attribute: {
      label: translateColumnToJapanese(
        "building_disaster_risk_attribute",
        "building",
      ),
      type: "text",
      groupable: false,
      unit: "",
    },
    hightide_risk_depth: {
      label: translateColumnToJapanese("hightide_risk_depth", "building"),
      type: "float",
      groupable: true,
      unit: "m",
    },
    hightide_risk_depth_uom: {
      label: translateColumnToJapanese("hightide_risk_depth_uom", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    hightide_risk_description: {
      label: translateColumnToJapanese("hightide_risk_description", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    hightide_risk_rank: {
      label: translateColumnToJapanese("hightide_risk_rank", "building"),
      type: "integer",
      groupable: true,
      unit: "",
    },
    landslide_risk_areatype: {
      label: translateColumnToJapanese("landslide_risk_areatype", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    river_flooding_risk_admin_type: {
      label: translateColumnToJapanese(
        "river_flooding_risk_admin_type",
        "building",
      ),
      type: "text",
      groupable: true,
      unit: "",
    },
    tsunami_risk_depth: {
      label: translateColumnToJapanese("tsunami_risk_depth", "building"),
      type: "float",
      groupable: true,
      unit: "m",
    },
    tsunami_risk_depth_uom: {
      label: translateColumnToJapanese("tsunami_risk_depth_uom", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    tsunami_risk_description: {
      label: translateColumnToJapanese("tsunami_risk_description", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    tsunami_risk_rank: {
      label: translateColumnToJapanese("tsunami_risk_rank", "building"),
      type: "integer",
      groupable: true,
      unit: "",
    },
    building_footprint_area: {
      label: translateColumnToJapanese("building_footprint_area", "building"),
      type: "float",
      groupable: true,
      unit: "m^2",
    },
    building_footprint_area_uom: {
      label: translateColumnToJapanese(
        "building_footprint_area_uom",
        "building",
      ),
      type: "text",
      groupable: false,
      unit: "",
    },
    building_height: {
      label: translateColumnToJapanese("building_height", "building"),
      type: "float",
      groupable: true,
      unit: "m",
    },
    building_height_uom: {
      label: translateColumnToJapanese("building_height_uom", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    building_id_attribute: {
      label: translateColumnToJapanese("building_id_attribute", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    building_structure_type: {
      label: translateColumnToJapanese("building_structure_type", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    consists_of_building_part: {
      label: translateColumnToJapanese("consists_of_building_part", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    bldg_creation_date: {
      label: translateColumnToJapanese("bldg_creation_date", "building"),
      type: "date",
      groupable: true,
      unit: "",
    },
    districts_and_zones_type: {
      label: translateColumnToJapanese("districts_and_zones_type", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    function_plateau: {
      label: translateColumnToJapanese("function_plateau", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    generic_attribute: {
      label: translateColumnToJapanese("generic_attribute", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    ifc_building_attribute: {
      label: translateColumnToJapanese("ifc_building_attribute", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    indoor_building_attribute: {
      label: translateColumnToJapanese("indoor_building_attribute", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    interior_building_installation: {
      label: translateColumnToJapanese(
        "interior_building_installation",
        "building",
      ),
      type: "text",
      groupable: false,
      unit: "",
    },
    interior_room: {
      label: translateColumnToJapanese("interior_room", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    key_value_pair_attribute: {
      label: translateColumnToJapanese("key_value_pair_attribute", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    large_customer_facility_attribute: {
      label: translateColumnToJapanese(
        "large_customer_facility_attribute",
        "building",
      ),
      type: "text",
      groupable: true,
      unit: "",
    },
    lod_type: {
      label: translateColumnToJapanese("lod_type", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    org_usage2: {
      label: translateColumnToJapanese("org_usage2", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    outer_building_installation: {
      label: translateColumnToJapanese(
        "outer_building_installation",
        "building",
      ),
      type: "text",
      groupable: false,
      unit: "",
    },
    parent_type: {
      label: translateColumnToJapanese("parent_type", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    roof_type: {
      label: translateColumnToJapanese("roof_type", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    storey_heights_above_ground: {
      label: translateColumnToJapanese(
        "storey_heights_above_ground",
        "building",
      ),
      type: "float",
      groupable: true,
      unit: "m",
    },
    storey_heights_below_ground: {
      label: translateColumnToJapanese(
        "storey_heights_below_ground",
        "building",
      ),
      type: "float",
      groupable: true,
      unit: "m",
    },
    storeys_above_ground: {
      label: translateColumnToJapanese("storeys_above_ground", "building"),
      type: "integer",
      groupable: true,
      unit: "階",
    },
    storeys_below_ground: {
      label: translateColumnToJapanese("storeys_below_ground", "building"),
      type: "integer",
      groupable: true,
      unit: "階",
    },
    survey_year: {
      label: translateColumnToJapanese("survey_year", "building"),
      type: "integer",
      groupable: true,
      unit: "年",
    },
    termination_date: {
      label: translateColumnToJapanese("termination_date", "building"),
      type: "date",
      groupable: true,
      unit: "",
    },
    total_floor_area: {
      label: translateColumnToJapanese("total_floor_area", "building"),
      type: "float",
      groupable: true,
      unit: "m^2",
    },
    total_floor_area_uom: {
      label: translateColumnToJapanese("total_floor_area_uom", "building"),
      type: "text",
      groupable: false,
      unit: "",
    },
    year_of_construction: {
      label: translateColumnToJapanese("year_of_construction", "building"),
      type: "integer",
      groupable: true,
      unit: "年",
    },
    year_of_demolition: {
      label: translateColumnToJapanese("year_of_demolition", "building"),
      type: "integer",
      groupable: true,
      unit: "年",
    },
    key_code: {
      label: translateColumnToJapanese("key_code", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    building_type: {
      label: translateColumnToJapanese("building_type", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    water_startdate: {
      label: translateColumnToJapanese("water_startdate", "building"),
      type: "date",
      groupable: true,
      unit: "",
    },
    water_enddate: {
      label: translateColumnToJapanese("water_enddate", "building"),
      type: "date",
      groupable: true,
      unit: "",
    },
    residence_duration: {
      label: translateColumnToJapanese("residence_duration", "building"),
      type: "integer",
      groupable: true,
      unit: "日",
    },
    has_juki_registry: {
      label: translateColumnToJapanese("has_juki_registry", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    building_use: {
      label: translateColumnToJapanese("building_use", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    river_flooding_risk_scale: {
      label: translateColumnToJapanese("river_flooding_risk_scale", "building"),
      type: "text",
      groupable: true,
      unit: "",
    },
    river_flooding_risk_duration: {
      label: translateColumnToJapanese(
        "river_flooding_risk_duration",
        "building",
      ),
      type: "text",
      groupable: true,
      unit: "",
    },
    river_flooding_risk_duration_uom: {
      label: translateColumnToJapanese(
        "river_flooding_risk_duration_uom",
        "building",
      ),
      type: "text",
      groupable: false,
      unit: "",
    },
    registration_date: {
      label: translateColumnToJapanese("registration_date", "building"),
      type: "date",
      groupable: true,
      unit: "",
    },
    date_registration_event: {
      label: translateColumnToJapanese("date_registration_event", "building"),
      type: "date",
      groupable: true,
      unit: "",
    },
    waterusage_11to12m_ago: {
      label: translateColumnToJapanese("waterusage_11to12m_ago", "building"),
      type: "float",
      groupable: true,
      unit: "立米",
    },
    waterusage_9to10m_ago: {
      label: translateColumnToJapanese("waterusage_9to10m_ago", "building"),
      type: "float",
      groupable: true,
      unit: "立米",
    },
    waterusage_7to8m_ago: {
      label: translateColumnToJapanese("waterusage_7to8m_ago", "building"),
      type: "float",
      groupable: true,
      unit: "立米",
    },
    waterusage_5to6m_ago: {
      label: translateColumnToJapanese("waterusage_5to6m_ago", "building"),
      type: "float",
      groupable: true,
      unit: "立米",
    },
    waterusage_3to4m_ago: {
      label: translateColumnToJapanese("waterusage_3to4m_ago", "building"),
      type: "float",
      groupable: true,
      unit: "立米",
    },
    waterusage_1to2m_ago: {
      label: translateColumnToJapanese("waterusage_1to2m_ago", "building"),
      type: "float",
      groupable: true,
      unit: "立米",
    },
    // 追加カラム
    max_age: {
      label: translateColumnToJapanese("max_age", "building"),
      type: "integer",
      groupable: true,
      unit: "歳",
    },
    num_deaths: {
      label: translateColumnToJapanese("num_deaths", "building"),
      type: "integer",
      groupable: true,
      unit: "",
    },
    num_inmigrants: {
      label: translateColumnToJapanese("num_inmigrants", "building"),
      type: "integer",
      groupable: true,
      unit: "",
    },
    num_outmigrants_relocations: {
      label: translateColumnToJapanese(
        "num_outmigrants_relocations",
        "building",
      ),
      type: "integer",
      groupable: true,
      unit: "",
    },
    num_cancellations: {
      label: translateColumnToJapanese("num_cancellations", "building"),
      type: "integer",
      groupable: true,
      unit: "",
    },
    years_water_closure: {
      label: translateColumnToJapanese("years_water_closure", "building"),
      type: "float",
      groupable: true,
      unit: "年",
    },
    average_waterusage_person: {
      label: translateColumnToJapanese("average_waterusage_person", "building"),
      type: "float",
      groupable: true,
      unit: "立米",
    },
    change_rate_waterusage_over_last4months: {
      label: translateColumnToJapanese(
        "change_rate_waterusage_over_last4months",
        "building",
      ),
      type: "float",
      groupable: true,
      unit: "%",
    },
    flag_zero_usage_over4consecutivemonths: {
      label: translateColumnToJapanese(
        "flag_zero_usage_over4consecutivemonths",
        "building",
      ),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_concreteblock: {
      label: translateColumnToJapanese("flag_concreteblock", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_brick: {
      label: translateColumnToJapanese("flag_brick", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_reinforcedconcreteconstruction: {
      label: translateColumnToJapanese(
        "flag_reinforcedconcreteconstruction",
        "building",
      ),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_steelframe: {
      label: translateColumnToJapanese("flag_steelframe", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_wood: {
      label: translateColumnToJapanese("flag_wood", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_earthen: {
      label: translateColumnToJapanese("flag_earthen", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_otherstructures: {
      label: translateColumnToJapanese("flag_otherstructures", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_inheritance: {
      label: translateColumnToJapanese("flag_inheritance", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_gift: {
      label: translateColumnToJapanese("flag_gift", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_sale: {
      label: translateColumnToJapanese("flag_sale", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    flag_seizure: {
      label: translateColumnToJapanese("flag_seizure", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    // 水道時系列特徴量
    has_usage_data: {
      label: translateColumnToJapanese("has_usage_data", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    num_zero_periods: {
      label: translateColumnToJapanese("num_zero_periods", "building"),
      type: "float",
      groupable: true,
      unit: "期",
    },
    min_water_usage: {
      label: translateColumnToJapanese("min_water_usage", "building"),
      type: "float",
      groupable: true,
      unit: "",
    },
    usage_data_unavailable_flag: {
      label: translateColumnToJapanese("usage_data_unavailable_flag", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    usage_first_half_avg: {
      label: translateColumnToJapanese("usage_first_half_avg", "building"),
      type: "float",
      groupable: true,
      unit: "",
    },
    usage_second_half_avg: {
      label: translateColumnToJapanese("usage_second_half_avg", "building"),
      type: "float",
      groupable: true,
      unit: "",
    },
    usage_half_year_change_rate: {
      label: translateColumnToJapanese("usage_half_year_change_rate", "building"),
      type: "float",
      groupable: true,
      unit: "",
    },
    recent_usage_avg: {
      label: translateColumnToJapanese("recent_usage_avg", "building"),
      type: "float",
      groupable: true,
      unit: "",
    },
    // 住基イベント特徴量
    max_age_juki_residence_isnull: {
      label: translateColumnToJapanese("max_age_juki_residence_isnull", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    has_cancellation_event: {
      label: translateColumnToJapanese("has_cancellation_event", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    num_outmigrant_events: {
      label: translateColumnToJapanese("num_outmigrant_events", "building"),
      type: "float",
      groupable: true,
      unit: "件",
    },
    years_since_last_transfer: {
      label: translateColumnToJapanese("years_since_last_transfer", "building"),
      type: "float",
      groupable: true,
      unit: "年",
    },
    years_since_last_transfer_is_missing: {
      label: translateColumnToJapanese(
        "years_since_last_transfer_is_missing",
        "building",
      ),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    sole_elderly_resident: {
      label: translateColumnToJapanese("sole_elderly_resident", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    death_no_replacement: {
      label: translateColumnToJapanese("death_no_replacement", "building"),
      type: "boolean",
      groupable: true,
      unit: "",
    },
    household_shrinkage_rate: {
      label: translateColumnToJapanese("household_shrinkage_rate", "building"),
      type: "float",
      groupable: true,
      unit: "",
    },
    // 交差・ルール特徴量
    composite_rule_score: {
      label: translateColumnToJapanese("composite_rule_score", "building"),
      type: "float",
      groupable: true,
      unit: "",
    },
  };
