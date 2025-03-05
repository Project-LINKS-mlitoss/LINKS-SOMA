import { eq, desc } from "drizzle-orm";
import { data_set_results, type SelectDataSetResult } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const selectDataSetResults = (async (
  _: unknown,
  dataSetResultId?: number,
): Promise<SelectDataSetResult[]> => {
  const all = await db
    .select()
    .from(data_set_results)
    .where(
      dataSetResultId ? eq(data_set_results.id, dataSetResultId) : undefined,
    )
    .orderBy(desc(data_set_results.created_at));

  return all;
}) satisfies IpcMainListener;
