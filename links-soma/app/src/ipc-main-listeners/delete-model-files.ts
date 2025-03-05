import { eq } from "drizzle-orm";
import { model_files } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

type Params = {
  modelFileId: number;
};
export const deleteModelFiles = (async (
  _: unknown,
  { modelFileId }: Params,
): Promise<void> => {
  await db.transaction(async (trx) => {
    await trx
      .delete(model_files)
      .where(eq(model_files.id, modelFileId))
      .execute();
  });
  /**
   * @todo ここにファイル削除処理を追加する
   */
  return;
}) satisfies IpcMainListener;
