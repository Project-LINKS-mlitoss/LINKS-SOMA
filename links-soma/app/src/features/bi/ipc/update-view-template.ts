import { eq } from "drizzle-orm";
import { view_templates } from "../../../db/schema";
import { db } from "../../../db/client";
import { type ViewTemplateView } from "../types";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  id: number;
  /** 指定したフィールドのみ更新（名前・説明の編集 / 上書き保存） */
  name?: string;
  /** 説明の更新。null で説明を消去できる */
  description?: string | null;
  views?: ViewTemplateView[];
};

/**
 * ユーザーテンプレートの更新（FR021「名前付き保存」の更新側）。
 * システムプリセットは DB に存在しないため対象外。
 */
export const updateViewTemplate = (async (
  _: unknown,
  { id, name, description, views }: Params,
): Promise<void> => {
  await db
    .update(view_templates)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(views !== undefined ? { views } : {}),
    })
    .where(eq(view_templates.id, id));
}) satisfies IpcMainListener;
