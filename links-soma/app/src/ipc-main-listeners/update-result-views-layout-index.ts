import { eq, inArray, sql, type SQL } from "drizzle-orm";
import { result_views } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

type Params = {
  sheetId: number /** sheetに紐づいたビューの配列の取得のため */;
  resultViewId: number /**  */;
  value: {
    layoutIndex: number;
  };
};

/** Sheetに紐づいたViewの配列内の対象のビューを移動させ、順序を変更する。 */
export const updateResultViewsLayoutIndex = (async (
  _: unknown,
  { resultViewId, sheetId, value: { layoutIndex } }: Params,
): Promise<void> => {
  const resultViews = await db
    .select()
    .from(result_views)
    .where(eq(result_views.sheet_id, sheetId));

  /**
   * 順序を変更する処理
   */
  // 移動対象のアイテムを見つける
  const targetItem = resultViews.find((item) => item.id === resultViewId);
  if (!targetItem) {
    return;
  }
  // 対象のビューを削除
  const remainingItems = resultViews.filter((item) => item.id !== resultViewId);
  // 新しい順序にビューを挿入
  remainingItems.splice(layoutIndex, 0, targetItem);
  // layoutIndexを再設定
  const newResultViews = remainingItems.map((item, index) => ({
    ...item,
    layoutIndex: index + 1,
  }));

  /**
   * 一括で更新するSQLを生成: @see https://orm.drizzle.team/learn/guides/update-many-with-different-value
   */
  const sqlChunks: SQL[] = [];
  const newResultViewIds: number[] = [];
  sqlChunks.push(sql`(case`);
  for (const newResultView of newResultViews) {
    sqlChunks.push(
      sql`when ${result_views.id} = ${newResultView.id} then ${newResultView.layoutIndex}`,
    );
    newResultViewIds.push(newResultView.id);
  }
  sqlChunks.push(sql`end)`);
  const finalSql: SQL = sql.join(sqlChunks, sql.raw(" "));

  await db
    .update(result_views)
    .set({ layoutIndex: finalSql })
    .where(inArray(result_views.id, newResultViewIds));
}) satisfies IpcMainListener;
