import { eq } from "drizzle-orm";
import {
  type InsertResultView,
  result_views,
  type SelectResultView,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const updateResultViews = (async (
  _: unknown,
  {
    resultViewId,
    value: { data_set_result_id, title, style, unit, parameters },
  }: { resultViewId: number; value: InsertResultView },
): Promise<SelectResultView[]> => {
  const res = await db
    .update(result_views)
    .set({ data_set_result_id, title, style, unit, parameters })
    .where(eq(result_views.id, resultViewId))
    .returning();
  return res;
}) satisfies IpcMainListener;
