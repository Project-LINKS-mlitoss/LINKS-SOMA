import path from "path";
import { readFileSync, statSync } from "fs";
import { dbDirectory } from "../../../db/client";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export type DataSetFileStat = {
  /** ファイルサイズ（バイト） */
  bytes: number;
  /** データ行数（ヘッダ除く）。CSV以外（GeoPackage等のバイナリ）は null */
  rows: number | null;
};

/**
 * 名寄せ入力ファイルのボリュームを返す（NR007 ② 行数・ファイルサイズ）。
 * サイズは fs.stat。行数は CSV のみ改行カウント（バイナリ地図データは対象外）。
 */
export const selectDataSetFileStats = (async (
  _: unknown,
  { fileNames }: { fileNames: string[] },
): Promise<Record<string, DataSetFileStat>> => {
  const result: Record<string, DataSetFileStat> = {};
  for (const fileName of fileNames) {
    try {
      // パストラバーサル防御: dbDirectory 直下の単純なファイル名のみ許可
      if (fileName !== path.basename(fileName)) continue;
      const filePath = path.resolve(dbDirectory, fileName);
      if (filePath !== path.join(dbDirectory, fileName)) continue;
      const bytes = statSync(filePath).size;

      let rows: number | null = null;
      if (filePath.toLowerCase().endsWith(".csv")) {
        const buf = readFileSync(filePath);
        let lines = 0;
        let idx = buf.indexOf(0x0a);
        while (idx !== -1) {
          lines++;
          idx = buf.indexOf(0x0a, idx + 1);
        }
        // 末尾が改行で終わらない場合は最終行を加算
        if (buf.length > 0 && buf[buf.length - 1] !== 0x0a) lines++;
        rows = Math.max(0, lines - 1); // ヘッダ1行を除外
      }

      result[fileName] = { bytes, rows };
    } catch (error) {
      mainProcessLogger.error(
        `Failed to stat dataset file: ${fileName}`,
        error as Error,
      );
    }
  }
  return result;
}) satisfies IpcMainListener;
