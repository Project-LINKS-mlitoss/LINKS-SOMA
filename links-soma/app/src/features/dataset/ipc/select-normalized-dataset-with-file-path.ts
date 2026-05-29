import { eq } from "drizzle-orm";
import {
  normalized_data_sets,
  type SelectNormalizedDataSet,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectNormalizedDatasetWithFilePath = (async (
  _: unknown,
  { filePath }: { filePath: SelectNormalizedDataSet["file_path"] | undefined },
): Promise<SelectNormalizedDataSet | undefined> => {
  if (!filePath) return undefined;

  const data = await db
    .select()
    .from(normalized_data_sets)
    .where(eq(normalized_data_sets.file_path, filePath))
    .get();

  return data;
}) satisfies IpcMainListener;
