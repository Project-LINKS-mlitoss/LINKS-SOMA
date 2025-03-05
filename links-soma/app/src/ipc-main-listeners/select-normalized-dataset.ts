import { eq } from "drizzle-orm";
import { normalized_data_sets, type SelectNormalizedDataSet } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const selectNormalizedDataSet = (async (
  _: unknown,
  options?: { id: number },
): Promise<SelectNormalizedDataSet | undefined> => {
  const data = await db
    .select()
    .from(normalized_data_sets)
    .where(options?.id ? eq(normalized_data_sets.id, options.id) : undefined)
    .get();

  return data;
}) satisfies IpcMainListener;
