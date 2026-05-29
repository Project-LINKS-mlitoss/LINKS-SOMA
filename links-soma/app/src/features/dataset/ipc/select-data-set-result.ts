import { eq } from "drizzle-orm";
import { data_set_results, type SelectDataSetResult } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectDataSetResult = (async (
  _: unknown,
  options?: { id: number },
): Promise<SelectDataSetResult | undefined> => {
  const data = await db
    .select()
    .from(data_set_results)
    .where(options?.id ? eq(data_set_results.id, options.id) : undefined)
    .get();

  return data;
}) satisfies IpcMainListener;
