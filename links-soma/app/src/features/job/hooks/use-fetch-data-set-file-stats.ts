import useSWRImmutable from "swr/immutable";
import { rendererLogger } from "../../../shared/utils/renderer-logger";

export type DataSetFileStat = {
  /** ファイルサイズ（バイト） */
  bytes: number;
  /** データ行数（ヘッダ除く）。CSV以外（GeoPackage等）は null */
  rows: number | null;
};

/**
 * 名寄せ入力ファイルのボリューム（NR007 ② 行数・ファイルサイズ）を取得する。
 * `selectDataSetFileStats` IPC（fs.stat + CSV改行カウント）を呼ぶ。
 * キャッシュキーはファイル名集合（join 文字列）で同定する。
 */
export const useFetchDataSetFileStats = (
  fileNames: string[],
): Record<string, DataSetFileStat> | undefined => {
  const { data } = useSWRImmutable(
    fileNames.length
      ? { key: "useFetchDataSetFileStats", fileNames: fileNames.join("|") }
      : null,
    async () => {
      return await window.ipcRenderer.invoke("selectDataSetFileStats", {
        fileNames,
      });
    },
    {
      onError: (error) =>
        rendererLogger.error("Failed to fetch dataset file stats", { error }),
    },
  );

  return data;
};
