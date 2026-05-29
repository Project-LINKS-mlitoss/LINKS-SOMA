import { eq } from "drizzle-orm";
import { raw_data_sets, type SelectRawDataSet } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const updateRawDataset = (async (
  _: unknown,
  {
    id,
    fileName,
  }: { id: SelectRawDataSet["id"]; fileName: SelectRawDataSet["file_name"] },
): Promise<void> => {
  await db
    .update(raw_data_sets)
    .set({ file_name: fileName })
    .where(eq(raw_data_sets.id, id));
}) satisfies IpcMainListener;
