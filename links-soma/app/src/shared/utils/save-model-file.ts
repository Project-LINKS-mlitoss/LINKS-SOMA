import { type ModelCreateTaskResult } from "../types/job-task-result";
import { type SelectModelFile } from "../../db/schema";

export async function saveModelFile(
  file: File,
  job_task_result?: ModelCreateTaskResult,
): Promise<{ insertedId: SelectModelFile["id"] } | undefined> {
  const uuid = crypto.randomUUID();
  const file_path = `${uuid}.zip`;
  const arrayBuffer = await file.arrayBuffer();
  // 大きいファイルではメモリ効率に懸念がある可能性がある
  await window.ipcRenderer.invoke("saveFile", {
    data: arrayBuffer,
    fileName: file_path,
  });

  const result = await window.ipcRenderer.invoke("insertModelFile", {
    file_name: file.name,
    file_path,
    job_task_result,
  });

  return result;
}
