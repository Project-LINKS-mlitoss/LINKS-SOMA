import { model_files, type SelectModelFile } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const selectModelFiles = (async (): Promise<SelectModelFile[]> => {
  const all = await db.select().from(model_files);

  return all;
}) satisfies IpcMainListener;
