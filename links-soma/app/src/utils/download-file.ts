import { downloadDataSetFile } from "./download-data-set-file";

export const downloadFile = async (file_path: string): Promise<void> => {
  try {
    const buffer = await window.ipcRenderer.invoke("readDatasetFile", {
      fileName: file_path,
    });
    void downloadDataSetFile(buffer, file_path);
  } catch (error) {
    console.error("Download failed:", error);
    alert("ダウンロードに失敗しました。");
  }
};
