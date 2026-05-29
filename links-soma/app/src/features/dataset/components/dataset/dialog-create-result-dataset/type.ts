import { type ReturnUseDialogState } from "../../../../../shared/hooks/use-dialog-state";
import { type CsvImportResult } from "../../../../../shared/csv-import-progress";
import { type ImportProgress } from "../../../../../shared/components/ui/file-uploader/file-uploader";

export type FileData = {
  name: string;
  path: string;
};

export type UseFileSelectReturn = {
  fileData: FileData | null;
  handlePathSelect: (data: FileData | null) => void;
  reset: () => void;
};

export type ResultModalState = {
  isOpen: boolean;
  result: CsvImportResult | null;
  onClose: () => void;
};

export type UseDialogCreateResultDatasetReturn = {
  dialogState: ReturnUseDialogState;
  buildingFileState: UseFileSelectReturn;
  areaFileState: UseFileSelectReturn;
  disabled: boolean;
  handleClick: () => Promise<void>;
  isLoading: boolean;
  buildingProgress: ImportProgress;
  areaProgress: ImportProgress;
  resultModalState: ResultModalState;
};
