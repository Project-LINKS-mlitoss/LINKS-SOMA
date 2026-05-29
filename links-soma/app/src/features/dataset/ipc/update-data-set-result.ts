import { eq } from "drizzle-orm";
import { data_set_results, type SelectDataSetResult } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

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
