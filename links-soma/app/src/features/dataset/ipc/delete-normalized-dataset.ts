import { eq } from "drizzle-orm";
import {
  normalized_data_sets,
  type SelectNormalizedDataSet,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { deleteDataSetFile } from "../util/delete-dataset-file";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const deleteNormalizedDataset = (async (
  _: unknown,
  {
    id,
  }: {
    id: SelectNormalizedDataSet["id"];
  },
): Promise<void> => {
  const deleted = await db
    .delete(normalized_data_sets)
    .where(eq(normalized_data_sets.id, id))
    .returning()
    .get();

  if (deleted) {
    deleteDataSetFile(deleted.file_path);
  }
}) satisfies IpcMainListener;
