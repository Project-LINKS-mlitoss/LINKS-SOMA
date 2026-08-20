import { describe, expect, it } from "vitest";
import { CHANGE_RATE_BOUND } from "../../../../util/map/layer-styles";
import {
  BUILDING_DOMAIN_MAX,
  changeRateDomain,
  roundUpAreaDomain,
} from "./domain";

describe("changeRateDomain", () => {
  it("負の下限を持つ（確率スライダーでは減少を選べない）", () => {
    const domain = changeRateDomain(CHANGE_RATE_BOUND);
    expect(domain.min).toBeLessThan(0);
    expect(BUILDING_DOMAIN_MAX).toBeGreaterThan(0);
  });

  it("凡例の振り切れ境界と一致する（減少 -50% 以下 / 増加 50% 以上）", () => {
    const domain = changeRateDomain(CHANGE_RATE_BOUND);
    expect(domain.min).toBe(-CHANGE_RATE_BOUND);
    expect(domain.max).toBe(CHANGE_RATE_BOUND);
  });

  it("0 を中心に対称になる（増加と減少を同じ幅で選べる）", () => {
    const domain = changeRateDomain(CHANGE_RATE_BOUND);
    expect(domain.min + domain.max).toBe(0);
  });

  it("刻みは全幅の1/100（確率と同じ操作感）", () => {
    const domain = changeRateDomain(CHANGE_RATE_BOUND);
    const step = (domain.max - domain.min) / 100;
    expect(step).toBeCloseTo(0.01, 10);
  });
});

describe("roundUpAreaDomain", () => {
  it("データ最大値を5%刻みで切り上げる", () => {
    expect(roundUpAreaDomain(0.11)).toBeCloseTo(0.15, 10);
  });

  it("1.0 で頭打ちになる", () => {
    expect(roundUpAreaDomain(0.99)).toBe(1);
  });

  it("取得失敗（null・0以下）はフォールバック値", () => {
    expect(roundUpAreaDomain(null)).toBe(0.2);
    expect(roundUpAreaDomain(0)).toBe(0.2);
  });
});
