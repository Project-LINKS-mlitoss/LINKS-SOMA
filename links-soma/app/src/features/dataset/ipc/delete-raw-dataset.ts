import { eq } from "drizzle-orm";
import { raw_data_sets, type SelectNormalizedDataSet } from "../../../db/schema";
import { db } from "../../../db/client";
import { deleteDataSetFile } from "../util/delete-dataset-file";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const deleteRawDataset = (async (
  _: unknown,
  {
    id,
  }: {
    id: SelectNormalizedDataSet["id"];
  },
): Promise<void> => {
  const deleted = await db
    .delete(raw_data_sets)
    .where(eq(raw_data_sets.id, id))
    .returning()
    .get();

  if (deleted) {
    deleteDataSetFile(deleted.file_path);
  }
}) satisfies IpcMainListener;
