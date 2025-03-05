import path from "path";
import { existsSync, mkdirSync } from "fs";
import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";

const isDev = process.env.NODE_ENV === "development";

/** 生成されるすべてのファイルを配置するディレクトリのパスを返却する */
export const dbDirectory = (() => {
  const directoryName = "database";

  let result: string;
  if (isDev) {
    result = path.resolve(directoryName);
  } else {
    result = path.resolve(process.resourcesPath, directoryName);
  }

  return result;
})();

/** SQliteのファイル実体のフルパスを返却する */
export const dbPath = (() => {
  const fileName = "database.db";

  const result = path.resolve(dbDirectory, fileName);

  const directory = path.dirname(result);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }

  return result;
})();

const betterSqlite3 = new Database(dbPath, {
  verbose: console.info,
});

// パフォーマンス向上のためWALモードを有効にする
// ref: https://github.com/WiseLibs/better-sqlite3/blob/master/docs/performance.md
betterSqlite3.pragma("journal_mode = WAL");

export const db: BetterSQLite3Database = drizzle(betterSqlite3);
