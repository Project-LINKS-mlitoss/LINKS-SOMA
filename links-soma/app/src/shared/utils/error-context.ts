/**
 * エラーコード定義
 */
export enum ErrorCode {
  // データベース関連
  DB_QUERY_FAILED = "DB_QUERY_FAILED",
}

/**
 * コンテキスト付きエラークラス
 * 開発環境では詳細なコンテキスト情報を提供
 */
export class ContextualError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: unknown;
  public readonly timestamp: string;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.DB_QUERY_FAILED,
    context?: unknown,
  ) {
    const isDev = process.env.NODE_ENV === "development";

    // 開発環境では詳細なメッセージを構築
    if (isDev && context) {
      const contextStr = JSON.stringify(context, null, 2);
      super(`[${code}] ${message}\nContext: ${contextStr}`);
    } else {
      super(message);
    }

    this.name = "ContextualError";
    this.code = code;
    this.timestamp = new Date().toISOString();

    // 開発環境でのみコンテキストを保持
    if (isDev) {
      this.context = context;
    }

    // スタックトレースを正しく設定
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextualError);
    }
  }
}
