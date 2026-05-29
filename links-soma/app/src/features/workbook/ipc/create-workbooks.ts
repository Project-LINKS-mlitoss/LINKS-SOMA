import { workbooks, result_sheets, type InsertWorkbook } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

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
