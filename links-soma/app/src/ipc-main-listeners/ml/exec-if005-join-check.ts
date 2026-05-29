import { spawn } from "child_process";
import { eq } from "drizzle-orm";
import {
  type JoinCheckParameters,
  type DraftPreprocessParameters,
} from "../../shared/types/job-parameters";
import { db, dbDirectory, dbPath } from "../../db/client";
import { jobs } from "../../db/schema";
import { deleteJobById } from "../../features/job/util/delete-job-with-cascade";
import { mainProcessLogger } from "../../shared/utils/main-process-logger";
import { setupMLProcessHandlers } from "../../shared/utils/ml-process-handler";
import { binaryPath, type IpcMainListener } from "..";
import { startJobProcess } from "./_start-job-process";

/**
 * IF005: 住所の表記ゆれチェック機能の呼び出し
 *
 * 各データセットの住所が水道データに結合できるかを事前チェックする。
 * Python側でE012（住所正規化）→ E017（レーベンシュタイン距離マッチング）を実行し、
 * 結合率・未結合レコード・類似候補を計算してjob_tasksに保存する。
 *
 * @param parameters - 住所の表記ゆれチェックパラメータ
 * @param draftJobId - 下書きjobのID（指定時はjoinCheckJobIdを更新）
 * @returns jobId（成功時）またはnull（失敗時）
 */
export const execIF005JoinCheck = (async (
  _: unknown,
  {
    parameters,
    draftJobId,
  }: {
    parameters: JoinCheckParameters;
    draftJobId?: number;
  },
): Promise<{ jobId: number } | null> => {
  try {
    const baseParameters = {
      ...parameters,
      output_path: dbDirectory,
      database_path: dbPath,
    };

    // draftJobIdが指定されている場合、一度だけ取得
    const draftJob =
      draftJobId !== undefined
        ? db.select().from(jobs).where(eq(jobs.id, draftJobId)).get()
        : undefined;

    const isDraftPreprocess =
      draftJob?.status === "draft" && draftJob.type === "preprocess";

    // 古いjoinCheckJobを削除
    if (isDraftPreprocess) {
      const params = draftJob.parameters as DraftPreprocessParameters;
      const oldJoinCheckJobId = params.joinCheckJobId;
      if (oldJoinCheckJobId) {
        mainProcessLogger.info(
          `Deleting old joinCheckJob: ${oldJoinCheckJobId}`,
        );

        await db.transaction(async (tx) => {
          await deleteJobById(tx, oldJoinCheckJobId);
        });
      }
    }

    const jobProcess = await startJobProcess({
      jobType: "join_check",
      parameters: baseParameters,
    });

    if (jobProcess.status !== "success") {
      mainProcessLogger.error(
        "Job process start failed",
        new Error("execIF005JoinCheck: join_check job failed to start"),
      );
      return null;
    }

    // joinCheckJobIdを更新
    if (isDraftPreprocess && draftJobId !== undefined) {
      const updatedParams: DraftPreprocessParameters = {
        ...(draftJob.parameters as DraftPreprocessParameters),
        joinCheckJobId: jobProcess.data.jobId,
      };

      await db
        .update(jobs)
        .set({ parameters: updatedParams })
        .where(eq(jobs.id, draftJobId))
        .run();

      mainProcessLogger.info(
        `Updated draftJob ${draftJobId} with joinCheckJobId: ${jobProcess.data.jobId}`,
      );
    }

    mainProcessLogger.info(
      `Starting execIF005JoinCheck with parameters:`,
      JSON.stringify(baseParameters, null, 2),
    );

    // Pythonプロセスをバックグラウンドで起動
    const cp = spawn(
      binaryPath("IF005"),
      [
        "--parameters",
        JSON.stringify(
          JSON.stringify({
            ...baseParameters,
            job_id: jobProcess.data.jobId,
          }),
        ),
      ],
      {
        detached: true,
      },
    );

    setupMLProcessHandlers(cp, jobProcess.data.jobId);

    return { jobId: jobProcess.data.jobId };
  } catch (error) {
    mainProcessLogger.error("execIF005JoinCheck failed", error as Error);
    return null;
  }
}) satisfies IpcMainListener;
