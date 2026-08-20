import { type TileViewFieldOption } from "../types";
import {
  type AREA_DATASET_COLUMN,
  type BUILDING_DATASET_COLUMN,
} from "../../../shared/config/column-metadata";
import { type VIEW_STYLES } from "../../../shared/config/view-styles";

/**
 * フィルターカラムのカテゴリ定義
 * 順序はこの配列の順序で表示される
 * カラムの追加・削除・並び替えはこの定義を変更するだけで対応可能
 */
export const FILTER_COLUMN_CATEGORIES: {
  building: { name: string; columns: BUILDING_DATASET_COLUMN[] }[];
  area: { name: string; columns: AREA_DATASET_COLUMN[] }[];
} = {
  building: [
    {
      name: "空き家判定",
      columns: [
        "predicted_probability",
        "predicted_probability_change_rate_from_oldest",
        "predicted_probability_change_rate_from_previous",
        "predicted_label",
        "is_vacant",
        "reference_date",
      ],
    },
    {
      name: "基本情報",
      columns: [
        "normalized_address",
        "area_group",
        "building_type",
        "has_juki_registry",
        "buildingtype_determination_not_possible_flag",
        "residence_duration",
        "registration_date",
      ],
    },
    {
      name: "居住状況（世帯）",
      columns: [
        "household_size",
        "members_under_15",
        "members_over_65",
        "max_age",
        "num_deaths",
        "num_inmigrants",
        "num_outmigrants_relocations",
        "num_cancellations",
      ],
    },
    {
      name: "居住状況（水道）",
      columns: [
        "water_disconnection_flag",
        "max_water_usage",
        "avg_water_usage",
        "total_water_usage",
        "water_startdate",
        "water_enddate",
        "years_water_closure",
        "average_waterusage_person",
        "change_rate_waterusage_over_last4months",
        "flag_zero_usage_over4consecutivemonths",
        "waterusage_11to12m_ago",
        "waterusage_9to10m_ago",
        "waterusage_7to8m_ago",
        "waterusage_5to6m_ago",
        "waterusage_3to4m_ago",
        "waterusage_1to2m_ago",
        "has_usage_data",
        "num_zero_periods",
        "min_water_usage",
        "usage_data_unavailable_flag",
        "usage_first_half_avg",
        "usage_second_half_avg",
        "usage_half_year_change_rate",
        "recent_usage_avg",
      ],
    },
    {
      name: "居住状況（住基イベント）",
      columns: [
        "max_age_juki_residence_isnull",
        "has_cancellation_event",
        "num_outmigrant_events",
        "years_since_last_transfer",
        "years_since_last_transfer_is_missing",
        "sole_elderly_resident",
        "death_no_replacement",
        "household_shrinkage_rate",
      ],
    },
    {
      name: "複合スコア",
      columns: ["composite_rule_score"],
    },
    {
      name: "建物状態",
      columns: [
        "structure_name",
        "measured_height",
        "storeys_above_ground",
        "flag_concreteblock",
        "flag_brick",
        "flag_reinforcedconcreteconstruction",
        "flag_steelframe",
        "flag_wood",
        "flag_earthen",
        "flag_otherstructures",
      ],
    },
    {
      name: "リスク評価",
      columns: [
        "inland_flooding_risk_depth",
        "river_flooding_risk_depth",
        "river_flooding_risk_description",
        "hightide_risk_depth",
        "landslide_risk_areatype",
        "tsunami_risk_depth",
      ],
    },
    {
      name: "所有権・登記",
      columns: [
        "building_age_years",
        "years_since_inheritance",
        "years_since_extension",
      ],
    },
  ],
  area: [
    {
      name: "空き家推定",
      columns: ["predicted_probability", "vacant_house_count"],
    },
    {
      name: "地域情報",
      columns: [
        "area_group",
        "area",
        "total_building_count",
        "young_population_ratio",
        "elderly_population_ratio",
      ],
    },
  ],
};

const TABLE_FIELDS: TileViewFieldOption[] = [
  {
    key: "columns",
    label: "カラム",
    type: "dialog",
    option: [
      // 建物単位（building）
      { unit: "building", value: "household_size" },
      { unit: "building", value: "normalized_address" },
      { unit: "building", value: "area_group" },
      { unit: "building", value: "reference_date" },
      { unit: "building", value: "members_under_15" },
      { unit: "building", value: "members_over_65" },
      { unit: "building", value: "water_disconnection_flag" },
      { unit: "building", value: "max_water_usage" },
      { unit: "building", value: "avg_water_usage" },
      { unit: "building", value: "total_water_usage" },
      { unit: "building", value: "structure_name" },
      { unit: "building", value: "predicted_probability" },
      {
        unit: "building",
        value: "predicted_probability_change_rate_from_oldest",
      },
      {
        unit: "building",
        value: "predicted_probability_change_rate_from_previous",
      },
      { unit: "building", value: "measured_height" },
      { unit: "building", value: "inland_flooding_risk_depth" },
      { unit: "building", value: "river_flooding_risk_depth" },
      { unit: "building", value: "river_flooding_risk_description" },
      {
        unit: "building",
        value: "buildingtype_determination_not_possible_flag",
      },
      { unit: "building", value: "residence_duration" },
      { unit: "building", value: "has_juki_registry" },
      { unit: "building", value: "building_type" },
      { unit: "building", value: "registration_date" },
      { unit: "building", value: "building_age_years" },
      { unit: "building", value: "years_since_inheritance" },
      { unit: "building", value: "years_since_extension" },
      { unit: "building", value: "waterusage_11to12m_ago" },
      { unit: "building", value: "waterusage_9to10m_ago" },
      { unit: "building", value: "waterusage_7to8m_ago" },
      { unit: "building", value: "waterusage_5to6m_ago" },
      { unit: "building", value: "waterusage_3to4m_ago" },
      { unit: "building", value: "waterusage_1to2m_ago" },
      // 追加カラム（建物単位）
      { unit: "building", value: "hightide_risk_depth" },
      { unit: "building", value: "landslide_risk_areatype" },
      { unit: "building", value: "tsunami_risk_depth" },
      { unit: "building", value: "storeys_above_ground" },
      { unit: "building", value: "max_age" },
      { unit: "building", value: "num_deaths" },
      { unit: "building", value: "num_inmigrants" },
      { unit: "building", value: "num_outmigrants_relocations" },
      { unit: "building", value: "num_cancellations" },
      { unit: "building", value: "water_startdate" },
      { unit: "building", value: "water_enddate" },
      { unit: "building", value: "years_water_closure" },
      { unit: "building", value: "average_waterusage_person" },
      { unit: "building", value: "change_rate_waterusage_over_last4months" },
      { unit: "building", value: "flag_zero_usage_over4consecutivemonths" },
      { unit: "building", value: "flag_concreteblock" },
      { unit: "building", value: "flag_brick" },
      { unit: "building", value: "flag_reinforcedconcreteconstruction" },
      { unit: "building", value: "flag_steelframe" },
      { unit: "building", value: "flag_wood" },
      { unit: "building", value: "flag_earthen" },
      { unit: "building", value: "flag_otherstructures" },
      { unit: "building", value: "predicted_label" },
      { unit: "building", value: "is_vacant" },
      // 空き家調査結果の付随情報（is_vacant=1 の行のみ値を持つ）
      { unit: "building", value: "vacant_type" },
      { unit: "building", value: "vacant_source" },
      { unit: "building", value: "vacant_year" },
      { unit: "building", value: "address_precision_flag" },
      // 水道時系列特徴量
      { unit: "building", value: "has_usage_data" },
      { unit: "building", value: "num_zero_periods" },
      { unit: "building", value: "min_water_usage" },
      { unit: "building", value: "usage_data_unavailable_flag" },
      { unit: "building", value: "usage_first_half_avg" },
      { unit: "building", value: "usage_second_half_avg" },
      { unit: "building", value: "usage_half_year_change_rate" },
      { unit: "building", value: "recent_usage_avg" },
      // 住基イベント特徴量
      { unit: "building", value: "max_age_juki_residence_isnull" },
      { unit: "building", value: "has_cancellation_event" },
      { unit: "building", value: "num_outmigrant_events" },
      { unit: "building", value: "years_since_last_transfer" },
      { unit: "building", value: "years_since_last_transfer_is_missing" },
      { unit: "building", value: "sole_elderly_resident" },
      { unit: "building", value: "death_no_replacement" },
      { unit: "building", value: "household_shrinkage_rate" },
      // 交差・ルール特徴量
      { unit: "building", value: "composite_rule_score" },
      // 地域単位（area）
      { unit: "area", value: "area" },
      { unit: "area", value: "area_group" },
      { unit: "area", value: "young_population_ratio" },
      { unit: "area", value: "elderly_population_ratio" },
      { unit: "area", value: "total_building_count" },
      { unit: "area", value: "vacant_house_count" },
      { unit: "area", value: "predicted_probability" },
    ],
    multiple: true,
    grouping: false,
  },
];

/**
 * 各チャートのパラーメーターやグルーピング可能かどうかなどの設定のうち、データセットの状態に依存しない設定を定義
 * 永続化の必要がない（＝エンドユーザーが変更しない）点、
 * JSONで記述するよりも型補完が効く点を踏まえ柔軟にコードができるためにTypeScriptで記述した
 */
export const TILE_VIEW_CONFIG = {
  // チャートスタイルごとにコンフィグを定義
  pie: {
    fields: [
      // fieldsはパラメーターやフィルターの設定を行う
      {
        key: "label", // フィールドのキー(DBのparametersのkeyに対応)
        label: "ラベル", // フィールドのラベル、DBには保存せずkeyから引く形をとる
        type: "select", // フィールドの入力方法を指定
        option: [
          // ドロップダウンやセレクトボックスの選択肢を指定
          { unit: "building", value: "predicted_probability" },
          { unit: "building", value: "predicted_label" },
          { unit: "building", value: "household_size" },
          { unit: "building", value: "members_under_15" },
          { unit: "building", value: "members_over_65" },
          { unit: "building", value: "measured_height" },
          { unit: "building", value: "inland_flooding_risk_depth" },
          { unit: "building", value: "river_flooding_risk_depth" },
        ],
        grouping: true,
      },
      {
        key: "value",
        label: "値",
        type: "select",
        option: [
          { unit: "building", value: "predicted_probability" },
          { unit: "building", value: "predicted_label" },
          { unit: "building", value: "household_size" },
          { unit: "building", value: "members_under_15" },
          { unit: "building", value: "members_over_65" },
          { unit: "building", value: "measured_height" },
          { unit: "building", value: "inland_flooding_risk_depth" },
          { unit: "building", value: "river_flooding_risk_depth" },
        ],
        grouping: false,
      },
    ],
  },
  bar: {
    fields: [
      {
        key: "xAxis",
        label: "X軸",
        type: "select",
        option: [{ unit: "area", value: "area_group" }],
        grouping: true,
      },
      {
        key: "yAxis",
        label: "Y軸",
        type: "select",
        option: [
          { unit: "area", value: "predicted_probability" },
          { unit: "area", value: "young_population_ratio" },
          { unit: "area", value: "elderly_population_ratio" },
          { unit: "area", value: "vacant_house_count" },
        ],
        grouping: false,
      },
    ],
  },
  line: {
    fields: [
      {
        key: "xAxis",
        label: "X軸",
        type: "select",
        option: [
          {
            unit: "building",
            value: "reference_date",
          },
        ],
        grouping: true,
      },
      {
        key: "yAxis",
        label: "Y軸",
        type: "select",
        option: [
          { unit: "building", value: "predicted_probability" },
          { unit: "building", value: "predicted_label" },
          { unit: "building", value: "household_size" },
          { unit: "building", value: "members_under_15" },
          { unit: "building", value: "members_over_65" },
        ],
        grouping: false,
      },
    ],
  },
  table: {
    fields: TABLE_FIELDS,
  },
  "map-with-table": {
    fields: TABLE_FIELDS,
  },
} satisfies {
  [k in (typeof VIEW_STYLES)[number]]: {
    fields: TileViewFieldOption[];
  };
};

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("TILE_VIEW_CONFIGのカラムに重複がないかの型チェック", () => {
    it("円グラフのケース", () => {
      const fields = TILE_VIEW_CONFIG.pie.fields;

      for (const field of fields) {
        const buildingOptionValues = field.option
          .filter((option) => option.unit === "building")
          .map((option) => option.value);

        expect(buildingOptionValues).toEqual(
          Array.from(new Set(buildingOptionValues)),
        );
      }
    });

    it("棒グラフのケース", () => {
      const fields = TILE_VIEW_CONFIG.bar.fields;

      for (const field of fields) {
        const buildingOptionValues = field.option
          .filter((option) => option.unit === "area") // 棒グラフの場合は集計単位を地域に固定する
          .map((option) => option.value);

        expect(buildingOptionValues).toEqual(
          Array.from(new Set(buildingOptionValues)),
        );
      }
    });

    it("折れ線グラフのケース", () => {
      const fields = TILE_VIEW_CONFIG.line.fields;

      for (const field of fields) {
        const buildingOptionValues = field.option
          .filter((option) => option.unit === "building")
          .map((option) => option.value);

        expect(buildingOptionValues).toEqual(
          Array.from(new Set(buildingOptionValues)),
        );
      }
    });

    it("表形式のケース", () => {
      const fields = TILE_VIEW_CONFIG.table.fields;

      for (const field of fields) {
        const buildingOptionValues = field.option
          .filter((option) => option.unit === "building")
          .map((option) => option.value);

        const areaOptionValues = field.option
          .filter((option) => option.unit === "area")
          .map((option) => option.value);

        expect(buildingOptionValues).toEqual(
          Array.from(new Set(buildingOptionValues)),
        );
        expect(areaOptionValues).toEqual(Array.from(new Set(areaOptionValues)));
      }
    });
  });
}
