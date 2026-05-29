import { useState, useCallback } from "react";
import { type KeyedMutator } from "swr";
import { useDialogState } from "../../../../../shared/hooks/use-dialog-state";
import { useIsLoading } from "../../../../../shared/hooks/use-is-loading";
import { type SelectDataSetResult } from "../../../../../db/schema";
import { type CsvImportResult } from "../../../../../shared/csv-import-progress";
import { rendererLogger } from "../../../../../shared/utils/renderer-logger";
import {
  type UseDialogCreateResultDatasetReturn,
  type FileData,
  type UseFileSelectReturn,
} from "./type";
import { useCsvImportProgress } from "./use-csv-import-progress";

type Params = {
  mutate: KeyedMutator<SelectDataSetResult[]>;
};

export const useDialogCreateResultDataset = ({
  mutate,
}: Params): UseDialogCreateResultDatasetReturn => {
  const { isOpen, setIsOpen: setIsOpenOriginal } = useDialogState(false);

  const buildingFileState = useFileSelect();
  const areaFileState = useFileSelect();
  const disabled = !buildingFileState.fileData && !areaFileState.fileData;

  const { isLoading, handleIsLoading } = useIsLoading({ init: false });

  // 進捗状態（カスタムフック）
  const { buildingProgress, areaProgress, resetProgress } =
    useCsvImportProgress({ isListening: isLoading });

  // ダイアログを閉じる際に全状態をリセット
  const setIsOpen: React.Dispatch<React.SetStateAction<boolean>> = useCallback(
    (value: React.SetStateAction<boolean>): void => {
      // 関数が渡された場合は実行して値を取得
      const newValue = typeof value === "function" ? value(isOpen) : value;
      if (!newValue) {
        resetProgress();
        buildingFileState.reset();
        areaFileState.reset();
      }
      setIsOpenOriginal(value);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset関数はuseCallbackでメモ化済みのため、オブジェクト全体ではなくメソッドのみを依存に含める
    [
      isOpen,
      resetProgress,
      setIsOpenOriginal,
      buildingFileState.reset,
      areaFileState.reset,
    ],
  );

  // 結果モーダル状態
  const [importResult, setImportResult] = useState<CsvImportResult | null>(
    null,
  );
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);

  const handleCloseResultModal = useCallback((): void => {
    setIsResultModalOpen(false);
    setImportResult(null);
  }, []);

  const handleClick = async (): Promise<void> => {
    try {
      handleIsLoading(true);
      resetProgress();

      if (!buildingFileState.fileData && !areaFileState.fileData) {
        throw new Error("ファイルが選択されていません");
      }

      const result = await window.ipcRenderer.invoke("createResultDatasets", {
        buildingFile: buildingFileState.fileData,
        areaFile: areaFileState.fileData,
      });

      // エラー時はundefinedが返るので、その場合は結果モーダルを表示しない
      // 進捗状態はリセットせず、エラー表示を維持する
      if (!result) {
        handleIsLoading(false);
        return;
      }

      // 結果を保存してモーダルを表示
      setImportResult(result);
      setIsOpen(false);
      setIsResultModalOpen(true);
      await mutate();
      // 成功時のみ進捗をリセット
      handleIsLoading(false);
      resetProgress();
    } catch (error) {
      rendererLogger.error("Error during result dataset file upload", error, {
        buildingFileName: buildingFileState.fileData?.name,
        areaFileName: areaFileState.fileData?.name,
        component: "useDialogCreateResultDataset",
      });
      handleIsLoading(false);
    }
  };

  return {
    dialogState: { isOpen, setIsOpen },
    buildingFileState,
    areaFileState,
    disabled,
    handleClick,
    isLoading,
    buildingProgress,
    areaProgress,
    resultModalState: {
      isOpen: isResultModalOpen,
      result: importResult,
      onClose: handleCloseResultModal,
    },
  };
};

/**
 * ファイル選択状態を管理するフック
 * Electronのダイアログ経由で取得したパス情報を保持
 */
const useFileSelect = (): UseFileSelectReturn => {
  const [fileData, setFileData] = useState<FileData | null>(null);

  const handlePathSelect = (data: FileData | null): void => {
    setFileData(data);
  };

  const reset = useCallback((): void => {
    setFileData(null);
  }, []);

  return {
    fileData,
    handlePathSelect,
    reset,
  };
};
