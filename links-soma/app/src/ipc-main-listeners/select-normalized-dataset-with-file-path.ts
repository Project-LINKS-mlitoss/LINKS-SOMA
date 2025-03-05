import { eq } from "drizzle-orm";
import { normalized_data_sets, type SelectNormalizedDataSet } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

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
