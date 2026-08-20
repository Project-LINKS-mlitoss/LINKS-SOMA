import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/client";
import { tutorial_state } from "../../../db/schema";
import { type IpcMainListener } from "../../../ipc-main-listeners";
import { TUTORIAL_STATE_ID } from "./select-tutorial-state";

type Params = { draftJobId: number };

/**
 * 進行中ガイドが指定の下書き job を参照しているかを返す（上書き/削除ガード用）。
 *
 * 破壊操作サイト（下書き確認の「新規作成」/ job 削除）が navigate/削除の前に問い合わせる。
 * ドメイン側が tutorial を import せず、述語を尋ねるだけにするための境界 IPC（ADR-0024）。
 */
export const isDraftReferencedByGuide = (async (
  _: unknown,
  { draftJobId }: Params,
): Promise<boolean> => {
  const row = db
    .select()
    .from(tutorial_state)
    .where(
      and(
        eq(tutorial_state.id, TUTORIAL_STATE_ID),
        // 進行中(running)だけでなく中断中(paused)も下書きを握っている。
        // paused を外すと、中断後の job 削除がガードをすり抜けて再開ポイントを無言で失う。
        inArray(tutorial_state.phase, ["running", "paused"]),
        eq(tutorial_state.draft_job_id, draftJobId),
      ),
    )
    .get();

  return row != null;
}) satisfies IpcMainListener;
