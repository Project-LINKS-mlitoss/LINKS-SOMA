import { type InsertNormalizedDataSet, normalized_data_sets } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const insertNormalizedDatasets = (async (
  _: unknown,
  { file_name, file_path }: InsertNormalizedDataSet,
): Promise<{ insertedId: number }> => {
  const res = db
    .insert(normalized_data_sets)
    .values({
      file_name,
      file_path,
    })
    .returning({
      insertedId: normalized_data_sets.id,
    })
    .get();

  return res;
}) satisfies IpcMainListener;
