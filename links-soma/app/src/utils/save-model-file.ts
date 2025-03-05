import { type SelectModelFile } from "../schema";

export async function saveModelFile(
  file: File,
): Promise<{ insertedId: SelectModelFile["id"] } | undefined> {
  const uuid = crypto.randomUUID();
  const file_path = `${uuid}.zip`;
  const arrayBuffer = await file.arrayBuffer();
  // TODO: サイズが大きいファイルのためにパフォーマンス改善が必要かも
  await window.ipcRenderer.invoke("saveFile", {
    data: arrayBuffer,
    fileName: file_path,
  });

  const result = await window.ipcRenderer.invoke("insertModelFile", {
    file_name: file.name,
    file_path,
  });

  return result;
}
