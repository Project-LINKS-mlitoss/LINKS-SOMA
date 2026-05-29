import { type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { db } from "../../db/client";
import { ContextualError, ErrorCode } from "./error-context";

/**
 * クエリ呼び出し回数を追跡するカウンタークラス
 */
class QueryCounter {
  private static instance: QueryCounter;
  private counters = new Map<string, number>();
  private totalQueries = 0;

  static getInstance(): QueryCounter {
    if (!QueryCounter.instance) {
      QueryCounter.instance = new QueryCounter();
    }
    return QueryCounter.instance;
  }

  increment(queryName: string): void {
    this.counters.set(queryName, (this.counters.get(queryName) || 0) + 1);
    this.totalQueries++;
  }

  getCount(queryName: string): number {
    return this.counters.get(queryName) || 0;
  }

  getTotalCount(): number {
    return this.totalQueries;
  }

  getStats(): Record<string, number> & { __total: number } {
    return {
      ...Object.fromEntries(this.counters),
      __total: this.totalQueries,
    };
  }
}

/**
 * パフォーマンス測定付きクエリ実行
 */
export async function benchmarkedQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  thresholdMs = 100,
): Promise<T> {
  const start = performance.now();
  const isDev = process.env.NODE_ENV === "development";
  const queryCounter = QueryCounter.getInstance();

  // 開発環境でのみクエリカウントをインクリメント
  if (isDev) {
    queryCounter.increment(queryName);
  }

  try {
    const result = await queryFn();
    const duration = performance.now() - start;

    // 開発環境でのみ詳細ログ、本番環境では閾値超過時のみ
    if (isDev) {
      const count = queryCounter.getCount(queryName);
      // eslint-disable-next-line no-console -- Development logging
      console.debug(
        `Query: ${queryName} (${duration.toFixed(2)}ms) [${count}回目]`,
      );
    } else if (duration > thresholdMs) {
      // eslint-disable-next-line no-console -- Performance warning in production
      console.warn(`Slow query: ${queryName} (${duration.toFixed(2)}ms)`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - start;
    const contextualError = new ContextualError(
      error instanceof Error ? error.message : String(error),
      ErrorCode.DB_QUERY_FAILED,
      isDev ? { queryName, duration: `${duration.toFixed(2)}ms` } : undefined,
    );

    if (isDev) {
      // eslint-disable-next-line no-console -- Development error logging
      console.error(
        `Failed query: ${queryName} (${duration.toFixed(2)}ms)`,
        error,
      );
    }

    throw contextualError;
  }
}

/**
 * 並列クエリ実行ヘルパー
 */
export async function parallelQueries<
  T extends Record<string, unknown>,
>(queries: {
  [K in keyof T]: { name: string; fn: () => Promise<T[K]> };
}): Promise<T> {
  const isDev = process.env.NODE_ENV === "development";
  const start = performance.now();

  try {
    const entries = Object.entries(queries) as Array<
      [keyof T, { name: string; fn: () => Promise<T[keyof T]> }]
    >;
    const results = await Promise.all(
      entries.map(async ([key, { name, fn }]) => {
        const result = await benchmarkedQuery(name, fn);
        return [key, result] as const;
      }),
    );

    const duration = performance.now() - start;
    const resultObj = Object.fromEntries(results) as T;

    if (isDev) {
      // eslint-disable-next-line no-console -- Development debug logging
      console.debug(
        `Parallel queries completed (${duration.toFixed(2)}ms):`,
        Object.keys(queries),
      );
    }

    return resultObj;
  } catch (error) {
    const duration = performance.now() - start;

    if (isDev) {
      // eslint-disable-next-line no-console -- Development error logging
      console.error(
        `Parallel queries failed (${duration.toFixed(2)}ms):`,
        error,
      );
    }

    throw error;
  }
}

/**
 * 条件付きエラーハンドリング（ゼロオーバーヘッド）
 */
export async function conditionalErrorHandling<T>(
  queryFn: () => Promise<T>,
  context?: { operation: string; data?: unknown },
): Promise<T> {
  const isDev = process.env.NODE_ENV === "development";
  const enableDetailedHandling =
    isDev && process.env.VITE_DETAILED_ERROR_HANDLING !== "false";

  if (enableDetailedHandling && context) {
    // 開発環境での詳細エラーハンドリング
    try {
      return await queryFn();
    } catch (error) {
      throw new ContextualError(
        error instanceof Error ? error.message : String(error),
        ErrorCode.DB_QUERY_FAILED,
        { ...context, timestamp: new Date().toISOString() },
      );
    }
  } else {
    // 本番環境での最小限エラーハンドリング
    try {
      return await queryFn();
    } catch (error) {
      // 最小限のエラー変換のみ
      throw new ContextualError(
        error instanceof Error ? error.message : "Database query failed",
        ErrorCode.DB_QUERY_FAILED,
      );
    }
  }
}

/**
 * テーブルクエリ最適化ヘルパー
 */
export class OptimizedTableQuery {
  private static instance: OptimizedTableQuery;
  private db: BetterSQLite3Database;

  constructor(database: BetterSQLite3Database = db) {
    this.db = database;
  }

  static getInstance(): OptimizedTableQuery {
    if (!OptimizedTableQuery.instance) {
      OptimizedTableQuery.instance = new OptimizedTableQuery();
    }
    return OptimizedTableQuery.instance;
  }

  /**
   * データ取得とカウントを並列実行
   */
  async getDataWithCounts<TData, TCount = number>(config: {
    dataQuery: () => Promise<TData>;
    countQueries: {
      filtered: () => Promise<{ count: TCount }[]>;
      total: () => Promise<{ count: TCount }[]>;
    };
    context?: { operation: string; table: string };
  }): Promise<{
    data: TData;
    filteredCount: TCount;
    totalCount: TCount;
  }> {
    return parallelQueries({
      data: {
        name: `${config.context?.table || "table"}_data`,
        fn: config.dataQuery,
      },
      counts: {
        name: `${config.context?.table || "table"}_counts`,
        fn: async () => {
          const [filtered, total] = await Promise.all([
            config.countQueries.filtered(),
            config.countQueries.total(),
          ]);
          return {
            filteredCount: filtered[0]?.count || (0 as TCount),
            totalCount: total[0]?.count || (0 as TCount),
          };
        },
      },
    }).then((result) => ({
      data: result.data,
      filteredCount: result.counts.filteredCount,
      totalCount: result.counts.totalCount,
    }));
  }
}

// シングルトンインスタンスをエクスポート
export const optimizedTableQuery = OptimizedTableQuery.getInstance();
