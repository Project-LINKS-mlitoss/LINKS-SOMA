import type { DataDrivenPropertyValueSpecification } from "@maplibre/maplibre-gl-style-spec";

export const LAYER_COLORS = {
  RED: "#C4314B",
  YELLOW: "#FFA929",
  GREEN: "#1B8C63",
  GRAY: "#999999",
  WHITE: "#ffffff",
  /** 重複ポリゴン・ポイントの境界線色 */
  OVERLAP_OUTLINE: "#9E9E9E",
} as const;

/**
 * 確率値に基づく色分けのMapLibreスタイル表現を生成
 * @param predictedProbability 色分けのしきい値（medium/high）
 * @param propertyName 参照するプロパティ名（デフォルト: predicted_probability）
 */
export const createColorExpression = (
  predictedProbability: {
    medium: number;
    high: number;
  },
  propertyName = "predicted_probability",
): DataDrivenPropertyValueSpecification<string> => [
  "case",
  ["any"],
  LAYER_COLORS.GRAY,
  [">=", ["get", propertyName], predictedProbability.high],
  LAYER_COLORS.RED,
  [">=", ["get", propertyName], predictedProbability.medium],
  LAYER_COLORS.YELLOW,
  LAYER_COLORS.GREEN,
];

export const createClickedStateExpression = <T extends number | string>(
  clickedValue: T,
  normalValue: T,
): DataDrivenPropertyValueSpecification<T> => [
  "case",
  ["boolean", ["feature-state", "clicked"], false],
  clickedValue,
  normalValue,
];
