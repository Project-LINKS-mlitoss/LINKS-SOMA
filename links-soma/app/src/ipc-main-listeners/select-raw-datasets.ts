import { desc } from "drizzle-orm";
import { raw_data_sets, type SelectRawDataSet } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const selectRawDatasets = (async (
  _: unknown,
): Promise<SelectRawDataSet[]> => {
  const data = await db
    .select()
    .from(raw_data_sets)
    .orderBy(desc(raw_data_sets.created_at));

  return data;
}) satisfies IpcMainListener;
