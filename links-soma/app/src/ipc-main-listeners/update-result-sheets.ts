import { eq } from "drizzle-orm";
import {
  type InsertResultSheet,
  result_sheets,
  type SelectResultSheet,
} from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const updateResultSheets = (async (
  _: unknown,
  {
    resultSheetId,
    value: { title },
  }: { resultSheetId: number; value: InsertResultSheet },
): Promise<SelectResultSheet[]> => {
  const res = await db
    .update(result_sheets)
    .set({ title })
    .where(eq(result_sheets.id, resultSheetId))
    .returning();

  return res;
}) satisfies IpcMainListener;
