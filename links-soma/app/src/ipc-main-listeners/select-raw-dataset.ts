import { eq } from "drizzle-orm";
import { raw_data_sets, type SelectRawDataSet } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

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
