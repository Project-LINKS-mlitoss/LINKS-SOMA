import { eq } from "drizzle-orm";
import { result_views, type SelectResultView } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export type SelectResultViewResponse = SelectResultView;

export const selectResultView = (async (
  _: unknown,
  { resultViewId }: { resultViewId: number },
): Promise<SelectResultViewResponse | undefined> => {
  const data = await db
    .select()
    .from(result_views)
    .where(eq(result_views.id, resultViewId))
    .get();

  return data;
}) satisfies IpcMainListener;
