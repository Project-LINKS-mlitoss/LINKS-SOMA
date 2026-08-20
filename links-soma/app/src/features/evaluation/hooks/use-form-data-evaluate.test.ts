import { describe, expect } from "vitest";
import { schema, withAreaGroupingRequired } from "./use-form-data-evaluate";

const valid = {
  model_path: "model.zip",
  normalized_dataset_paths: ["normalized.csv"],
  settings: { threshold: 0.45 },
  area_grouping: {
    path: "area.csv",
    columns: { area_group_id: "id", area_group_name: "name" },
  },
};

describe("evaluation schema（推定の必須入力を送信で止める）", (it) => {
  it("必須が揃えば成功", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("モデル未選択は失敗", () => {
    expect(schema.safeParse({ ...valid, model_path: "" }).success).toBe(false);
  });

  it("分析対象データセット0件は失敗", () => {
    expect(
      schema.safeParse({ ...valid, normalized_dataset_paths: [] }).success,
    ).toBe(false);
  });

  // area_grouping はジオメトリ源を持つデータでのみ表示・必須化する（issue #1924）。
  // base schema は非表示ケースのため path 空を許容し、表示時は withAreaGroupingRequired が必須化する。
  it("地域集計用データ未選択は base schema では許容（非表示ケース）", () => {
    expect(
      schema.safeParse({
        ...valid,
        area_grouping: { ...valid.area_grouping, path: "" },
      }).success,
    ).toBe(true);
  });

  it("地域集計用データ未選択は withAreaGroupingRequired で失敗（表示時は必須）", () => {
    expect(
      withAreaGroupingRequired.safeParse({
        ...valid,
        area_grouping: { ...valid.area_grouping, path: "" },
      }).success,
    ).toBe(false);
  });

  it("必須が揃えば withAreaGroupingRequired でも成功", () => {
    expect(withAreaGroupingRequired.safeParse(valid).success).toBe(true);
  });
});
