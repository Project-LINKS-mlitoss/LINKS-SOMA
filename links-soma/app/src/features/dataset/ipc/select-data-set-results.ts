import { eq, desc } from "drizzle-orm";
import { data_set_results, type SelectDataSetResult } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

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
