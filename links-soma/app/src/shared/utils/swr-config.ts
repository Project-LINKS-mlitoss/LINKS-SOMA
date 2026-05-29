import { type SWRConfiguration } from "swr";

/**
 * 注意: dev / prod の数値差分 (dedupingInterval 5s/10s, errorRetryInterval 1s/2s など) は
 * HTTP API 向け SWR 慣習を踏襲したもので、Electron + ローカル SQLite (<1ms) 文脈での
 * 測定根拠はない。stale cache が UX バグを起こす hook では pub/sub を使う (ADR-0020)。
 * 将来的にこの差分自体の再評価候補。
 */

/**
 * 開発環境用のSWR設定
 */
const developmentConfig: SWRConfiguration = {
  errorRetryCount: 2,
  errorRetryInterval: 1000,
  dedupingInterval: 5000,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  onError: (error, key) => {
    const errorWithDetails = error as Error & {
      code?: string;
      ipcChannel?: string;
      details?: unknown;
    };

    // eslint-disable-next-line no-console -- SWRエラーログのため必要
    console.error(`[SWR Error] Key: ${key}`, {
      message: errorWithDetails.message,
      code: errorWithDetails.code,
      ipcChannel: errorWithDetails.ipcChannel,
      details: errorWithDetails.details,
      stack: errorWithDetails.stack,
    });
  },
  onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
    // 致命的なエラーはリトライしない
    if (
      (error as Error & { code?: string }).code === "DB_CONNECTION_FAILED" ||
      (error as Error & { code?: string }).code === "PERMISSION_DENIED"
    ) {
      return;
    }

    // 最大リトライ回数をチェック
    if (retryCount >= 2) {
      return;
    }

    // eslint-disable-next-line no-console -- SWR retryログのため必要
    console.warn(`[SWR Retry] Retrying ${key} (attempt ${retryCount + 1})`);

    // 指数バックオフでリトライ
    setTimeout(
      () => {
        void revalidate({ retryCount });
      },
      1000 * Math.pow(2, retryCount),
    );
  },
};

/**
 * 本番環境用のSWR設定
 */
const productionConfig: SWRConfiguration = {
  errorRetryCount: 2,
  errorRetryInterval: 2000,
  dedupingInterval: 10000,
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
    // 致命的なエラーはリトライしない
    if (
      (error as Error & { code?: string }).code === "DB_CONNECTION_FAILED" ||
      (error as Error & { code?: string }).code === "PERMISSION_DENIED"
    ) {
      return;
    }

    // 最大リトライ回数をチェック
    if (retryCount >= 2) {
      return;
    }

    // 指数バックオフでリトライ
    setTimeout(
      () => {
        void revalidate({ retryCount });
      },
      2000 * Math.pow(2, retryCount),
    );
  },
};

/**
 * 環境に応じたSWR設定を取得
 */
export function getSWRConfig(): SWRConfiguration {
  return process.env.NODE_ENV === "development"
    ? developmentConfig
    : productionConfig;
}
