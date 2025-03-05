import { z } from "zod";

const textGroupingConditionSchema = z.object({
  label: z.string(),
  referenceColumnType: z.literal("text"),
  value: z.string(),
  operation: z.enum(["eq", "noteq", "contains", "notContains"]),
});

const numberGroupingConditionSchema = z.object({
  label: z.string(),
  referenceColumnType: z.enum(["integer", "float"]),
  operation: z.enum(["eq", "noteq", "gt", "lt", "gte", "lte"]),
  value: z.coerce.number(),
});

const numberRangeGroupingConditionSchema = z.object({
  label: z.string(),
  referenceColumnType: z.enum(["integerRange", "floatRange"]),
  operation: z.literal("range"),
  startValue: z.coerce.number(),
  lastValue: z.coerce.number(),
  includesStart: z.boolean(),
  includesLast: z.boolean(),
});

const dateGroupingConditionSchema = z.object({
  label: z.string(),
  referenceColumnType: z.literal("date"),
  operation: z.enum(["eq", "noteq", "gt", "lt", "gte", "lte"]),
  value: z.string(),
});

const dateRangeGroupingConditionSchema = z.object({
  label: z.string(),
  referenceColumnType: z.literal("dateRange"),
  operation: z.literal("range"),
  startValue: z.string(),
  lastValue: z.string(),
  includesStart: z.boolean(),
  includesLast: z.boolean(),
});

const booleanGroupingConditionSchema = z.object({
  label: z.string(),
  referenceColumnType: z.literal("boolean"),
  operation: z.enum(["isTrue", "isFalse"]),
  value: z.undefined(),
});

export const groupConditionValueSchema = z.union([
  textGroupingConditionSchema,
  numberGroupingConditionSchema,
  numberRangeGroupingConditionSchema,
  dateGroupingConditionSchema,
  dateRangeGroupingConditionSchema,
  booleanGroupingConditionSchema,
]);
