import path from "path";
import { dbDirectory } from "./db";

/**
 * `database`フォルダ内のファイルパスを取得する
 */
export function getFilePathInDatabaseDirectory(...filePaths: string[]): string {
  return path.resolve(dbDirectory, ...filePaths);
}
