import { eq } from "drizzle-orm";
import { result_sheets, workbooks, result_views } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const deleteWorkbook = (async (
  _: unknown,
  { workbookId }: { workbookId: number | undefined },
): Promise<void> => {
  if (!workbookId) throw new Error("Workbook id is required");
  const deletedResultSheets = await db
    .delete(result_sheets)
    .where(eq(result_sheets.workbook_id, workbookId))
    .returning();
  for (const resultSheet of deletedResultSheets) {
    await db
      .delete(result_views)
      .where(eq(result_views.sheet_id, resultSheet.id));
  }
  await db.delete(workbooks).where(eq(workbooks.id, workbookId));
}) satisfies IpcMainListener;
