import { ipcRenderer, contextBridge, type IpcRendererEvent } from "electron";
import { type ipcMainListeners } from "./ipc-main-listeners";
import {
  CSV_IMPORT_PROGRESS_CHANNEL,
  type CsvImportProgress,
} from "./shared/csv-import-progress";
import { type IpcResponse } from "./shared/utils/ipc-error-handler";
import { type LogEntry } from "./shared/utils/renderer-logger";

type AllowedChannel = keyof typeof ipcMainListeners;

type InvokeArgs<K extends AllowedChannel> = Parameters<
  (typeof ipcMainListeners)[K]
>[1];

type IsOptional<T> = undefined extends T ? true : false;

/** CSVインポート進捗リスナーの型 */
type CsvImportProgressListener = (progress: CsvImportProgress) => void;

/** 登録済みリスナーのマップ（cleanup用） */
const csvImportProgressListeners = new Map<
  CsvImportProgressListener,
  (event: IpcRendererEvent, progress: CsvImportProgress) => void
>();

const api = {
  invoke: async <K extends AllowedChannel>(
    channel: K,
    ...args: IsOptional<InvokeArgs<K>> extends true // Is the argument optional?
      ? [InvokeArgs<K>?] // If so, wrap it in an array and make it optional
      : InvokeArgs<K> extends undefined // Is the argument undefined?
        ? [] // If so, pass an empty array
        : [InvokeArgs<K>] // Otherwise, wrap it in an array
  ): Promise<Awaited<ReturnType<(typeof ipcMainListeners)[K]>>> => {
    try {
      const response: IpcResponse<
        Awaited<ReturnType<(typeof ipcMainListeners)[K]>>
      > = await ipcRenderer.invoke(channel, ...args);

      if (!response.success) {
        // エラーレスポンスの場合はErrorオブジェクトとしてthrow
        const error = new Error(response.error.message);
        (error as { code?: string }).code = response.error.code;
        (error as { details?: unknown }).details = response.error.details;
        throw error;
      }

      return response.data;
    } catch (error) {
      // IPC通信自体のエラー（ネットワークエラー等）
      if (error instanceof Error) {
        // eslint-disable-next-line no-console -- preloadプロセスでのIPC通信エラーのため必要
        console.error(
          `IPC communication failed for channel: ${channel}`,
          error,
        );
        throw error;
      } else {
        // 予期しないエラー
        const unknownError = new Error(
          `Unknown IPC error for channel: ${channel}`,
        );
        // eslint-disable-next-line no-console -- preloadプロセスでの未知エラーのため必要
        console.error(`Unknown IPC error for channel: ${channel}`, error);
        throw unknownError;
      }
    }
  },
  writeRendererLogs: async ({ logs }: { logs: LogEntry[] }): Promise<void> => {
    await ipcRenderer.invoke("writeRendererLogs", { logs });
  },
  /** CSVインポート進捗リスナーを登録 */
  onCsvImportProgress: (listener: CsvImportProgressListener): void => {
    const wrappedListener = (
      _event: IpcRendererEvent,
      progress: CsvImportProgress,
    ): void => {
      listener(progress);
    };
    csvImportProgressListeners.set(listener, wrappedListener);
    ipcRenderer.on(CSV_IMPORT_PROGRESS_CHANNEL, wrappedListener);
  },
  /** CSVインポート進捗リスナーを解除 */
  offCsvImportProgress: (listener: CsvImportProgressListener): void => {
    const wrappedListener = csvImportProgressListeners.get(listener);
    if (wrappedListener) {
      ipcRenderer.removeListener(CSV_IMPORT_PROGRESS_CHANNEL, wrappedListener);
      csvImportProgressListeners.delete(listener);
    }
  },
};

// contextBridge設定のエラーハンドリング
try {
  contextBridge.exposeInMainWorld("ipcRenderer", api);
  // eslint-disable-next-line no-console -- preloadスクリプトでの成功ログのため必要
  console.log("IPC API exposed to renderer process successfully");
} catch (error) {
  // eslint-disable-next-line no-console -- preloadスクリプトでのエラーログのため必要
  console.error("Failed to expose IPC API to renderer process:", error);
  // preloadスクリプトでのエラーはrendererには伝わらないため、
  // ここでは最低限のログ出力のみ行う
}

declare global {
  interface Window {
    ipcRenderer: typeof api;
  }
}
