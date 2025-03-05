import { eq } from "drizzle-orm";
import { type InsertModelFile, model_files } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

type Params = {
  modelFileId: number;
  value: InsertModelFile;
};
export const updateModelFiles = (async (
  _: unknown,
  { modelFileId, value: { file_name, note } }: Params,
): Promise<void> => {
  await db
    .update(model_files)
    .set({ file_name, note })
    .where(eq(model_files.id, modelFileId));
}) satisfies IpcMainListener;
