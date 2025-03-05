import { z } from "zod";
import { result_views } from "../../schema";
import { parameterSchema } from "./parameter";

export const editViewFormSchema = z.object({
  dataSetResultId: z.coerce.number().optional(), // UI上はundefinedを許容
  title: z.string(),
  style: z.enum(result_views.style.enumValues),
  unit: z.enum(result_views.unit.enumValues),
  parameters: z.array(parameterSchema),
});
