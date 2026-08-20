import { type VIEW_STYLES } from "../../../shared/config/view-styles";
import { type Parameter } from "../types/models/parameter";

/** 集計方法。パラメータ未設定のビューでも取得側と表示側で同じ既定を使う */
export type ChartAggregation = "avg" | "sum" | "count";

/**
 * 集計方法の既定値。
 *
 * 円グラフは全体の内訳を表す図であり、平均は足し合わせても全体にならないため成立しない。
 * 既定を件数にする。他のグラフは軸の値を平均で集計する従来の既定を保つ。
 */
export const getDefaultChartAggregation = (
  style: (typeof VIEW_STYLES)[number] | null,
): ChartAggregation => (style === "pie" ? "count" : "avg");

/**
 * パラメータから集計方法を解決する。
 * 未設定のビューが取得側と表示側で違う集計方法を前提にすると、
 * 件数を集計しながら確率の単位で表示する、といった食い違いが起きる。
 */
export const resolveChartAggregation = (
  parameters: Pick<Parameter, "type" | "value">[],
  style: (typeof VIEW_STYLES)[number] | null,
): ChartAggregation => {
  const parameter = parameters.find((p) => p.type === "group_aggregation");

  return (
    (parameter?.value as ChartAggregation | undefined) ??
    getDefaultChartAggregation(style)
  );
};
