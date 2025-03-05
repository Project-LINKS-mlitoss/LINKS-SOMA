// import { z } from "zod";
// import { result_views } from "../schema";

// export const YEAR_LOWER_LIMIT = "下限なし";
// export const YEAR_UPPER_LIMIT = "上限なし";

// export const editResultViewFormSchema = z.object({
//   title: z.string().max(255).optional(),
//   unit: z.enum(result_views.unit.enumValues).default("building"),
//   style: z.enum(result_views.style.enumValues).default("map"),
//   parameters: z
//     .discriminatedUnion("type", [
//       z.object({
//         key: z.string(),
//         value: z.string(),
//         type: z.literal("column"),
//       }),
//       z.object({
//         key: z.string(),
//         type: z.literal("group"),
//         value: z.discriminatedUnion("operation", [
//           z.object({
//             operation: z.enum(["eq", "noteq", "gt", "gte", "lt", "lte"]),
//             value: z.number().optional(),
//             label: z.string(),
//           }),
//           z.object({
//             operation: z.enum(["range"]),
//             startValue: z.number().optional(),
//             lastValue: z.number().optional(),
//             includesStart: z.boolean().optional(),
//             includesLast: z.boolean().optional(),
//             label: z.string(),
//           }),
//         ]),
//       }),
//       z.object({
//         key: z.string(),
//         type: z.literal("filter"),
//         value: z.string().or(z.number()).nullable(),
//       }),
//     ])
//     .array(),

//   year: z.object({
//     start: z
//       .number()
//       .or(
//         z
//           .enum([YEAR_LOWER_LIMIT])
//           .optional()
//           .default(YEAR_LOWER_LIMIT)
//           .transform((v) => (v === YEAR_LOWER_LIMIT ? null : v)),
//       )
//       .nullable(),
//     end: z
//       .number()
//       .or(
//         z
//           .enum([YEAR_UPPER_LIMIT])
//           .optional()
//           .default(YEAR_UPPER_LIMIT)
//           .transform((v) => (v === YEAR_UPPER_LIMIT ? null : v)),
//       )
//       .nullable(),
//   }),
//   areas: z.array(z.string()).optional().default([]),
// });
