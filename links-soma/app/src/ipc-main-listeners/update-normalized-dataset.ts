import { eq } from "drizzle-orm";
import { normalized_data_sets, type SelectNormalizedDataSet } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const updateNormalizedDataset = (async (
  _: unknown,
  {
    id,
    fileName,
  }: {
    id: SelectNormalizedDataSet["id"];
    fileName: SelectNormalizedDataSet["file_name"];
  },
): Promise<void> => {
  await db
    .update(normalized_data_sets)
    .set({ file_name: fileName })
    .where(eq(normalized_data_sets.id, id));
}) satisfies IpcMainListener;
