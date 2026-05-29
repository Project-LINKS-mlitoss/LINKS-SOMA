import { downloadDataSetFile } from "./download-data-set-file";
import { rendererLogger } from "./renderer-logger";

export const downloadFile = async (file_path: string): Promise<void> => {
  try {
    const buffer = await window.ipcRenderer.invoke("readDatasetFile", {
      fileName: file_path,
    });
    void downloadDataSetFile(buffer, file_path);
  } catch (error) {
    rendererLogger.error("Download failed", error, {
      filePath: file_path,
      component: "downloadFile",
    });
    alert("ダウンロードに失敗しました。");
  }
};
