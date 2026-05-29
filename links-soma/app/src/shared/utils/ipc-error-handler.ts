import { type IpcMainInvokeEvent } from "electron";
import { type IpcMainListener } from "../../ipc-main-listeners";
import { mainProcessLogger } from "./main-process-logger";
import { ipcPerformanceMonitor } from "./ipc-performance-monitor";

/**
 * IPCエラーレスポンス型
 */
export interface IpcErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

/**
 * IPC成功レスポンス型
 */
export interface IpcSuccessResponse<T = unknown> {
  success: true;
  data: T;
}

/**
 * IPC統一レスポンス型
 */
export type IpcResponse<T = unknown> = IpcSuccessResponse<T> | IpcErrorResponse;

/**
 * IPCエラーハンドリングラッパー
 * 全てのIPCリスナーに統一的なエラーハンドリングを適用
 */
export const withIpcErrorHandling = (
  channel: string,
  listener: IpcMainListener,
): IpcMainListener => {
  return async (
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ): Promise<IpcResponse> => {
    const startTime = Date.now();
    const isDev = process.env.NODE_ENV === "development";

    try {
      // 頻繁に呼び出されるIPCチャンネルはデバッグログを制限
      const isFrequentCall = [
        "selectBuildingsChunk",
        "selectAreasInBatches",
        "selectBuildingsWithPagination",
        "selectAreasWithPagination",
      ].includes(channel);

      // 開発環境での詳細ログ
      if (isDev && !isFrequentCall) {
        mainProcessLogger.debug(
          `[IPC] ${channel} called with arguments: ${args.length > 0 ? JSON.stringify(args, null, 2).slice(0, 500) : "none"}`,
        );
      } else if (!isFrequentCall) {
        mainProcessLogger.debug(`IPC call started: ${channel}`);
      }

      // 元のリスナーを実行
      const result = await listener(event, ...args);

      const duration = Date.now() - startTime;

      // パフォーマンス監視に記録
      ipcPerformanceMonitor.recordCall(channel, duration);

      // パフォーマンス問題のあるIPCコールのみ警告
      if (duration > 100) {
        if (isDev) {
          mainProcessLogger.warn(
            `[SLOW] ${channel} took ${duration}ms (threshold: 100ms)`,
            new Error(
              `Args: ${args.length > 0 ? JSON.stringify(args).slice(0, 200) : "none"}`,
            ),
          );
        } else {
          mainProcessLogger.warn(`Slow IPC call: ${channel} (${duration}ms)`);
        }
      } else if (isDev && !isFrequentCall) {
        mainProcessLogger.debug(`[IPC] ${channel} completed in ${duration}ms`);
      } else if (!isFrequentCall) {
        mainProcessLogger.debug(
          `IPC call completed: ${channel} (${duration}ms)`,
        );
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorObj = error as Error;

      // 開発環境での詳細エラーログ
      if (isDev) {
        const contextError = new Error(
          `Code: ${(errorObj as { code?: string }).code || "unknown"}, ` +
            `Args: ${args.length > 0 ? JSON.stringify(args, null, 2).slice(0, 1000) : "none"}, ` +
            `Type: ${errorObj.constructor.name}`,
        );
        contextError.stack = errorObj.stack;
        mainProcessLogger.error(
          `[IPC ERROR] ${channel} failed after ${duration}ms: ${errorObj.message}`,
          contextError,
        );
      } else {
        mainProcessLogger.error(
          `IPC call failed: ${channel} (${duration}ms)`,
          errorObj,
        );
      }

      // エラーレスポンスを返す
      return {
        success: false,
        error: {
          message: errorObj.message || "Unknown IPC error",
          code: (errorObj as { code?: string }).code,
          details: isDev
            ? {
                stack: errorObj.stack,
                channel,
                duration: `${duration}ms`,
                timestamp: new Date().toISOString(),
              }
            : undefined,
        },
      };
    }
  };
};

/**
 * IPCタイムアウトハンドリング
 * 長時間実行されるIPCコールにタイムアウトを適用
 */
export const withIpcTimeout = (
  timeoutMs: number,
  listener: IpcMainListener,
): IpcMainListener => {
  return async (
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ): Promise<unknown> => {
    return Promise.race([
      listener(event, ...args),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`IPC call timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  };
};

/**
 * 引数バリデーション付きIPCハンドラー
 */
export const withIpcValidation = <TArgs extends unknown[]>(
  validator: (args: unknown[]) => args is TArgs,
  errorMessage: string,
  listener: (event: IpcMainInvokeEvent, ...args: TArgs) => unknown,
): IpcMainListener => {
  return async (
    event: IpcMainInvokeEvent,
    ...args: unknown[]
  ): Promise<unknown> => {
    if (!validator(args)) {
      throw new Error(`Invalid arguments: ${errorMessage}`);
    }

    return listener(event, ...args);
  };
};
