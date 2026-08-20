import { eq, and } from "drizzle-orm";
import { type DraftPreprocessParameters } from "../../../shared/types/job-parameters";
import { db } from "../../../db/client";
import { jobs } from "../../../db/schema";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type CreateDraftJobParams = {
  parameters: DraftPreprocessParameters;
};

type CreateDraftJobResult = {
  jobId: number;
  isExisting: boolean;
};

/**
 * 下書きjobを作成する
 * 既存の下書きがあればそのIDを返す（1件制限）
 */
export const createDraftJob = (async (
  _: unknown,
  { parameters }: CreateDraftJobParams,
): Promise<CreateDraftJobResult> => {
  // 既存の下書きを確認（1件制限）
  const existingDraft = db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "draft"), eq(jobs.type, "preprocess")))
    .get();

  if (existingDraft) {
    // 既存下書きは中身を保持したまま ID を返す（上書きしない）。
    // 新規開始の導線は名寄せ一覧の下書き確認ダイアログを通り、新規作成時は
    // 事前に下書きを削除する。よってここに既存下書きが残るのは再開系の経路で、
    // 上書きすると進行中の入力を失うため行わない。目的は新規作成（下書き不在）時に保存される。
    mainProcessLogger.info(
      `Existing draft job found: ${existingDraft.id}, returning existing`,
    );
    return {
      jobId: existingDraft.id,
      isExisting: true,
    };
  }

  // 新規下書きを作成
  const { jobId } = db
    .insert(jobs)
    .values({
      status: "draft",
      type: "preprocess",
      is_named: false,
      parameters,
    })
    .returning({
      jobId: jobs.id,
    })
    .get();

  mainProcessLogger.info(`Created new draft job: ${jobId}`);

  return {
    jobId,
    isExisting: false,
  };
}) satisfies IpcMainListener;
