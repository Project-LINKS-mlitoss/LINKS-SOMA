import { useState, useEffect, useCallback } from "react";
import { type CsvImportProgress } from "../../../../../shared/csv-import-progress";
import { type ImportProgress } from "../../../../../shared/components/ui/file-uploader/file-uploader";

type UseCsvImportProgressParams = {
  isListening: boolean;
};

type UseCsvImportProgressReturn = {
  buildingProgress: ImportProgress;
  areaProgress: ImportProgress;
  resetProgress: () => void;
};

/**
 * CSVインポートの進捗状態を管理するカスタムフック
 * isListeningがtrueの間、IPCの進捗イベントを監視して状態を更新する
 */
export const useCsvImportProgress = ({
  isListening,
}: UseCsvImportProgressParams): UseCsvImportProgressReturn => {
  const [buildingProgress, setBuildingProgress] = useState<ImportProgress>({
    phase: "idle",
  });
  const [areaProgress, setAreaProgress] = useState<ImportProgress>({
    phase: "idle",
  });

  // 進捗をリセット
  const resetProgress = useCallback((): void => {
    setBuildingProgress({ phase: "idle" });
    setAreaProgress({ phase: "idle" });
  }, []);

  // IPC進捗イベントをImportProgressに変換
  const handleProgressEvent = useCallback(
    (progress: CsvImportProgress): void => {
      const setProgress =
        progress.fileType === "building"
          ? setBuildingProgress
          : setAreaProgress;

      switch (progress.phase) {
        case "parsing":
          setProgress({ phase: "parsing", rowCount: progress.rowCount });
          break;
        case "inserting":
          setProgress({
            phase: "inserting",
            current: progress.current,
            total: progress.total,
          });
          break;
        case "completed":
          setProgress({ phase: "completed" });
          break;
        case "error":
          setProgress({ phase: "error", message: progress.message });
          break;
      }
    },
    [],
  );

  // 進捗リスナーの登録・解除
  useEffect(() => {
    if (!isListening) return;

    window.ipcRenderer.onCsvImportProgress(handleProgressEvent);

    return () => {
      window.ipcRenderer.offCsvImportProgress(handleProgressEvent);
    };
  }, [isListening, handleProgressEvent]);

  return {
    buildingProgress,
    areaProgress,
    resetProgress,
  };
};
