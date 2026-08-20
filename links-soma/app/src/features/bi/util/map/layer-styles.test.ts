import { describe, expect, it } from "vitest";
import {
  CHANGE_RATE_BOUND,
  LAYER_COLORS,
  getChangeRateColor,
  getProbabilityColor,
  getGradientStops,
} from "./layer-styles";

describe("getChangeRateColor", () => {
  it("算出対象外（null）はデータなしのグレー", () => {
    expect(getChangeRateColor(null)).toBe(LAYER_COLORS.GRAY);
  });

  it("横ばい（0）は中間色", () => {
    expect(getChangeRateColor(0)).toBe(LAYER_COLORS.UNCHANGED);
  });

  it("境界以上の増加は赤で振り切れる", () => {
    expect(getChangeRateColor(CHANGE_RATE_BOUND)).toBe(LAYER_COLORS.RED);
    expect(getChangeRateColor(CHANGE_RATE_BOUND * 10)).toBe(LAYER_COLORS.RED);
  });

  it("境界以下の減少は青で振り切れる", () => {
    expect(getChangeRateColor(-CHANGE_RATE_BOUND)).toBe(LAYER_COLORS.DECREASE);
    expect(getChangeRateColor(-CHANGE_RATE_BOUND * 10)).toBe(
      LAYER_COLORS.DECREASE,
    );
  });

  it("増加と減少は異なる色になる（確率配色では両方が緑に潰れる値域）", () => {
    const increased = getChangeRateColor(0.5);
    const decreased = getChangeRateColor(-0.5);
    expect(increased).not.toBe(decreased);
  });

  it("境界内の値は中間色とも端色とも異なる補間色になる", () => {
    const half = CHANGE_RATE_BOUND / 2;
    const increased = getChangeRateColor(half);
    const decreased = getChangeRateColor(-half);

    for (const color of [increased, decreased]) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(color).not.toBe(LAYER_COLORS.UNCHANGED);
    }
    expect(increased).not.toBe(LAYER_COLORS.RED);
    expect(decreased).not.toBe(LAYER_COLORS.DECREASE);
    // 増加側は赤へ、減少側は青へ寄る（from/to の取り違えを検出する）
    expect(increased).not.toBe(decreased);
  });

  it("同じ向きでは絶対値が大きいほど端色へ近づく", () => {
    const near = getChangeRateColor(CHANGE_RATE_BOUND * 0.25);
    const far = getChangeRateColor(CHANGE_RATE_BOUND * 0.75);
    expect(near).not.toBe(far);

    const redness = (hex: string): number =>
      parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);
    expect(redness(far)).toBeGreaterThan(redness(near));
  });

  it("数値でない入力（undefined / NaN）はデータなしのグレー", () => {
    expect(getChangeRateColor(undefined)).toBe(LAYER_COLORS.GRAY);
    expect(getChangeRateColor(Number.NaN)).toBe(LAYER_COLORS.GRAY);
  });

  it("負の値が確率配色では区別できないことを確認する（本実装の存在理由）", () => {
    const stops = getGradientStops(1);
    expect(getProbabilityColor(-0.5, stops)).toBe(
      getProbabilityColor(-0.01, stops),
    );
  });
});
