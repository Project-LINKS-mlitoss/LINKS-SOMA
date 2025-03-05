import { eq } from "drizzle-orm";
import { result_sheets, type SelectResultSheet } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

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
