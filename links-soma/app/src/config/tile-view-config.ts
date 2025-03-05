import { type TileViewFieldOption, type TileViewStyle } from "../@types/charts";

/**
 * 各チャートのパラーメーターやグルーピング可能かどうかなどの設定をハードコードで定義している
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
          { unit: "building", value: "members_15_to_64" },
          { unit: "building", value: "percentage_under_15" },
          { unit: "building", value: "members_over_65" },
          { unit: "building", value: "percentage_15_to_64" },
          { unit: "building", value: "percentage_over_65" },
          { unit: "building", value: "duration" },
          { unit: "building", value: "measuredheight" },
          { unit: "building", value: "rank" },
          { unit: "building", value: "depth" },
          { unit: "building", value: "floors_above_ground" },
          { unit: "building", value: "inland_flooding_risk_rank" },
          { unit: "building", value: "inland_flooding_risk_depth" },
          { unit: "building", value: "river_flooding_risk_rank" },
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
          { unit: "building", value: "members_15_to_64" },
          { unit: "building", value: "members_over_65" },
          { unit: "building", value: "percentage_under_15" },
          { unit: "building", value: "percentage_15_to_64" },
          { unit: "building", value: "percentage_over_65" },
          { unit: "building", value: "duration" },
          { unit: "building", value: "measuredheight" },
          { unit: "building", value: "rank" },
          { unit: "building", value: "depth" },
          { unit: "building", value: "floors_above_ground" },
          { unit: "building", value: "inland_flooding_risk_rank" },
          { unit: "building", value: "inland_flooding_risk_depth" },
          { unit: "building", value: "river_flooding_risk_rank" },
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
          { unit: "building", value: "members_15_to_64" },
          { unit: "building", value: "members_over_65" },
          { unit: "building", value: "percentage_15_to_64" },
          { unit: "building", value: "percentage_over_65" },
        ],
        grouping: false,
      },
    ],
  },
  map: {
    fields: [],
  },
  table: {
    fields: [
      {
        key: "columns",
        label: "カラム",
        type: "dialog",
        option: [
          {
            unit: "building",
            value: "household_size",
          },
          {
            unit: "building",
            value: "household_code",
          },
          {
            unit: "building",
            value: "normalized_address",
          },
          {
            unit: "building",
            value: "area_group",
          },
          {
            unit: "building",
            value: "reference_date",
          },
          {
            unit: "building",
            value: "members_under_15",
          },
          {
            unit: "building",
            value: "members_15_to_64",
          },
          {
            unit: "building",
            value: "members_over_65",
          },
          {
            unit: "building",
            value: "percentage_under_15",
          },
          {
            unit: "building",
            value: "percentage_15_to_64",
          },
          {
            unit: "building",
            value: "percentage_over_65",
          },
          {
            unit: "building",
            value: "gender_ratio",
          },
          {
            unit: "building",
            value: "water_supply_number",
          },
          {
            unit: "building",
            value: "water_disconnection_flag",
          },
          {
            unit: "building",
            value: "max_water_usage",
          },
          {
            unit: "building",
            value: "avg_water_usage",
          },
          {
            unit: "building",
            value: "total_water_usage",
          },
          {
            unit: "building",
            value: "min_water_usage",
          },
          {
            unit: "building",
            value: "water_supply_source_info",
          },
          {
            unit: "building",
            value: "structure_name",
          },
          {
            unit: "building",
            value: "registration_date",
          },
          {
            unit: "building",
            value: "registration_source_info",
          },
          {
            unit: "building",
            value: "vacant_house_id",
          },
          {
            unit: "building",
            value: "vacant_house_address",
          },
          {
            unit: "building",
            value: "predicted_probability",
          },
          {
            unit: "building",
            value: "duration",
          },
          {
            unit: "building",
            value: "measuredheight",
          },
          {
            unit: "building",
            value: "rank",
          },
          {
            unit: "building",
            value: "depth",
          },
          {
            unit: "building",
            value: "floors_above_ground",
          },
          {
            unit: "building",
            value: "inland_flooding_risk_rank",
          },
          {
            unit: "building",
            value: "inland_flooding_risk_depth",
          },
          {
            unit: "building",
            value: "landslide_risk_desc",
          },
          {
            unit: "building",
            value: "river_flooding_risk_rank",
          },
          {
            unit: "building",
            value: "river_flooding_risk_depth",
          },
          {
            unit: "building",
            value: "river_flooding_risk_desc",
          },
          {
            unit: "area",
            value: "area",
          },
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
    ],
  },
} satisfies {
  [k in TileViewStyle]: {
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
