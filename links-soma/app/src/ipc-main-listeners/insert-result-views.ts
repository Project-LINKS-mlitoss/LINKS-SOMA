import { type InsertResultView, result_views } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const insertResultViews = (async (
  _: unknown,
  { sheet_id, data_set_result_id, layoutIndex }: InsertResultView,
): Promise<{ insertedId: number }> => {
  const res = await db
    .insert(result_views)
    .values({
      sheet_id,
      data_set_result_id,
      title: "",
      parameters: [],
      layoutIndex,
    })
    .returning({
      insertedId: result_views.id,
    })
    .get();
  return res;
}) satisfies IpcMainListener;
