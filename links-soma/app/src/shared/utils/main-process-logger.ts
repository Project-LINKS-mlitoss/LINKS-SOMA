import { app, dialog } from "electron";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

/**
 * Main Processでのエラーログレベル
 */
export type LogLevel = "error" | "warn" | "info" | "debug";

// ANSI色コード定義
const Colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m", // エラー用（赤）
  yellow: "\x1b[33m", // 警告用（黄）
  blue: "\x1b[34m", // 情報用（青）
  gray: "\x1b[90m", // デバッグ用（グレー）
} as const;

/**
 * Main Processエラーログ出力機能
 */
class MainProcessLogger {
  private readonly logDir: string;
  private readonly logFile: string;
  private readonly isDev = process.env.NODE_ENV === "development";

  constructor() {
    // ログディレクトリをアプリのユーザーデータディレクトリに設定
    this.logDir = join(app.getPath("userData"), "logs");
    this.logFile = join(this.logDir, "main-process.log");
    // ログの配置場所をコンソールに出力
    // eslint-disable-next-line no-console -- ログファイルの場所を知らせるために必要
    console.log("Log file location:", this.logFile);

    // ログディレクトリが存在しない場合は作成
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatColoredMessage(level: LogLevel, message: string): string {
    const prefix = `[MainProcess]`;
    switch (level) {
      case "error":
        return `${Colors.red}${prefix} ${message}${Colors.reset}`;
      case "warn":
        return `${Colors.yellow}${prefix} ${message}${Colors.reset}`;
      case "info":
        return `${Colors.blue}${prefix} ${message}${Colors.reset}`;
      case "debug":
        return `${Colors.gray}${prefix} ${message}${Colors.reset}`;
      default:
        return `${prefix} ${message}`;
    }
  }

  /**
   * ログエントリを作成
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    error?: Error,
  ): string {
    const timestamp = new Date().toISOString();
    const errorDetails = error
      ? `\nError: ${error.message}\nStack: ${error.stack}`
      : "";

    return `[${timestamp}] [${level.toUpperCase()}] ${message}${errorDetails}\n`;
  }

  /**
   * ログをファイルに出力
   */
  private writeLog(entry: string): void {
    try {
      writeFileSync(this.logFile, entry, { flag: "a", encoding: "utf-8" });
    } catch (writeError) {
      // ログファイル書き込みに失敗した場合はコンソールに出力
      // eslint-disable-next-line no-console -- ログファイル書き込み失敗時のフォールバック
      console.error("Failed to write log file:", writeError);
      // eslint-disable-next-line no-console -- ログファイル書き込み失敗時のフォールバック
      console.log("Log entry:", entry);
    }
  }

  /**
   * エラーログを出力
   */
  error(message: string, error?: Error): void {
    const entry = this.createLogEntry("error", message, error);
    this.writeLog(entry);

    // 開発環境でのみコンソールにカラーログを出力
    if (this.isDev) {
      // eslint-disable-next-line no-console -- Main processログ出力のため必要
      console.error(this.formatColoredMessage("error", message), error);
    }
  }

  /**
   * 警告ログを出力
   */
  warn(message: string, error?: Error): void {
    const entry = this.createLogEntry("warn", message, error);
    this.writeLog(entry);

    // 開発環境でのみコンソールにカラーログを出力
    if (this.isDev) {
      // eslint-disable-next-line no-console -- Main processログ出力のため必要
      console.warn(this.formatColoredMessage("warn", message), error);
    }
  }

  /**
   * 情報ログを出力
   */
  info(message: string, info?: unknown): void {
    const entry = this.createLogEntry("info", message);
    this.writeLog(entry);

    // 開発環境でのみコンソールにカラーログを出力
    if (this.isDev) {
      if (info !== undefined)
        // eslint-disable-next-line no-console -- Main processログ出力のため必要
        console.log(this.formatColoredMessage("info", message), info);
      // eslint-disable-next-line no-console -- Main processログ出力のため必要
      else console.log(this.formatColoredMessage("info", message));
    }
  }

  /**
   * デバッグログを出力
   */
  debug(message: string): void {
    const entry = this.createLogEntry("debug", message);
    this.writeLog(entry);

    // 開発環境でのみコンソールにデバッグログを出力
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- Main processログ出力のため必要
      console.debug(`[MAIN] ${message}`);
    }
  }

  /**
   * 致命的エラーをユーザーに表示
   */
  async showFatalError(
    title: string,
    message: string,
    error?: Error,
  ): Promise<void> {
    this.error(`Fatal error: ${title} - ${message}`, error);

    // 致命的エラーは環境に関係なくコンソールにも出力
    // eslint-disable-next-line no-console -- 致命的エラーのため常に出力が必要
    console.error(`[MAIN FATAL] ${title}: ${message}`, error);

    await dialog.showErrorBox(
      title,
      `${message}\n\n詳細はログファイルを確認してください。\nログ場所: ${this.logFile}`,
    );
  }

  /**
   * ログファイルパスを取得
   */
  getLogFilePath(): string {
    return this.logFile;
  }
}

// シングルトンインスタンスをエクスポート
export const mainProcessLogger = new MainProcessLogger();
