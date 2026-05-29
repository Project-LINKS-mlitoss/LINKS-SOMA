import { eq } from "drizzle-orm";
import { result_sheets, type SelectResultSheet } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectResultSheets = (async (
  _: unknown,
  { workbookId }: { workbookId: number },
): Promise<SelectResultSheet[]> => {
  const all = await db
    .select()
    .from(result_sheets)
    .where(eq(result_sheets.workbook_id, workbookId));

  return all;
}) satisfies IpcMainListener;
