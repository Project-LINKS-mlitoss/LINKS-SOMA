import { describe, expect, it } from "vitest";
import { isChangeRateColumn, resolveColorProperty } from "./color-column";

describe("resolveColorProperty", () => {
  it("確率を選ぶと predicted_probability と確率配色を返す", () => {
    expect(resolveColorProperty("probability", "building", undefined)).toEqual({
      propertyName: "predicted_probability",
      metric: "probability",
    });
  });

  it("地域単位で閾値があると閾値別の確率カラムを返す", () => {
    expect(resolveColorProperty("probability", "area", 30)).toEqual({
      propertyName: "predicted_probability_30",
      metric: "probability",
    });
  });

  it("前年度比を選ぶと前年度比カラムと変化率配色を返す", () => {
    expect(
      resolveColorProperty("change-rate-from-previous", "building", undefined),
    ).toEqual({
      propertyName: "predicted_probability_change_rate_from_previous",
      metric: "change-rate",
    });
  });

  it("最古年度比を選ぶと最古年度比カラムと変化率配色を返す", () => {
    expect(
      resolveColorProperty("change-rate-from-oldest", "building", undefined),
    ).toEqual({
      propertyName: "predicted_probability_change_rate_from_oldest",
      metric: "change-rate",
    });
  });

  it("地域単位では変化率を選んでも確率へ落とす（area に変化率カラムが無いため）", () => {
    expect(
      resolveColorProperty("change-rate-from-previous", "area", undefined),
    ).toEqual({
      propertyName: "predicted_probability",
      metric: "probability",
    });
  });
});

describe("isChangeRateColumn", () => {
  it("確率は変化率ではない", () => {
    expect(isChangeRateColumn("probability")).toBe(false);
  });

  it("前年度比・最古年度比は変化率", () => {
    expect(isChangeRateColumn("change-rate-from-previous")).toBe(true);
    expect(isChangeRateColumn("change-rate-from-oldest")).toBe(true);
  });
});
