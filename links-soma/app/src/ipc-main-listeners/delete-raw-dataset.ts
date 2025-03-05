import { eq } from "drizzle-orm";
import { raw_data_sets, type SelectNormalizedDataSet } from "../schema";
import { db } from "../utils/db";
import { deleteDataSetFile } from "../utils/delete-dataset-file";
import { type IpcMainListener } from ".";

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
