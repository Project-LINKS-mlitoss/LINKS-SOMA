import {
  type SelectDataSetDetailArea,
  type SelectDataSetDetailBuilding,
} from "../../schema";

interface Item {
  label: string;
  unit?: string;
}

// 日本語のラベルは以下のスプレッドシートを参照
// https://docs.google.com/spreadsheets/d/1j5gg41D2D82zFKPna7O18lQETGPCLtpp/edit?pli=1&gid=1342944122#gid=1342944122
// TODO: スプシにあって実装にないデータがありコメントアウトしている。Python側の出力を確認してから追加する想定
const buildingMetadata: Record<keyof SelectDataSetDetailBuilding, Item> = {
  id: {
    label: "id",
  },
  data_set_result_id: {
    label: "data_set_result_id",
  },
  residence_id: {
    label: "residenceID",
  },
  // key_code: {
  //   label: "KEY_CODE",
  // },
  reference_date: {
    label: "推定日",
  },
  normalized_address: {
    label: "正規化住所",
  },
  area_group: {
    label: "建物所属地域区分",
  },
  household_code: {
    label: "世帯番号",
  },
  household_size: {
    label: "世帯人数",
    unit: "人",
  },
  members_under_15: {
    label: "15歳未満人数",
    unit: "人",
  },
  percentage_under_15: {
    label: "15歳未満構成比",
    unit: "%",
  },
  members_15_to_64: {
    label: "15歳以上64歳以下人数",
    unit: "人",
  },
  percentage_15_to_64: {
    label: "15歳以上64歳以下構成比",
    unit: "%",
  },
  members_over_65: {
    label: "65歳以上人数",
    unit: "人",
  },
  percentage_over_65: {
    label: "65歳以上構成比",
    unit: "%",
  },
  gender_ratio: {
    label: "男女比",
    unit: "%",
  },
  residence_duration: {
    label: "住定期間",
  },
  min_age: {
    label: "最小年齢",
  },
  max_age: {
    label: "最大年齢",
  },
  water_supply_number: {
    label: "水道番号",
  },
  water_disconnection_flag: {
    label: "水道閉栓フラグ",
  },
  max_water_usage: {
    label: "水道最大使用量",
    unit: "L",
  },
  avg_water_usage: {
    label: "水道平均使用量",
    unit: "L",
  },
  min_water_usage: {
    label: "水道最小使用量",
    unit: "L",
  },
  total_water_usage: {
    label: "水道合計使用量",
    unit: "L",
  },
  change_ratio_water_usage: {
    label: "水道使用量変化率",
  },
  water_supply_source_info: {
    label: "水道名寄せ元情報",
  },
  structure_name: {
    label: "建物構造名",
  },
  registration_date: {
    label: "登録年月日",
  },
  registration_source_info: {
    label: "登記名寄せ元情報",
  },
  geometry: {
    label: "ジオメトリ",
  },
  // usage: {
  //   label: "usage",
  // },
  fid: {
    label: "fid",
  },
  class: {
    label: "class",
  },
  gml_id: {
    label: "gml_id",
  },
  measuredheight: {
    label: "浸水想定深",
  },
  measuredheightUom: {
    label: "measuredheightUom",
  },
  thematic_src_desc: {
    label: "thematic_src_desc",
  },
  src_scale: {
    label: "src_scale",
  },
  geometry_src_desc: {
    label: "geometry_src_desc",
  },
  lod1_height_type: {
    label: "lod1_height_type",
  },
  building_id: {
    label: "building_id",
  },
  prefecture: {
    label: "prefecture",
  },
  city: {
    label: "city",
  },
  description: {
    label: "description",
  },
  rank: {
    label: "浸水ランク",
  },
  depth: {
    label: "浸水深さ",
    unit: "m",
  },
  depth_uom: {
    label: "depth_uom",
  },
  admin_type: {
    label: "管轄自治体",
  },
  scale: {
    label: "scale",
  },
  duration: {
    label: "浸水期間",
    unit: "時間",
  },
  duration_uom: {
    label: "duration_uom",
  },
  building_use: {
    label: "建築申請用途",
  },
  floors_above_ground: {
    label: "地上階数",
    unit: "階",
  },
  floors_below_ground: {
    label: "地下階数",
    unit: "階",
  },
  value: {
    label: "value",
  },
  value_uom: {
    label: "value_uom",
  },
  inland_flooding_risk_desc: {
    label: "inland_flooding_risk_desc",
  },
  inland_flooding_risk_rank: {
    label: "inland_flooding_risk_rank",
  },
  inland_flooding_risk_depth: {
    label: "inland_flooding_risk_depth",
    unit: "m",
  },
  inland_flooding_risk_depth_uom: {
    label: "inland_flooding_risk_depth_uom",
  },
  name: {
    label: "name",
  },
  area_type: {
    label: "areaType",
  },
  river_flooding_risk_desc: {
    label: "river_flooding_risk_desc",
  },
  river_flooding_risk_rank: {
    label: "river_flooding_risk_rank",
  },
  river_flooding_risk_depth: {
    label: "river_flooding_risk_depth",
    unit: "m",
  },
  river_flooding_risk_depth_uom: {
    label: "river_flooding_risk_depth_uom",
  },
  landslide_risk_desc: {
    label: "landslide_risk_desc",
  },
  large_store_name: {
    label: "大規模店舗名称",
  },
  appearance_src_desc: {
    label: "appearance_src_desc",
  },
  // theme: {
  //   label: "theme",
  // },
  // image_uri: {
  //   label: "image_uri",
  // },
  // mimetype: {
  //   label: "mimetype",
  // },
  // texture_coordinates: {
  //   label: "texture_coordinates",
  // },
  branch_id: {
    label: "branch_id",
  },
  is_test: {
    label: "is_test",
  },
  predicted_label: {
    label: "predicted_label",
  },
  predicted_probability: {
    label: "predicted_probability",
    unit: "%",
  },
  vacant_house_id: {
    label: "vacant_house_id",
  },
  vacant_house_address: {
    label: "vacant_house_address",
  },
  vacant_house_longitude: {
    label: "vacant_house_longitude",
  },
  vacant_house_latitude: {
    label: "vacant_house_latitude",
  },
  vacant_house_source_info: {
    label: "vacant_house_source_info",
  },
  geocoded_address: {
    label: "geocoded_address",
  },
  geocoded_latitude: {
    label: "geocoded_latitude",
  },
  geocoded_longitude: {
    label: "geocoded_longitude",
  },
  geocoding_source_info: {
    label: "geocoding_source_info",
  },
  has_water_supply: {
    label: "has_water_supply",
  },
  has_juki_registry: {
    label: "has_juki_registry",
  },
  has_touki_registry: {
    label: "has_touki_registry",
  },
  has_juki_and_water: {
    label: "has_juki_and_water",
  },
  has_vacant_result: {
    label: "has_vacant_result",
  },
  has_juki_water_property: {
    label: "has_juki_water_property",
  },
  has_geocoding: {
    label: "has_geocoding",
  },
  has_juki_water_property_vacant: {
    label: "has_juki_water_property_vacant",
  },
  // index_right: {
  //   label: "index_right",
  // },
  created_at: {
    label: "created_at",
  },
  updated_at: {
    label: "updated_at",
  },
};

const areaMetadata: Record<keyof SelectDataSetDetailArea, Item> = {
  id: {
    label: "id",
  },
  data_set_result_id: {
    label: "data_set_result_id",
  },
  reference_date: {
    label: "推定日",
    unit: "",
  },
  area_group: {
    label: "地域区分",
    unit: "",
  },
  young_population_ratio: {
    label: "若年層率",
    unit: "%",
  },
  elderly_population_ratio: {
    label: "高齢者率",
    unit: "%",
  },
  total_building_count: {
    label: "建物数",
    unit: "件",
  },
  vacant_house_count: {
    label: "空き家件数",
    unit: "件",
  },
  area: {
    label: "面積",
    unit: "m²",
  },
  geometry: {
    label: "ジオメトリ",
    unit: "",
  },
  key_code: {
    label: "KEYCODE",
    unit: "",
  },
  predicted_probability: {
    label: "空き家推定確率",
    unit: "%",
  },
  created_at: {
    label: "created_at",
    unit: "",
  },
  updated_at: {
    label: "updated_at",
    unit: "",
  },
};

export const ResultDataSetMetadata = {
  ...buildingMetadata,
  ...areaMetadata,
};
