import { type InsertRawDataSet } from "../../db/schema";
import {
  toStorageHeaderLine,
  translateCsvHeaderBytes,
} from "./normalized-csv-header";

export async function saveDataSetFile(
  file: File | undefined,
  target: "raw" | "normalization" | "result" = "raw",
): Promise<{ insertedId: InsertRawDataSet["id"] } | undefined> {
  if (!file) return;
  const ext = file.name.split(".").pop();
  if (!ext) return;
  const uuid = crypto.randomUUID();
  const file_path = `${uuid}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  // 名寄せ済みデータはディスク上の列名が正本。表示名で書かれたヘッダを元に戻してから保存する。
  // ダウンロード側（normalized-dataset-table.tsx）の変換と対で維持すること（ADR-0029）
  const data =
    target === "normalization" && ext.toLowerCase() === "csv"
      ? translateCsvHeaderBytes(
          new Uint8Array(arrayBuffer),
          toStorageHeaderLine,
        )
      : arrayBuffer;
  // 大きいファイルではメモリ効率に懸念がある可能性がある
  await window.ipcRenderer.invoke("saveFile", {
    data,
    fileName: file_path,
  });

  const result = (async () => {
    switch (target) {
      case "raw":
        return await window.ipcRenderer.invoke("insertRawDatasets", {
          file_name: file.name,
          file_path,
        });
      case "normalization":
        return await window.ipcRenderer.invoke("insertNormalizedDatasets", {
          file_name: file.name,
          file_path,
        });
      case "result":
        return undefined;
      default: {
        const _exhaustiveCheck: never = target;
        throw new Error(`Unhandled type: ${_exhaustiveCheck}`);
      }
    }
  })();

  return result;
}
