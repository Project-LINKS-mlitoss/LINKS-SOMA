import { type ChartColumnType } from "../@types/charts";
import {
  type SelectDataSetDetailArea,
  type SelectDataSetDetailBuilding,
} from "../schema";

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
>;

// 選択基準: https://www.notion.so/eukarya/a46c46fe1b9e4261b81c6c0a8df87189
export type BUILDING_DATASET_COLUMN = keyof Pick<
  SelectDataSetDetailBuilding,
  | "area_group"
  | "reference_date"
  | "normalized_address"
  | "household_code"
  | "household_size"
  | "members_under_15"
  | "percentage_under_15"
  | "members_15_to_64"
  | "percentage_15_to_64"
  | "members_over_65"
  | "percentage_over_65"
  | "gender_ratio"
  | "water_supply_number"
  | "water_disconnection_flag"
  | "max_water_usage"
  | "avg_water_usage"
  | "min_water_usage"
  | "total_water_usage"
  | "water_supply_source_info"
  | "structure_name"
  | "registration_date"
  | "registration_source_info"
  | "duration"
  | "measuredheight"
  | "rank"
  | "depth"
  | "floors_above_ground"
  | "floors_below_ground"
  | "inland_flooding_risk_rank"
  | "inland_flooding_risk_depth"
  | "name"
  | "river_flooding_risk_desc"
  | "river_flooding_risk_rank"
  | "river_flooding_risk_depth"
  | "landslide_risk_desc"
  | "vacant_house_id"
  | "vacant_house_address"
  | "predicted_probability"
  | "predicted_label"
>;

export type ColumnMetadataValue = {
  label: string;
  type: ChartColumnType;
  unit?: string;
  groupable?: boolean; // グルーピング可能かどうか
  description?: string;
};
export type ColumnMetadata<COLUMN extends string | number | symbol> = {
  [k in COLUMN]: ColumnMetadataValue;
};

/**
 * D903のカラムごとのメタデータをハードコード
 * ここでの設定は、チャートの表示やグルーピングの際に利用される
 *
 * 日本語名称との対応は以下のスプレッドシートを正とすること
 * https://docs.google.com/spreadsheets/d/1j5gg41D2D82zFKPna7O18lQETGPCLtpp/edit?gid=1663205080#gid=1663205080
 */
export const AREA_DATASET_COLUMN_METADATA: ColumnMetadata<AREA_DATASET_COLUMN> =
  {
    area: {
      label: "地域面積",
      type: "float",
      groupable: true,
      unit: "m^2",
      description: "地域集計用データにおける地域ごとの面積",
    },
    area_group: {
      label: "地域名称",
      type: "text",
      groupable: true,
      unit: "",
      description:
        "地域集計用データに入力したデータに基づき、当該建物が属する地域の名称",
    },
    young_population_ratio: {
      label: "若年層率（15歳以下人口）",
      type: "float",
      groupable: true,
      unit: "%",
      description:
        "地域単位における、推定日時点で15歳未満（生年月日から算出）となる人口の割合",
    },
    elderly_population_ratio: {
      label: "高齢者率（65歳以上人口）",
      type: "float",
      groupable: true,
      unit: "%",
      description:
        "地域単位における、推定日時点で65歳以上（生年月日から算出）となる人口の割合",
    },
    total_building_count: {
      label: "住宅数",
      type: "integer",
      groupable: true,
      unit: "棟",
      description: "地域単位における、住民基本台帳上の戸建て住宅の数",
    },
    predicted_probability: {
      label: "推定空き家割合",
      type: "float",
      groupable: true,
      unit: "%",
      description: "地域単位において、地域内の住宅数に占める推定空き家数の割合",
    },
    vacant_house_count: {
      label: "推定空き家数",
      type: "integer",
      groupable: true,
      unit: "棟",
      description: `地域単位において、地域内の建物ごとの空き家推定結果を集計した結果
※空き家推定結果：空き家推定の結果、「空き家かどうか」を「モデル構築」の際のしきい値（高度な設定）を基準に判定したフラグ。非空き家は「0」、空き家は「1」で示す。デフォルトの設定では空き家推定確率30%以上（しきい値：0.3）を空き家として判定。`,
    },
  };

/**
 * D902のカラムごとのメタデータをハードコード
 * ここでの設定は、チャートの表示やグルーピングの際に利用される
 *
 * 日本語名称との対応は以下のスプレッドシートを正とすること
 * https://docs.google.com/spreadsheets/d/1j5gg41D2D82zFKPna7O18lQETGPCLtpp/edit?gid=1663205080#gid=1663205080
 */
export const BUILDING_DATASET_COLUMN_METADATA: ColumnMetadata<BUILDING_DATASET_COLUMN> =
  {
    area_group: {
      label: "地域名称",
      type: "text",
      groupable: true,
      unit: "",
      description:
        "地域集計用データに入力したデータに基づき、当該建物が属する地域の名称",
    },
    normalized_address: {
      label: "正規化住所",
      type: "text",
      groupable: true,
      unit: "",
      description:
        "住民基本台帳の住所を「名寄せ処理」において正規化した住所データ",
    },
    household_code: {
      label: "世帯コード",
      type: "text",
      groupable: true,
      unit: "",
      description: "住民基本台帳データに記載された世帯を示す番号やID",
    },
    reference_date: {
      label: "推定日",
      type: "date",
      groupable: true,
      unit: "",
      description:
        "モデル構築および空き家推定における基準とする年月日。「名寄せ処理」において設定した推定日（推定したい日付）を示す。",
    },
    household_size: {
      label: "世帯人数",
      type: "integer",
      groupable: true,
      unit: "人",
      description: "住民基本台帳における同一世帯番号の人数",
    },
    members_under_15: {
      label: "15歳未満人数",
      type: "integer",
      groupable: true,
      unit: "人",
      description:
        "推定日時点で15歳未満（生年月日から算出）となる同一世帯番号の人数",
    },
    members_15_to_64: {
      label: "15歳以上64歳以下人数",
      type: "integer",
      groupable: true,
      unit: "人",
      description:
        "推定日時点で15歳以上64歳以下（生年月日から算出）となる同一世帯番号の人数",
    },
    percentage_under_15: {
      label: "15歳未満構成比",
      type: "float",
      groupable: true,
      unit: "%",
      description:
        "推定日時点で15歳未満（生年月日から算出）となる同一世帯番号の人数が世帯人数に占める比率",
    },
    percentage_15_to_64: {
      label: "15歳以上64歳以下構成比",
      type: "float",
      groupable: true,
      unit: "%",
      description:
        "推定日時点で15歳以上64歳以下（生年月日から算出）となる同一世帯番号の人数が世帯人数に占める比率",
    },
    members_over_65: {
      label: "65歳以上人数",
      type: "integer",
      groupable: true,
      unit: "人",
      description:
        "推定日時点で65歳以上（生年月日から算出）となる同一世帯番号の人数",
    },
    percentage_over_65: {
      label: "65歳以上構成比",
      type: "float",
      groupable: true,
      unit: "%",
      description:
        "推定日時点で65歳以上（生年月日から算出）となる同一世帯番号の人数が世帯人数に占める比率",
    },
    predicted_probability: {
      label: "空き家推定確率",
      type: "float",
      groupable: true,
      unit: "%",
      description:
        "空き家の推定確率を示す。0～1の間で確率が示され、1に近いほど空き家である確率が高い。",
    },
    predicted_label: {
      label: "空き家推定結果",
      type: "boolean",
      groupable: true,
      unit: "",
      description:
        "空き家推定の結果、「空き家かどうか」を「モデル構築」の際のしきい値（高度な設定）を基準に判定したフラグ。非空き家は「0」、空き家は「1」で示す。デフォルトの設定では空き家推定確率30%以上（しきい値：0.3）を空き家として判定。",
    },
    gender_ratio: {
      label: "男女比",
      type: "float",
      groupable: true,
      unit: "",
      description: "世帯人数に占める男女の比率（女性の人数／世帯人数で算出）",
    },
    water_disconnection_flag: {
      label: "閉栓フラグ",
      type: "boolean",
      groupable: true,
      unit: "",
      description:
        "水道開閉栓状況データに記載された、閉栓かどうかを示すのフラグ",
    },
    max_water_usage: {
      label: "最大使用水量",
      type: "integer",
      groupable: true,
      unit: "L",
      description:
        "推定日から１年以内において水道使用量が最大の月の水道使用量（検針周期により２か月単位の量）",
    },
    avg_water_usage: {
      label: "平均使用水量",
      type: "integer",
      groupable: true,
      unit: "L",
      description:
        "推定日から１年以内における月の平均水道使用量（検針周期により２か月単位の量）",
    },
    min_water_usage: {
      label: "最小使用水量",
      type: "integer",
      groupable: true,
      unit: "L",
      description:
        "推定日から１年以内において水道使用量が最小の月の水道使用量（検針周期により２か月単位の量）",
    },
    total_water_usage: {
      label: "合計使用水量",
      type: "integer",
      groupable: true,
      unit: "L",
      description:
        "推定日から１年以内における合計水道使用量（検針周期により２か月単位の量）",
    },
    water_supply_number: {
      label: "水道番号",
      type: "text",
      groupable: true,
      unit: "",
      description:
        "水道開閉栓状況データおよび水道使用量データに記載された、検針対象者を示す番号やID",
    },
    water_supply_source_info: {
      label: "水道名寄せ元情報",
      type: "text",
      groupable: true,
      unit: "",
      description:
        "水道開閉栓状況データの住所を「名寄せ処理」において正規化した住所データ",
    },
    structure_name: {
      label: "構造名称",
      type: "text",
      groupable: true,
      unit: "",
      description: "建物情報データに記載された建物構造",
    },
    registration_date: {
      label: "登記日付",
      type: "date",
      groupable: true,
      unit: "",
      description: "建物情報データに記載された登記日付",
    },
    registration_source_info: {
      label: "登記名寄せ元情報",
      type: "text",
      groupable: true,
      unit: "",
      description:
        "建物情報データの住所を「名寄せ処理」において正規化した住所データ",
    },
    vacant_house_id: {
      label: "空き家調査ID",
      type: "text",
      groupable: true,
      unit: "",
      description: "空き家調査が行われた対象住所のユニークID",
    },
    vacant_house_address: {
      label: "空き家調査住所",
      type: "text",
      groupable: true,
      unit: "",
      description: "空き家調査結果データに記載された空き家の住所",
    },

    measuredheight: {
      label: "標高",
      type: "integer",
      groupable: true,
      unit: "m",
      description: "PLATEAUの建物モデルデータに含まれる、計測高さ",
    },
    rank: {
      label: "洪水浸水想定区域　浸水ランク",
      type: "integer",
      groupable: true,
      unit: "",
      description:
        "PLATEAUの建物モデルデータに含まれる、洪水浸水想定区域　浸水ランク",
    },
    depth: {
      label: "洪水浸水想定区域　浸水深",
      type: "integer",
      groupable: true,
      unit: "m",
      description:
        "PLATEAUの建物モデルデータに含まれる、洪水浸水想定区域　浸水深",
    },
    duration: {
      label: "洪水浸水想定区域　継続時間",
      type: "integer",
      groupable: true,
      unit: "時間",
      description:
        "PLATEAUの建物モデルデータに含まれる、洪水浸水想定区域　継続時間",
    },
    floors_above_ground: {
      label: "地上階数",
      type: "integer",
      groupable: true,
      unit: "階",
      description: "PLATEAUの建物モデルデータに含まれる、地上階数",
    },
    name: {
      label: "名称",
      type: "text",
      groupable: true,
      unit: "",
      description: "PLATEAUの建物モデルデータに含まれる、名称",
    },
    floors_below_ground: {
      label: "地下階数",
      type: "integer",
      groupable: true,
      unit: "階",
      description: "PLATEAUの建物モデルデータに含まれる、地下階数",
    },
    inland_flooding_risk_rank: {
      label: "内水浸水リスクランク",
      type: "integer",
      groupable: true,
      unit: "",
    },
    inland_flooding_risk_depth: {
      label: "内水氾濫リスク深さ",
      type: "integer",
      groupable: true,
      unit: "m",
      description: "PLATEAUの建物モデルデータに含まれる、内水浸水リスクランク",
    },
    landslide_risk_desc: {
      label: "土砂災害リスク　現象区分",
      type: "text",
      groupable: true,
      unit: "",
      description:
        "PLATEAUの建物モデルデータに含まれる、土砂災害リスク　現象区分",
    },
    river_flooding_risk_desc: {
      label: "指定河川名称",
      type: "text",
      groupable: true,
      unit: "",
      description: "PLATEAUの建物モデルデータに含まれる、指定河川名称",
    },
    river_flooding_risk_rank: {
      label: "浸水ランク",
      type: "integer",
      groupable: true,
      unit: "",
      description: "PLATEAUの建物モデルデータに含まれる、浸水ランク",
    },
    river_flooding_risk_depth: {
      label: "浸水深",
      type: "integer",
      groupable: true,
      unit: "m",
      description: "PLATEAUの建物モデルデータに含まれる、浸水深",
    },
  };
