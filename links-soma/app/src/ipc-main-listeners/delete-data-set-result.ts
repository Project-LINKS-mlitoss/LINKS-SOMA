import { eq } from "drizzle-orm";
import { data_set_results, type SelectDataSetResult } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const deleteDataSetResult = (async (
  _: unknown,
  {
    id,
  }: {
    id: SelectDataSetResult["id"];
  },
): Promise<void> => {
  await db.delete(data_set_results).where(eq(data_set_results.id, id));
}) satisfies IpcMainListener;
