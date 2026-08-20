import { describe, expect } from "vitest";
import { schema } from "./use-form-model-create";

const valid = {
  input_path: "normalized.csv",
  settings: {
    explanatory_variables: ["water_usage"],
    advanced: {},
  },
};

describe("model create schema（必須選択を送信で止める）", (it) => {
  it("データセットと説明変数が揃えば成功", () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it("データセット未選択（空文字）は失敗", () => {
    expect(schema.safeParse({ ...valid, input_path: "" }).success).toBe(false);
  });

  it("説明変数0件は失敗", () => {
    expect(
      schema.safeParse({
        ...valid,
        settings: { ...valid.settings, explanatory_variables: [] },
      }).success,
    ).toBe(false);
  });
});
