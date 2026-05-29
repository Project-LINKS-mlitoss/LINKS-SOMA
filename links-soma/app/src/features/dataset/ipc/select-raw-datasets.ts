import { desc } from "drizzle-orm";
import { raw_data_sets, type SelectRawDataSet } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectRawDatasets = (async (
  _: unknown,
): Promise<SelectRawDataSet[]> => {
  const data = await db
    .select()
    .from(raw_data_sets)
    .orderBy(desc(raw_data_sets.created_at));

  return data;
}) satisfies IpcMainListener;
