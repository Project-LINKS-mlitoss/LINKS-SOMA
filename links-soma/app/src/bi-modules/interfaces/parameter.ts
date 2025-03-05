/** result-viewテーブルに入っている値の整理 */

import { type z } from "zod";
import {
  type parameterSchema,
  type filterConditionSchema,
  type pieValueSchema,
  type pieLabelSchema,
  type areaFilterSchema,
  type yearFilterSchema,
  type tableColumnsSchema,
  type groupAggregationSchema,
  type groupConditionSchema,
  type yAxisSchema,
  type xAxisSchema,
  type parameterBaseSchema,
} from "../schema/parameter";

export type ParameterBase = z.infer<typeof parameterBaseSchema>;

/** X軸:棒・折れ線で共通で利用される */
export type XAxis = z.infer<typeof xAxisSchema>;

/** Y軸:棒・折れ線で共通で利用される */
export type YAxis = z.infer<typeof yAxisSchema>;

/** ラベルグループ 動的作成 */
export type GroupCondition = z.infer<typeof groupConditionSchema>;

/** 折れ線グラフ/円グラフ:Y軸/値の集計方法 */
export type GroupAggregation = z.infer<typeof groupAggregationSchema>;

/** 表:カラム */
export type TableColumns = z.infer<typeof tableColumnsSchema>;

/** フィルター:年 */
export type YearFilter = z.infer<typeof yearFilterSchema>;
/** フィルター:エリア */
export type AreaFilter = z.infer<typeof areaFilterSchema>;

/** フィルター詳細条件 */
export type FilterCondition = z.infer<typeof filterConditionSchema>;

/** 円グラフ:ラベル */
export type PieLabel = z.infer<typeof pieLabelSchema>;

/** 円グラフ:値 */
export type PieValue = z.infer<typeof pieValueSchema>;

/** WIP: 上段の型定義はすべてSchema経由に置き換えられる */
export type Parameter = z.infer<typeof parameterSchema>;

/** Utility */
export const isFilterCondition = (
  parameter: Parameter,
): parameter is FilterCondition => {
  return parameter.type === "filter" && parameter.key.startsWith("filter_");
};

export const isGroupCondition = (
  parameter: Parameter,
): parameter is GroupCondition => {
  return parameter.type === "group" && parameter.key.startsWith("group_");
};
