import { downloadDataSetFile } from "./download-data-set-file";
import {
  toDisplayHeaderLine,
  translateCsvHeaderParts,
} from "./normalized-csv-header";
import { rendererLogger } from "./renderer-logger";

/**
 * 保存済みファイルをダウンロードする。
 *
 * `isNormalizedCsv` は名寄せ済みデータのCSVを渡すときだけ true にする。
 * 一部の列名がディスク上で英語のまま残るため、表示名へ読み替える（ADR-0029）。
 * モデルZIPやデータ出力の結果には適用しない。
 */
export const downloadFile = async (
  file_path: string,
  { isNormalizedCsv = false }: { isNormalizedCsv?: boolean } = {},
): Promise<void> => {
  try {
    const buffer = await window.ipcRenderer.invoke("readDatasetFile", {
      fileName: file_path,
    });
    const parts =
      isNormalizedCsv && file_path.toLowerCase().endsWith(".csv")
        ? translateCsvHeaderParts(buffer, toDisplayHeaderLine)
        : [buffer];
    void downloadDataSetFile(parts, file_path);
  } catch (error) {
    rendererLogger.error("Download failed", error, {
      filePath: file_path,
      component: "downloadFile",
    });
    alert("ダウンロードに失敗しました。");
  }
};
