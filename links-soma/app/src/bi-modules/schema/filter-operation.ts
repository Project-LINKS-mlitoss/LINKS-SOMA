import { z } from "zod";

const textFilterConditionSchema = z.object({
  referenceColumnType: z.literal("text"),
  referenceColumn: z.string(),
  value: z.string(),
  operation: z.enum(["eq", "noteq", "contains", "notContains"]),
});

const numberFilterConditionSchema = z.object({
  referenceColumnType: z.enum(["integer", "float"]),
  referenceColumn: z.string(),
  operation: z.enum(["eq", "noteq", "gt", "lt", "gte", "lte"]),
  value: z.number(),
});

const numberFilterConditionRangeSchema = z.object({
  referenceColumnType: z.enum(["integerRange", "floatRange"]),
  referenceColumn: z.string(),
  operation: z.literal("range"),
  startValue: z.number(),
  lastValue: z.number(),
  includesStart: z.boolean(),
  includesLast: z.boolean(),
});

const dateFilterConditionSchema = z.object({
  referenceColumnType: z.literal("date"),
  referenceColumn: z.string(),
  operation: z.enum(["eq", "noteq", "gt", "lt", "gte", "lte"]),
  value: z.string(),
});

const dateFilterConditionRangeSchema = z.object({
  referenceColumnType: z.literal("dateRange"),
  referenceColumn: z.string(),
  operation: z.literal("range"),
  startValue: z.string(),
  lastValue: z.string(),
  includesStart: z.boolean(),
  includesLast: z.boolean(),
});

const booleanFilterConditionSchema = z.object({
  referenceColumnType: z.literal("boolean"),
  referenceColumn: z.string(),
  operation: z.enum(["isTrue", "isFalse"]),
  value: z.undefined().or(z.string()),
});

export const filterConditionValueSchema = z.union([
  textFilterConditionSchema,
  numberFilterConditionSchema,
  numberFilterConditionRangeSchema,
  dateFilterConditionSchema,
  dateFilterConditionRangeSchema,
  booleanFilterConditionSchema,
]);
