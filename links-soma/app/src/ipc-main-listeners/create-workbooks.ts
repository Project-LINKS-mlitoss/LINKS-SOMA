import { workbooks, result_sheets, type InsertWorkbook } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

/**
 * ワークブックを新規作成
 * シートはデフォルトで1つ作成される
 * デフォルトで作られるシートのタイトルは"シート1"
 */
export const createWorkbooks = (async (
  _: unknown,
  { title }: InsertWorkbook,
): Promise<{
  id: number | bigint;
}> => {
  const { id } = await db.transaction(async (tx) => {
    const res = await tx.insert(workbooks).values({ title }).returning();
    await tx
      .insert(result_sheets)
      .values({ workbook_id: res[0].id, title: "シート1" });
    return {
      id: res[0].id,
    };
  });
  return {
    id,
  };
}) satisfies IpcMainListener;
