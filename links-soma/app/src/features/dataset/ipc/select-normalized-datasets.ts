import { desc } from "drizzle-orm";
import {
  normalized_data_sets,
  type SelectNormalizedDataSet,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectNormalizedDataSets = (async (
  _: unknown,
): Promise<SelectNormalizedDataSet[]> => {
  const data = await db
    .select()
    .from(normalized_data_sets)
    .orderBy(desc(normalized_data_sets.created_at));
  return data;
}) satisfies IpcMainListener;
