import { eq } from "drizzle-orm";
import { raw_data_sets, type SelectRawDataSet } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

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
