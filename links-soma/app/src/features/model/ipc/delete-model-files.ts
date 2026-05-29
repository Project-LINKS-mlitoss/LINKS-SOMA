import path from "path";
import { existsSync, unlinkSync } from "fs";
import { eq } from "drizzle-orm";
import { model_files } from "../../../db/schema";
import { db, dbDirectory } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  modelFileId: number;
};
export const deleteModelFiles = (async (
  _: unknown,
  { modelFileId }: Params,
): Promise<void> => {
  const deleted = await db
    .delete(model_files)
    .where(eq(model_files.id, modelFileId))
    .returning()
    .get();

  if (deleted?.file_path) {
    const filePath = path.resolve(dbDirectory, deleted.file_path);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }
}) satisfies IpcMainListener;
