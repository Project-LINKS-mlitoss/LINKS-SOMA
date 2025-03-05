import { type InsertResultSheet, result_sheets } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

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
