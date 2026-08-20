import { view_templates } from "../../../db/schema";
import { db } from "../../../db/client";
import { type ViewTemplate, viewTemplateSchema } from "../types";
import { type IpcMainListener } from "../../../ipc-main-listeners";

/**
 * 編集したビュー群をテンプレートとして名前付き保存する（FR021「名前付き保存」）。
 * views は呼び出し側で result_views から data_set_result_id を抜いたもの。
 * 保存単位（シート全体 or 選択ビュー）は views 配列の中身で決まる（バックエンドは固定しない）。
 *
 * 書き込み前に viewTemplateSchema で検証する。views は JSON カラムで DB 制約が効かないため、
 * 不正な形状を入れない最後の砦をここに置く。空ビューも適用不能なため弾く。
 */
export const insertViewTemplate = (async (
  _: unknown,
  params: ViewTemplate,
): Promise<{ insertedId: number }> => {
  const { name, description, views } = viewTemplateSchema.parse(params);
  if (views.length === 0) {
    throw new Error("View template must contain at least one view");
  }

  const res = await db
    .insert(view_templates)
    .values({ name, description: description ?? null, views })
    .returning({ insertedId: view_templates.id })
    .get();
  return res;
}) satisfies IpcMainListener;
