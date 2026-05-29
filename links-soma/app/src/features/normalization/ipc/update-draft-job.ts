import { eq } from "drizzle-orm";
import { type DraftPreprocessParameters } from "../../../shared/types/job-parameters";
import { db } from "../../../db/client";
import { jobs } from "../../../db/schema";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type UpdateDraftJobParams = {
  id: number;
  parameters: DraftPreprocessParameters;
};

/**
 * 下書きjobのparametersを更新する（自動保存用）
 *
 * 注意: joinCheckJobIdは住所の表記ゆれチェック実行時に別途設定されるため、
 * 自動保存時は既存の値を保持してマージする
 */
export const updateDraftJob = (async (
  _: unknown,
  { id, parameters }: UpdateDraftJobParams,
): Promise<void> => {
  // 既存のparametersを取得してjoinCheckJobIdを保持
  const existing = db.select().from(jobs).where(eq(jobs.id, id)).get();
  const existingParams = existing?.parameters as
    | DraftPreprocessParameters
    | undefined;

  const mergedParameters: DraftPreprocessParameters = {
    ...parameters,
    // 既存のjoinCheckJobIdを保持（渡された値があればそちらを優先）
    joinCheckJobId: parameters.joinCheckJobId ?? existingParams?.joinCheckJobId,
  };

  await db
    .update(jobs)
    .set({
      parameters: mergedParameters,
    })
    .where(eq(jobs.id, id))
    .run();

  mainProcessLogger.debug(`Updated draft job: ${id}`);
}) satisfies IpcMainListener;
