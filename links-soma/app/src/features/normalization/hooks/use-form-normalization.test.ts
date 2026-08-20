import { describe, expect } from "vitest";
import { formSchema, schema } from "./use-form-normalization";

// 必須3データセットの path のみ非空、任意データセットの path は空（未選択）。
const base = {
  settings: {
    purpose: "vacancy_estimation",
    reference_date: "2021-01-01",
    municipality: "テスト市",
    advanced: { joining_method: "intersection" },
  },
  data: {
    resident_registry: {
      id: 0,
      path: "juki.csv",
      columns: {
        household_code: "",
        address: "",
        birth_date: "",
        resident_date: "",
        reason_transfer: "",
        date_transfer: "",
      },
    },
    water_status: {
      id: 0,
      path: "water_status.csv",
      columns: {
        water_supply_number: "",
        water_disconnection_date: "",
        water_connection_date: "",
        address: "",
      },
    },
    water_usage: {
      id: 0,
      path: "water_usage.csv",
      columns: {
        water_supply_number: "",
        water_usage: "",
        water_recorded_date: "",
      },
    },
    building_registry: {
      id: 0,
      path: "",
      columns: {
        address: "",
        structure_name: "",
        registration_reason: "",
        registration_date: "",
      },
    },
    building_type_determination: {
      id: 0,
      path: "",
      input_file_type: "csv",
      columns: { address: "", building_type: "" },
      residential_values: [],
    },
    geocoding: {
      id: 0,
      path: "",
      columns: { address: "", latitude: "", longitude: "" },
    },
    building_polygon: {
      id: 0,
      path: "",
      input_file_type: "geopackage",
      data_type: "plateau",
    },
    vacant_house: { id: 0, path: "", columns: { address: "" } },
    optional_data_source: { id: 0, path: "", columns: { address: "" } },
  },
};

const withRequiredPath = (
  key: "resident_registry" | "water_status" | "water_usage",
  path: string,
): unknown => ({
  ...base,
  data: { ...base.data, [key]: { ...base.data[key], path } },
});

describe("normalization schema（必須データセットのファイル選択を止める）", (it) => {
  it("必須3データセットが選択され任意が空でも成功（任意は止めない）", () => {
    expect(schema.safeParse(base).success).toBe(true);
  });

  it("住民基本台帳の未選択は失敗", () => {
    expect(
      schema.safeParse(withRequiredPath("resident_registry", "")).success,
    ).toBe(false);
  });

  it("水道開閉栓の未選択は失敗", () => {
    expect(schema.safeParse(withRequiredPath("water_status", "")).success).toBe(
      false,
    );
  });

  it("水道使用量の未選択は失敗", () => {
    expect(schema.safeParse(withRequiredPath("water_usage", "")).success).toBe(
      false,
    );
  });
});

// ファイルを選んだデータセットは全カラムの割り当てを要求する（`formSchema` のみが持つ制約）。
// 未割り当ては Python 側で rename が空振りし KeyError＝不明エラーになるため送信前に止める。
const assigned = {
  resident_registry: {
    household_code: "世帯コード",
    address: "住所",
    birth_date: "生年月日",
    resident_date: "住定日",
    reason_transfer: "異動事由",
    date_transfer: "異動日",
  },
  water_status: {
    water_supply_number: "水道番号",
    water_disconnection_date: "閉栓日",
    water_connection_date: "開栓日",
    address: "住所",
  },
  water_usage: {
    water_supply_number: "水道番号",
    water_usage: "使用量",
    water_recorded_date: "検針日",
  },
} as const;

/** 必須3データセットのカラムを全て割り当てた、送信可能な状態。 */
const filled = {
  ...base,
  data: {
    ...base.data,
    resident_registry: {
      ...base.data.resident_registry,
      columns: assigned.resident_registry,
    },
    water_status: { ...base.data.water_status, columns: assigned.water_status },
    water_usage: { ...base.data.water_usage, columns: assigned.water_usage },
  },
};

const withDataset = (key: string, dataset: unknown): unknown => ({
  ...filled,
  data: { ...filled.data, [key]: dataset },
});

describe("normalization formSchema（カラム割り当ての欠落を止める）", (it) => {
  it("必須3データセットのカラムが全て割り当て済みなら成功", () => {
    expect(formSchema.safeParse(filled).success).toBe(true);
  });

  it("カラム未割り当てのまま送信は失敗", () => {
    expect(formSchema.safeParse(base).success).toBe(false);
  });

  it("水道使用開始日の未割り当ては失敗（不明エラーの発生源）", () => {
    const result = formSchema.safeParse(
      withDataset("water_status", {
        ...filled.data.water_status,
        columns: { ...assigned.water_status, water_connection_date: "" },
      }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual([
      "data",
      "water_status",
      "columns",
      "water_connection_date",
    ]);
  });

  it("未選択の任意データセットはカラムが空でも成功（添付しなければ要求しない）", () => {
    expect(
      formSchema.safeParse(
        withDataset("geocoding", {
          id: 0,
          path: "",
          columns: { address: "", latitude: "", longitude: "" },
        }),
      ).success,
    ).toBe(true);
  });

  // Python が欠落を許容するカラムは要求しない。要求すると、その列を持たない CSV しか
  // 手元に無い自治体が実行不能になる（画面に割り当てる選択肢が出ないため解消できない）。
  it("世帯番号の未割り当ては成功（juki.py の has_hh ガードで任意）", () => {
    expect(
      formSchema.safeParse(
        withDataset("resident_registry", {
          ...filled.data.resident_registry,
          columns: { ...assigned.resident_registry, household_code: "" },
        }),
      ).success,
    ).toBe(true);
  });

  it("登記の構造名・登記日付の未割り当ては成功（touki.py の .get フォールバックで任意）", () => {
    expect(
      formSchema.safeParse(
        withDataset("building_registry", {
          id: 0,
          path: "touki.csv",
          columns: {
            address: "住所",
            structure_name: "",
            registration_reason: "登記理由",
            registration_date: "",
          },
        }),
      ).success,
    ).toBe(true);
  });

  it("登記の住所・登記理由の未割り当ては失敗（touki.py が無条件参照）", () => {
    expect(
      formSchema.safeParse(
        withDataset("building_registry", {
          id: 0,
          path: "touki.csv",
          columns: {
            address: "",
            structure_name: "構造名称",
            registration_reason: "",
            registration_date: "登記日付",
          },
        }),
      ).success,
    ).toBe(false);
  });

  it("選択した任意データセットのカラム未割り当ては失敗", () => {
    expect(
      formSchema.safeParse(
        withDataset("geocoding", {
          id: 0,
          path: "geo.csv",
          columns: { address: "", latitude: "", longitude: "" },
        }),
      ).success,
    ).toBe(false);
  });

  it("カラムを持たない建物ポリゴンは選択しても成功", () => {
    expect(
      formSchema.safeParse(
        withDataset("building_polygon", {
          id: 0,
          path: "poly.gpkg",
          input_file_type: "geopackage",
          data_type: "plateau",
        }),
      ).success,
    ).toBe(true);
  });

  it("家屋種別が CSV 以外なら住所の未割り当てを要求しない（画面で無効化されるため）", () => {
    expect(
      formSchema.safeParse(
        withDataset("building_type_determination", {
          id: 0,
          path: "type.gpkg",
          input_file_type: "geopackage",
          columns: { address: "", building_type: "家屋種別" },
          residential_values: [],
        }),
      ).success,
    ).toBe(true);
  });

  it("家屋種別が CSV なら住所の未割り当ては失敗", () => {
    expect(
      formSchema.safeParse(
        withDataset("building_type_determination", {
          id: 0,
          path: "type.csv",
          input_file_type: "csv",
          columns: { address: "", building_type: "家屋種別" },
          residential_values: [],
        }),
      ).success,
    ).toBe(false);
  });
});
