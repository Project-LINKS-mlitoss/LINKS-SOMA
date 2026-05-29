import { eq } from "drizzle-orm";
import { raw_data_sets, type SelectRawDataSet } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectRawDataset = (async (
  _: unknown,
  { id }: { id: number },
): Promise<SelectRawDataSet | undefined> => {
  const data = await db
    .select()
    .from(raw_data_sets)
    .where(eq(raw_data_sets.id, id))
    .get();

  return data;
}) satisfies IpcMainListener;
