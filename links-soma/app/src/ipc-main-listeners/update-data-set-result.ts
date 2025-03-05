import { eq } from "drizzle-orm";
import { data_set_results, type SelectDataSetResult } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const updateDataSetResult = (async (
  _: unknown,
  {
    id,
    title,
  }: { id: SelectDataSetResult["id"]; title: SelectDataSetResult["title"] },
): Promise<void> => {
  await db
    .update(data_set_results)
    .set({ title })
    .where(eq(data_set_results.id, id));
}) satisfies IpcMainListener;
