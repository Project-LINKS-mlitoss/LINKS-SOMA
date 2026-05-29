import {
  type InsertNormalizedDataSet,
  normalized_data_sets,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

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
