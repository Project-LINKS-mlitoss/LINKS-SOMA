import { spawn } from "child_process";
import { dbDirectory, dbPath } from "../../db/client";
import { binaryPath, type IpcMainListener } from "..";
import { mainProcessLogger } from "../../shared/utils/main-process-logger";
import { setupMLProcessHandlers } from "../../shared/utils/ml-process-handler";
import { type ExportParameters } from "../../shared/types/job-parameters";
import { startJobProcess } from "./_start-job-process";

/** IF004:データ出力機能の呼び出し */
export const exportData = (async (
  _: unknown,
  params: {
    data: ExportParameters;
  },
): Promise<boolean> => {
  const { data } = params;

  try {
    const baseParameters = {
      ...data,
      output_path: dbDirectory,
      database_path: dbPath,
    };

    const jobProcess = await startJobProcess({
      jobType: "export",
      parameters: baseParameters,
    });

    if (jobProcess.status !== "success") {
      throw new Error("Job process start failed");
    }

    // childProcessに入れてバックグラウンド実行
    const cp = spawn(
      binaryPath("IF004"),
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
    mainProcessLogger.error("Export data process failed", error as Error);
    throw new Error("Export data process failed");
  }
}) satisfies IpcMainListener;
