import { spawn } from "child_process";
import { dbDirectory, dbPath } from "../../../db/client";
import { binaryPath, type IpcMainListener } from "../../../ipc-main-listeners";
import { setupMLProcessHandlers } from "../../../shared/utils/ml-process-handler";
import { type ResultParameters } from "../../../shared/types/job-parameters";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { startJobProcess } from "../../../ipc-main-listeners/ml/_start-job-process";

type Params = {
  data: ResultParameters;
};

/** IF003:空き家推定機能の呼び出し */
export const evaluateData = (async (
  _: unknown,
  params: Params,
): Promise<boolean> => {
  const { data } = params;

  try {
    const baseParameters = {
      ...data,
      output_path: dbDirectory,
      database_path: dbPath,
    };

    const jobProcess = await startJobProcess({
      jobType: "result",
      parameters: baseParameters,
    });

    if (jobProcess.status !== "success") {
      mainProcessLogger.error(
        "Job process start failed",
        new Error("evaluateData: result job failed to start"),
      );
      return false;
    }

    // childProcessに入れてバックグラウンド実行
    const cp = spawn(
      binaryPath("IF003"),
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

    return true;
  } catch (error) {
    mainProcessLogger.error("evaluateData failed", error as Error);
    return false;
  }
}) satisfies IpcMainListener;
