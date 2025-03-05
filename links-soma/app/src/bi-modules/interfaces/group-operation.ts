import { type z } from "zod";
import { type groupConditionValueSchema } from "../schema/group-operation";

// GroupingConditionの定義
export type GroupConditionValue = z.infer<typeof groupConditionValueSchema>;
