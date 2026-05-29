import { saveDataSetFile } from "../../../shared/utils/save-data-set-file";
import { rendererLogger } from "../../../shared/utils/renderer-logger";

export const handleUploadButtonClick = ({
  fileInputRef,
}: {
  fileInputRef: React.RefObject<HTMLInputElement>;
}): void => {
  fileInputRef.current?.click();
};

export const handleUpload = async (
  e: React.ChangeEvent<HTMLInputElement>,
  tab: "raw" | "normalization" | "result",
): Promise<void> => {
  const files = e.target.files;
  if (!files || files.length === 0) {
    return;
  }
  try {
    await Promise.all(
      Array.from(files).map((file) => saveDataSetFile(file, tab)),
    );
  } catch (error) {
    rendererLogger.error("Dataset file upload operation failed", error, {
      tab,
      filesCount: files.length,
      component: "handleUpload",
    });
  }

  e.target.value = ""; // ファイル選択をリセットする
};
