import { eq } from "drizzle-orm";
import { result_sheets, result_views } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const deleteResultSheet = (async (
  _: unknown,
  { resultSheetId }: { resultSheetId: number },
): Promise<void> => {
  await db
    .delete(result_views)
    .where(eq(result_views.sheet_id, resultSheetId))
    .execute();
  await db
    .delete(result_sheets)
    .where(eq(result_sheets.id, resultSheetId))
    .execute();
  return;
}) satisfies IpcMainListener;
