import path from "path";
import { readFileSync, existsSync } from "fs";
import { dbDirectory } from "../../../db/client";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../ipc-main-listeners";

/**
 * ジョブ単位のパイプライン実行ログ（logs.txt）を返す（NR007 証跡DL同梱用）。
 * 出力先は dbDirectory/logs/job_<jobId>/logs.txt（Python の get_rotating_logger）。
 * ログ未生成（旧ジョブ・処理中・エラー前）の場合は空文字を返す。
 */
export const selectJobLog = (async (
  _: unknown,
  { jobId }: { jobId: number },
): Promise<string> => {
  try {
    if (!Number.isInteger(jobId) || jobId < 0) return "";
    const logPath = path.join(dbDirectory, "logs", `job_${jobId}`, "logs.txt");
    if (!existsSync(logPath)) return "";
    return readFileSync(logPath, "utf-8");
  } catch (error) {
    mainProcessLogger.error(`Failed to read job log: ${jobId}`, error as Error);
    return "";
  }
}) satisfies IpcMainListener;
