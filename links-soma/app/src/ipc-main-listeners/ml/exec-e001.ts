import { spawn } from "child_process";
import { eq } from "drizzle-orm";
import { db, dbDirectory, dbPath } from "../../db/client";
import { jobs } from "../../db/schema";
import { binaryPath, type IpcMainListener } from "..";
import { setupMLProcessHandlers } from "../../shared/utils/ml-process-handler";
import { type PreprocessParameters } from "../../shared/types/job-parameters";
import { mainProcessLogger } from "../../shared/utils/main-process-logger";
import { startJobProcess } from "./_start-job-process";

/**
 * IF001:名寄せ処理機能の呼び出し
 *
 * @param parameters - 名寄せ処理パラメータ
 * @param jobId - 既存の下書きjobId（指定時はそのjobを更新して実行）
 */
export const execE001 = (async (
  _: unknown,
  {
    parameters,
    jobId,
  }: {
    parameters: PreprocessParameters;
    jobId?: number;
  },
): Promise<true | false> => {
  try {
    const baseParameters = {
      ...parameters,
      output_path: dbDirectory,
      database_path: dbPath,
    };

    let targetJobId: number;

    if (jobId) {
      // 既存の下書きjobを更新して使用
      await db
        .update(jobs)
        .set({
          status: "", // draft → 実行中に変更
          parameters: baseParameters,
        })
        .where(eq(jobs.id, jobId))
        .run();

      targetJobId = jobId;
      mainProcessLogger.info(`Using existing draft job: ${jobId}`);
    } else {
      // 新規jobを作成
      const jobProcess = await startJobProcess({
        jobType: "preprocess",
        parameters: baseParameters,
      });

      if (jobProcess.status !== "success") {
        mainProcessLogger.error(
          "Job process start failed",
          new Error("execE001: preprocess job failed to start"),
        );
        return false;
      }

      targetJobId = jobProcess.data.jobId;
    }

    mainProcessLogger.info(
      `Starting execE001 with parameters:`,
      JSON.stringify(baseParameters, null, 2),
    );

    // childProcessに入れてバックグラウンド実行
    const cp = spawn(
      binaryPath("IF001"),
      [
        "--parameters",
        JSON.stringify(
          JSON.stringify({
            ...baseParameters,
            job_id: targetJobId,
          }),
        ),
      ],
      {
        detached: true,
      },
    );

    setupMLProcessHandlers(cp, targetJobId);

    return true;
  } catch (error) {
    mainProcessLogger.error("execE001 failed", error as Error);
    return false;
  }
}) satisfies IpcMainListener;
