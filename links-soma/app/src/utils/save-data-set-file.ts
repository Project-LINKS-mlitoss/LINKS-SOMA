import { type InsertRawDataSet } from "../schema";

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
  // TODO: サイズが大きいファイルのためにパフォーマンス改善が必要かも
  await window.ipcRenderer.invoke("saveFile", {
    data: arrayBuffer,
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
