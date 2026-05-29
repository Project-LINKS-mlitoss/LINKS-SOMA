import { type ChildProcessWithoutNullStreams } from "child_process";
import { eq } from "drizzle-orm";
import { jobs, job_tasks, type SelectJob } from "../../db/schema";
import { db } from "../../db/client";
import { mainProcessLogger } from "./main-process-logger";

type ErrorCode = "SPAWN_ERROR" | "PROCESS_EXIT" | "UNKNOWN_ERROR";

/** シグナル別の日本語メッセージ */
const SIGNAL_MESSAGES: Record<string, string> = {
  SIGTERM: "プロセスが終了されました",
  SIGKILL: "プロセスが強制終了されました",
  SIGSEGV: "メモリエラーで終了しました",
  SIGINT: "プロセスが中断されました",
  SIGABRT: "プロセスが異常終了しました",
};

/** spawnエラー用の日本語メッセージを生成 */
const getSpawnErrorMessage = (errorMessage: string): string => {
  if (errorMessage.includes("ENOENT")) {
    return "実行ファイルが見つかりません";
  }
  if (errorMessage.includes("EACCES")) {
    return "実行権限がありません";
  }
  return `起動に失敗しました (${errorMessage})`;
};

/** exit用の日本語メッセージを生成 */
const getExitErrorMessage = (
  code: number | null,
  signal: string | null,
): string => {
  if (code !== null) {
    return `プロセスが異常終了しました (code ${code})`;
  }
  if (signal) {
    const signalMsg = SIGNAL_MESSAGES[signal] ?? "プロセスが異常終了しました";
    return `${signalMsg} (${signal})`;
  }
  return "プロセスが異常終了しました";
};

/**
 * jobのステータスをerrorに更新し、job_tasksにエラー情報を記録する
 *
 * Python側で既にerrorに更新されている場合はスキップする（二重更新防止）
 */
const updateJobToError = async (
  jobId: number,
  errorCode: ErrorCode,
  errorMsg: string,
): Promise<void> => {
  try {
    // 現在のステータスを確認（Python側で既に更新されている場合はスキップ）
    const currentJob = db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .get();

    if (!currentJob) {
      mainProcessLogger.warn(
        `updateJobToError: job not found - jobId: ${jobId}`,
      );
      return;
    }

    // 既にerrorまたはcompleteの場合はスキップ
    if (currentJob.status === "error" || currentJob.status === "complete") {
      mainProcessLogger.info(
        `updateJobToError: skipped (already ${currentJob.status}) - jobId: ${jobId}`,
      );
      return;
    }

    // トランザクションでjobとjob_tasksを更新
    db.transaction((tx) => {
      // jobsテーブルのstatusをerrorに更新
      tx.update(jobs)
        .set({ status: "error" as SelectJob["status"] })
        .where(eq(jobs.id, jobId))
        .run();

      // job_tasksにエラー情報を記録
      tx.insert(job_tasks)
        .values({
          job_id: jobId,
          error_code: "undefined_error", // スキーマで定義されているenum値
          error_msg: `${errorMsg} [${errorCode}]`,
          progress_percent: "0",
        })
        .run();
    });

    mainProcessLogger.info(
      `updateJobToError: job updated to error - jobId: ${jobId}, errorCode: ${errorCode}`,
    );
  } catch (error) {
    mainProcessLogger.error(
      `updateJobToError failed - jobId: ${jobId}`,
      error as Error,
    );
  }
};

/**
 * MLプロセスのイベントハンドラーを設定
 *
 * - stdout/stderrをログに転送
 * - spawn失敗（バイナリ不存在等）を検知してjobをerrorに更新
 * - プロセス異常終了を検知してjobをerrorに更新
 * - Python側で既にerror更新済みの場合はスキップ（二重更新防止）
 */
export const setupMLProcessHandlers = (
  cp: ChildProcessWithoutNullStreams,
  jobId: number,
): void => {
  // stdout/stderrをログに転送
  cp.stdout.on("data", (data) => {
    const message = `[ML Process stdout] ${data.toString().trim()}`;
    mainProcessLogger.info(message);
  });

  cp.stderr.on("data", (data) => {
    const message = `[ML Process stderr] ${data.toString().trim()}`;
    mainProcessLogger.error(message);
  });

  // spawn自体の失敗（バイナリが見つからない、権限エラー等）
  cp.on("error", (error) => {
    mainProcessLogger.error(
      `[ML Process] spawn error - jobId: ${jobId}`,
      error,
    );
    updateJobToError(
      jobId,
      "SPAWN_ERROR",
      getSpawnErrorMessage(error.message),
    ).catch((e) => {
      mainProcessLogger.error("updateJobToError: unexpected error", e as Error);
    });
  });

  // プロセスの終了（正常・異常問わず）
  cp.on("exit", (code, signal) => {
    if (code === 0) {
      // 正常終了
      mainProcessLogger.info(
        `[ML Process] exited successfully - jobId: ${jobId}`,
      );
    } else {
      // 異常終了: exit code !== 0 または シグナル終了（code === null）
      // Python側でerror更新されなかった場合のフォールバック
      const exitInfo =
        code !== null ? `code ${code}` : `signal ${signal ?? "unknown"}`;
      mainProcessLogger.warn(
        `[ML Process] exited abnormally (${exitInfo}) - jobId: ${jobId}`,
      );
      updateJobToError(
        jobId,
        "PROCESS_EXIT",
        getExitErrorMessage(code, signal),
      ).catch((e) => {
        mainProcessLogger.error(
          "updateJobToError: unexpected error",
          e as Error,
        );
      });
    }
  });
};
