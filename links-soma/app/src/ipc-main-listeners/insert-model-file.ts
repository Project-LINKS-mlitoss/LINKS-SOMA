import {
  type InsertModelFile,
  model_files,
  type SelectModelFile,
} from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const insertModelFile = (async (
  _: unknown,
  values: {
    file_name: InsertModelFile["file_name"];
    file_path: InsertModelFile["file_path"];
  },
): Promise<{
  insertedId: SelectModelFile["id"];
}> => {
  const result = await db
    .insert(model_files)
    .values(values)
    .returning({
      insertedId: model_files.id,
    })
    .get();

  return result;
}) satisfies IpcMainListener;
