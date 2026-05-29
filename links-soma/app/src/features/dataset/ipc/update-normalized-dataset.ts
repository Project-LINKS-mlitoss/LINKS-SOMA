import { eq } from "drizzle-orm";
import {
  normalized_data_sets,
  type SelectNormalizedDataSet,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

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
