import { eq } from "drizzle-orm";
import { raw_data_sets, type SelectRawDataSet } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const selectRawDatasetWithFilePath = (async (
  _: unknown,
  { filePath }: { filePath: SelectRawDataSet["file_path"] | undefined },
): Promise<SelectRawDataSet | undefined> => {
  if (!filePath) return undefined;

  const data = await db
    .select()
    .from(raw_data_sets)
    .where(eq(raw_data_sets.file_path, filePath))
    .get();

  return data;
}) satisfies IpcMainListener;
