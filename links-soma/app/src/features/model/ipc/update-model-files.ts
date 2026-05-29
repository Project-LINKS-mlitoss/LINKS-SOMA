import { eq } from "drizzle-orm";
import { type InsertModelFile, model_files } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  modelFileId: number;
  value: Pick<InsertModelFile, "file_name" | "note">;
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
