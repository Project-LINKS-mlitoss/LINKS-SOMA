import { type InsertRawDataSet, raw_data_sets, result_views } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const insertRawDatasets = (async (
  _: unknown,
  values: {
    file_name: InsertRawDataSet["file_name"];
    file_path: InsertRawDataSet["file_path"];
  },
): Promise<{ insertedId: number }> => {
  const res = await db
    .insert(raw_data_sets)
    .values(values)
    .returning({
      insertedId: result_views.id,
    })
    .get();

  return res;
}) satisfies IpcMainListener;
