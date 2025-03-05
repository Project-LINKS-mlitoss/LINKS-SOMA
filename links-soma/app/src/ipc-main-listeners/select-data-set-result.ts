import { eq } from "drizzle-orm";
import { data_set_results, type SelectDataSetResult } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

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
