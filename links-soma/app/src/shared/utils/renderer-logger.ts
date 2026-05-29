export type LogLevel = "error" | "warn" | "info" | "debug";

export interface LogEntry {
  level: LogLevel;
  message: string;
  error?: unknown;
  context?: unknown;
  timestamp: string;
}

class RendererLogger {
  private buffer: LogEntry[] = [];
  private readonly maxBufferSize = 50;
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly flushInterval = 2000; // 2秒
  private readonly isDev = process.env.NODE_ENV === "development";

  constructor() {
    this.startPeriodicFlush();
  }

  error(message: string, error?: unknown, context?: unknown): void {
    if (this.isDev) {
      // eslint-disable-next-line no-console -- 開発環境でのRendererログ出力のため必要
      console.error(`[Renderer] ${message}`, error, context);
    }
    this.addToBuffer("error", message, error, context);
  }

  warn(message: string, error?: unknown, context?: unknown): void {
    if (this.isDev) {
      // eslint-disable-next-line no-console -- 開発環境でのRendererログ出力のため必要
      console.warn(`[Renderer] ${message}`, error, context);
    }
    this.addToBuffer("warn", message, error, context);
  }

  info(message: string, context?: unknown): void {
    if (this.isDev) {
      // eslint-disable-next-line no-console -- 開発環境でのRendererログ出力のため必要
      console.log(`[Renderer] ${message}`, context);
    }
    this.addToBuffer("info", message, undefined, context);
  }

  debug(message: string, context?: unknown): void {
    if (this.isDev) {
      // eslint-disable-next-line no-console -- 開発環境でのRendererログ出力のため必要
      console.debug(`[Renderer] ${message}`, context);
    }
    this.addToBuffer("debug", message, undefined, context);
  }

  private addToBuffer(
    level: LogLevel,
    message: string,
    error?: unknown,
    context?: unknown,
  ): void {
    const logEntry: LogEntry = {
      level,
      message,
      error,
      context,
      timestamp: new Date().toISOString(),
    };

    this.buffer.push(logEntry);

    if (this.buffer.length >= this.maxBufferSize) {
      void this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const logsToFlush = [...this.buffer];
    this.buffer = [];

    try {
      if (window.ipcRenderer?.writeRendererLogs) {
        await window.ipcRenderer.writeRendererLogs({ logs: logsToFlush });
      }
    } catch (error) {
      // フラッシュに失敗した場合は開発環境でのみコンソールに出力
      if (this.isDev) {
        // eslint-disable-next-line no-console -- ログフラッシュ失敗時のフォールバック
        console.error("[RendererLogger] Failed to flush logs:", error);
      }
      // 失敗したログをバッファに戻す（最大サイズを超えないように制限）
      this.buffer = [
        ...logsToFlush.slice(-this.maxBufferSize / 2),
        ...this.buffer,
      ].slice(0, this.maxBufferSize);
    }
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushInterval);
  }

  async destroy(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

export const rendererLogger = new RendererLogger();
