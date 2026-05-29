import { eq } from "drizzle-orm";
import {
  result_views,
  data_set_results,
  type SelectDataSetResult,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";
import { type SelectResultViewResponse } from "./select-result-view";

export type ReadResultViewsResponse = {
  result_views: SelectResultViewResponse;
  data_set_results: SelectDataSetResult;
}[];

export const readResultViews = (async (
  _: unknown,
  { sheetId }: { sheetId: number },
): Promise<ReadResultViewsResponse> => {
  const all = await db
    .select()
    .from(result_views)
    .where(eq(result_views.sheet_id, sheetId))
    .innerJoin(
      data_set_results,
      eq(data_set_results.id, result_views.data_set_result_id),
    )
    .orderBy(result_views.layoutIndex)
    .all();

  return all as ReadResultViewsResponse;
}) satisfies IpcMainListener;
