import { type InsertResultSheet, result_sheets } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const insertResultSheets = (async (
  _: unknown,
  { workbook_id, title }: InsertResultSheet,
): Promise<{ insertedId: number }> => {
  const res = await db
    .insert(result_sheets)
    .values({ workbook_id, title })
    .returning({ insertedId: result_sheets.id })
    .get();
  return res;
}) satisfies IpcMainListener;
