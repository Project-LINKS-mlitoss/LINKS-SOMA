/**
 * ビュー編集バーの基本設定以外のパラメータはJson形式でDBに保存される
 * DrizzleのSchemaにTypescriptの型定義をそのまま書くのではなくzodのSchemaで表現し、検証の容易性を高める
 */

import { z } from "zod";
import {
  type AREA_DATASET_COLUMN,
  type BUILDING_DATASET_COLUMN,
} from "../../config/column-metadata";
import { filterConditionValueSchema } from "./filter-operation";
import { groupConditionValueSchema } from "./group-operation";

/** 実態の定義が難しいのでカスタムを利用 */
const columnSchema = z.custom<AREA_DATASET_COLUMN | BUILDING_DATASET_COLUMN>(
  (val) => val,
);

export const parameterBaseSchema = z.object({
  key: z.string(),
  type: z.enum(["filter", "column", "group", "group_aggregation"]),
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
]);
