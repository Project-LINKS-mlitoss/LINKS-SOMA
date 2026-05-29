/**
 * ビュー編集バーの基本設定以外のパラメータはJson形式でDBに保存される
 * DrizzleのSchemaにTypescriptの型定義をそのまま書くのではなくzodのSchemaで表現し、検証の容易性を高める
 */

import { z } from "zod";
import {
  type AREA_DATASET_COLUMN,
  type BUILDING_DATASET_COLUMN,
} from "../../../../shared/config/column-metadata";
import { filterConditionValueSchema } from "./filter-operation";
import { groupConditionValueSchema } from "./group-operation";

/** 実態の定義が難しいのでカスタムを利用 */
const columnSchema = z.custom<AREA_DATASET_COLUMN | BUILDING_DATASET_COLUMN>(
  (val) => val,
);

/** 閾値の値（5%刻み、19パターン） */
export const THRESHOLD_VALUES = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95,
] as const;
export type ThresholdValue = (typeof THRESHOLD_VALUES)[number];

export const parameterBaseSchema = z.object({
  key: z.string(),
  type: z.enum([
    "filter",
    "column",
    "group",
    "group_aggregation",
    "map",
    "yAxisMinMax",
    "threshold",
  ]),
  value: z.any(), // unknown 型
});

export const xAxisSchema = parameterBaseSchema.extend({
  key: z.literal("xAxis"),
  type: z.literal("column"),
  value: columnSchema,
});

export const yAxisSchema = parameterBaseSchema.extend({
  key: z.literal("yAxis"),
  type: z.literal("column"),
  value: columnSchema,
});

export const yAxisMinMaxSchema = parameterBaseSchema.extend({
  key: z.literal("yAxisMinMax"),
  type: z.literal("yAxisMinMax"),
  value: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
  }),
});

export const groupConditionSchema = parameterBaseSchema.extend({
  key: z.custom<`group_${string}`>((val) => /^group_/.test(val)),
  type: z.literal("group"),
  value: groupConditionValueSchema,
});

export const groupAggregationSchema = parameterBaseSchema.extend({
  key: z.literal("group_aggregation"),
  type: z.literal("group_aggregation"),
  value: z.enum(["avg", "sum", "count"]),
});

export const tableColumnsSchema = parameterBaseSchema.extend({
  key: z.literal("columns"),
  type: z.literal("column"),
  value: z.string(),
});

export const yearFilterSchema = parameterBaseSchema.extend({
  key: z.literal("year"),
  type: z.literal("filter"),
  value: z.object({ start: z.string(), end: z.string() }),
});

export const areaFilterSchema = parameterBaseSchema.extend({
  key: z.literal("area"),
  type: z.literal("filter"),
  value: z.string().array(),
});

export const filterConditionSchema = parameterBaseSchema.extend({
  key: z.custom<`filter_${string}`>((val) => /^filter_/.test(val)),
  type: z.literal("filter"),
  value: filterConditionValueSchema,
});

export const pieLabelSchema = parameterBaseSchema.extend({
  key: z.literal("label"),
  type: z.literal("column"),
  value: columnSchema,
});

export const pieValueSchema = parameterBaseSchema.extend({
  key: z.literal("value"),
  type: z.literal("column"),
  value: columnSchema,
});

export const mapCenterSchema = parameterBaseSchema.extend({
  key: z.literal("map_center"),
  type: z.literal("map"),
  value: z.object({
    lng: z.number(),
    lat: z.number(),
    zoom: z.number().optional(), // 後方互換性のためoptional
  }),
});

/**
 * 閾値の文字列値を自動生成（Zod enum用）
 * THRESHOLD_VALUESから一元管理することで、値追加時の修正漏れを防ぐ
 */
const THRESHOLD_STRING_VALUES = THRESHOLD_VALUES.map(String) as unknown as [
  string,
  ...string[],
];

/** 閾値設定パラメータ（空き家判定の閾値） */
export const thresholdSchema = parameterBaseSchema.extend({
  key: z.literal("threshold"),
  type: z.literal("threshold"),
  value: z.enum(THRESHOLD_STRING_VALUES),
});
export type ThresholdParameter = z.infer<typeof thresholdSchema>;

export const parameterSchema = z.union([
  xAxisSchema,
  yAxisSchema,
  groupConditionSchema,
  groupAggregationSchema,
  tableColumnsSchema,
  yearFilterSchema,
  areaFilterSchema,
  filterConditionSchema,
  pieLabelSchema,
  pieValueSchema,
  mapCenterSchema,
  yAxisMinMaxSchema,
  thresholdSchema,
]);
