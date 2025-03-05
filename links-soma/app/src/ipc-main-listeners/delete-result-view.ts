import { eq } from "drizzle-orm";
import { result_views } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const deleteResultView = (async (
  _: unknown,
  { resultViewId, sheetId }: { resultViewId: number; sheetId: number },
): Promise<void> => {
  await db.delete(result_views).where(eq(result_views.id, resultViewId));
  // layoutIndexを更新する
  const all = await db
    .select()
    .from(result_views)
    .where(eq(result_views.sheet_id, sheetId));
  const sorted = all.sort((a, b) =>
    a.layoutIndex && b.layoutIndex ? a.layoutIndex - b.layoutIndex : 0,
  );
  await Promise.all(
    sorted.map((view, i) =>
      db
        .update(result_views)
        .set({ layoutIndex: i + 1 })
        .where(eq(result_views.id, view.id)),
    ),
  );
}) satisfies IpcMainListener;
