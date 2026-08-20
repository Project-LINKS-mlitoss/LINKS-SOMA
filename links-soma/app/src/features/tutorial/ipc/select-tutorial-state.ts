import { eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { tutorial_state, type SelectTutorialState } from "../../../db/schema";
import { type IpcMainListener } from "../../../ipc-main-listeners";

/** singleton の固定 id。ガイド進行状態は 1 行のみ。 */
export const TUTORIAL_STATE_ID = 1;

/**
 * ガイド進行状態（singleton）を取得する。未作成なら null。
 */
export const selectTutorialState = (async (): Promise<SelectTutorialState | null> => {
  const row = db
    .select()
    .from(tutorial_state)
    .where(eq(tutorial_state.id, TUTORIAL_STATE_ID))
    .get();

  return row ?? null;
}) satisfies IpcMainListener;
