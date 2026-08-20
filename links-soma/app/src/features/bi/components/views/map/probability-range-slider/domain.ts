/** building は確率 0〜1 を全域表示 */
export const BUILDING_DOMAIN_MAX = 1;

/** スライダーの目盛り範囲 [min, max] */
export type SliderDomain = { min: number; max: number };

/**
 * 変化率スライダーの目盛り範囲。凡例の振り切れ境界（±CHANGE_RATE_BOUND）と一致させる。
 *
 * 確率と違い変化率は上限を持たない（下限は -1）。端は確率と同じく無制限扱いのため、
 * 境界を超える建物（例: +80%）も全域では表示され、絞り込んだときだけ範囲外になる。
 */
export const changeRateDomain = (bound: number): SliderDomain => ({
  min: -bound,
  max: bound,
});

/** area の目盛りはデータ最大値を 5% 刻みで切り上げた値にする */
const AREA_DOMAIN_STEP = 0.05;

/** area のデータ最大値が取得できないときのフォールバック上限 */
const AREA_DOMAIN_FALLBACK = 0.2;

/**
 * area スライダーの目盛り上限を、データ最大値から決める。
 * 割合は building と違い上限が一定でないため、最大値を 5% 刻みで切り上げる（1.0 で頭打ち）。
 * 取得失敗（null・0以下）はフォールバック値を返す。
 */
export const roundUpAreaDomain = (maxValue: number | null): number => {
  if (maxValue === null || maxValue <= 0) return AREA_DOMAIN_FALLBACK;
  return Math.min(1, Math.ceil(maxValue / AREA_DOMAIN_STEP) * AREA_DOMAIN_STEP);
};
