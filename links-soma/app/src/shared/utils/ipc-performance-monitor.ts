import { mainProcessLogger } from "./main-process-logger";

/**
 * IPC呼び出し頻度監視用
 */
interface CallStats {
  count: number;
  totalDuration: number;
  lastCall: number;
  windowStart: number;
}

/**
 * IPC パフォーマンス監視クラス
 */
class IpcPerformanceMonitor {
  private callStats = new Map<string, CallStats>();
  private readonly MONITORING_WINDOW_MS = 10000; // 10秒間のウィンドウ
  private readonly HIGH_FREQUENCY_THRESHOLD = 10; // 10秒間に10回以上なら高頻度

  /**
   * IPC呼び出しを記録
   */
  recordCall(channel: string, duration: number): void {
    const now = Date.now();
    const stats = this.callStats.get(channel);

    if (!stats || now - stats.windowStart > this.MONITORING_WINDOW_MS) {
      // 新しいウィンドウを開始
      this.callStats.set(channel, {
        count: 1,
        totalDuration: duration,
        lastCall: now,
        windowStart: now,
      });
    } else {
      // 既存のウィンドウに追加
      stats.count++;
      stats.totalDuration += duration;
      stats.lastCall = now;

      // 高頻度呼び出しの警告（重要な警告なので常に出力）
      if (stats.count === this.HIGH_FREQUENCY_THRESHOLD) {
        const avgDuration = stats.totalDuration / stats.count;
        mainProcessLogger.warn(
          `High frequency IPC calls detected: ${channel} called ${stats.count} times in ${this.MONITORING_WINDOW_MS}ms (avg: ${avgDuration.toFixed(1)}ms)`,
        );
      }
    }
  }

  /**
   * 統計情報を取得
   */
  getStats(channel: string): CallStats | undefined {
    const stats = this.callStats.get(channel);
    if (!stats) return undefined;

    const now = Date.now();
    // ウィンドウが期限切れの場合はundefinedを返す
    if (now - stats.windowStart > this.MONITORING_WINDOW_MS) {
      return undefined;
    }

    return { ...stats };
  }

  /**
   * 全統計をクリア
   */
  clearStats(): void {
    this.callStats.clear();
  }

  /**
   * チャンネルが高頻度かどうかを判定
   */
  isHighFrequency(channel: string): boolean {
    const stats = this.getStats(channel);
    return stats ? stats.count >= this.HIGH_FREQUENCY_THRESHOLD : false;
  }
}

// シングルトンインスタンスをエクスポート
export const ipcPerformanceMonitor = new IpcPerformanceMonitor();
