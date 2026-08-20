import {
  type ThresholdValue,
  getAreaPredictedProbabilityColumn,
} from "../threshold-column-utils";
import { type MapColorMetric } from "./layer-styles";

/**
 * 地図の色分けに使う指標の選択肢。
 * 変化率2種は複数年度の推定結果でのみ値を持つ（単一年度は全行 NULL）。
 */
export const MAP_COLOR_COLUMNS = [
  "probability",
  "change-rate-from-previous",
  "change-rate-from-oldest",
] as const;

export type MapColorColumn = (typeof MAP_COLOR_COLUMNS)[number];

/** 変化率を表す選択肢かどうか。単一年度では選ばせないための判定に使う */
export const isChangeRateColumn = (column: MapColorColumn): boolean =>
  column !== "probability";

/**
 * 色分けの選択肢を、実際に参照するプロパティ名と配色の種類へ解決する。
 *
 * 確率は地域単位で閾値が設定されている場合のみ predicted_probability_XX を使う。
 * 変化率は建物単位にしか列が存在しないため、地域単位では確率へ落とす。
 */
export const resolveColorProperty = (
  column: MapColorColumn,
  unit: "building" | "area",
  threshold: ThresholdValue | undefined,
): { propertyName: string; metric: MapColorMetric } => {
  if (isChangeRateColumn(column) && unit === "building") {
    return {
      propertyName:
        column === "change-rate-from-previous"
          ? "predicted_probability_change_rate_from_previous"
          : "predicted_probability_change_rate_from_oldest",
      metric: "change-rate",
    };
  }

  return {
    propertyName:
      unit === "area" && threshold !== undefined
        ? getAreaPredictedProbabilityColumn(threshold)
        : "predicted_probability",
    metric: "probability",
  };
};
