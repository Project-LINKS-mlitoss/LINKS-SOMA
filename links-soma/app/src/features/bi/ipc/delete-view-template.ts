import { eq } from "drizzle-orm";
import { view_templates } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

/**
 * ユーザーテンプレートの削除。
 * システムプリセットは DB に存在しないため、id 指定で自然に対象外になる。
 */
export const deleteViewTemplate = (async (
  _: unknown,
  { id }: { id: number },
): Promise<void> => {
  await db.delete(view_templates).where(eq(view_templates.id, id));
}) satisfies IpcMainListener;
