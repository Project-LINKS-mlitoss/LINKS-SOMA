import { type z } from "zod";
import { type editViewFormSchema } from "../schema/edit-view-form";
import { type groupConditionValueSchema } from "../schema/group-operation";

export type EditViewFormType = z.infer<typeof editViewFormSchema>;
export type GroupConditionValue = z.infer<typeof groupConditionValueSchema>;
