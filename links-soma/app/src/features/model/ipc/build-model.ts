import { spawn } from "child_process";
import { dbDirectory, dbPath } from "../../../db/client";
import { binaryPath, type IpcMainListener } from "../../../ipc-main-listeners";
import { setupMLProcessHandlers } from "../../../shared/utils/ml-process-handler";
import { type ModelCreateParameters } from "../../../shared/types/job-parameters";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { startJobProcess } from "../../../ipc-main-listeners/ml/_start-job-process";

type Params = {
  data: ModelCreateParameters;
};

/**
 * IF002:モデル構築機能の呼び出し
 *
 * 成功時は作成したジョブ id を返す。ガイド進行中はこの id を進行状態バッジに使う（ADR-0024）。
 * 失敗時は null（呼び出し側はジョブ未作成として扱う）。
 */
export const buildModel = (async (
  _: unknown,
  params: Params,
): Promise<number | null> => {
  const { data } = params;

  try {
    const baseParameters = {
      ...data,
      output_path: dbDirectory,
      database_path: dbPath,
    };

    const jobProcess = await startJobProcess({
      jobType: "ml",
      parameters: baseParameters,
    });

    if (jobProcess.status !== "success") {
      mainProcessLogger.error(
        "Job process start failed",
        new Error("buildModel: ML job failed to start"),
      );
      return null;
    }

    // childProcessに入れてバックグラウンド実行
    const cp = spawn(
      binaryPath("IF002"),
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

    return jobProcess.data.jobId;
  } catch (error) {
    mainProcessLogger.error("buildModel failed", error as Error);
    return null;
  }
}) satisfies IpcMainListener;
