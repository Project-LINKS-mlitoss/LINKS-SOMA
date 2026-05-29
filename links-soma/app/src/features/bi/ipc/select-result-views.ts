import { eq } from "drizzle-orm";
import { result_views, type SelectResultView } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectResultViews = (async (
  _: unknown,
  { sheetId }: { sheetId: number },
): Promise<SelectResultView[]> => {
  const all = await db
    .select()
    .from(result_views)
    .where(eq(result_views.sheet_id, sheetId));

  return all;
}) satisfies IpcMainListener;
