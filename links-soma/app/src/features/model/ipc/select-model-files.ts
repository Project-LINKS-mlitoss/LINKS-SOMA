import { model_files, type SelectModelFile } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectModelFiles = (async (): Promise<SelectModelFile[]> => {
  const all = await db.select().from(model_files);

  return all;
}) satisfies IpcMainListener;
