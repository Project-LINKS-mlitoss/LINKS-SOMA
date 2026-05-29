import {
  Caption1,
  Caption1Strong,
  makeStyles,
  ProgressBar,
  Spinner,
  Text,
  tokens,
} from "@fluentui/react-components";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { DeleteRegular } from "@fluentui/react-icons";
import { type MouseEventHandler } from "react";
import { formatByteValue } from "../../../utils/format-byte-value";
import { Button } from "../button";
import { DropFileSymbol } from "./drop-file-symbol";
import { UploadFileSymbol } from "./upload-file-symbol";

/** 進捗情報の型（preload.tsからre-export） */
export type ImportProgress =
  | { phase: "idle" }
  | { phase: "parsing"; rowCount: number }
  | { phase: "inserting"; current: number; total: number }
  | { phase: "completed" }
  | { phase: "error"; message: string };

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    border: "2px dashed #ccc",
    borderRadius: "5px",
    cursor: "pointer",
    padding: tokens.spacingHorizontalM,
  },
  progressContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    border: "2px dashed #ccc",
    borderRadius: "5px",
    padding: tokens.spacingHorizontalM,
    gap: tokens.spacingVerticalM,
  },

  progressText: {
    color: tokens.colorNeutralForeground2,
  },
  progressBar: {
    width: "80%",
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    border: `2px dashed ${tokens.colorPaletteRedBorder2}`,
    borderRadius: "5px",
    padding: tokens.spacingHorizontalM,
    gap: tokens.spacingVerticalM,
    backgroundColor: tokens.colorPaletteRedBackground1,
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
  },
});

type FilePathData = {
  name: string;
  path: string;
};

// onPathSelect: Electron dialog経由でファイルパスを取得するモード
// onUpload: 従来のreact-dropzone経由でFileオブジェクトを取得するモード
type Props =
  | {
      onPathSelect: (data: FilePathData | null) => void;
      onUpload?: never;
      isLoading?: boolean;
      dialogTitle?: string;
      progress?: ImportProgress;
    }
  | {
      onPathSelect?: never;
      onUpload: (file: File | null) => void;
      isLoading?: boolean;
      dialogTitle?: never;
      progress?: never;
    };

export const FileUploader = (props: Props): JSX.Element => {
  const { isLoading } = props;

  if ("onPathSelect" in props && props.onPathSelect) {
    return (
      <FileUploaderWithDialog
        {...props}
        isLoading={isLoading}
        progress={props.progress}
      />
    );
  }
  return <FileUploaderWithDropzone {...props} isLoading={isLoading} />;
};

// Electron dialog経由でファイル選択するコンポーネント
const FileUploaderWithDialog = ({
  onPathSelect,
  isLoading,
  dialogTitle,
  progress,
}: {
  onPathSelect: (data: FilePathData | null) => void;
  isLoading?: boolean;
  dialogTitle?: string;
  progress?: ImportProgress;
}): JSX.Element => {
  const styles = useStyles();
  const [selectedFile, setSelectedFile] = useState<{ name: string } | null>(
    null,
  );

  const handleClick = async (): Promise<void> => {
    const result = await window.ipcRenderer.invoke("showOpenCsvDialog", {
      title: dialogTitle,
    });

    if (!result.canceled && result.filePath && result.fileName) {
      setSelectedFile({ name: result.fileName });
      onPathSelect({ name: result.fileName, path: result.filePath });
    }
  };

  const handleDelete = (event: React.MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation();
    setSelectedFile(null);
    onPathSelect(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void handleClick();
    }
  };

  // エラー表示モード
  if (progress && progress.phase === "error") {
    return (
      <div className={styles.errorContainer}>
        {selectedFile && <Text>{selectedFile.name}</Text>}
        <Caption1Strong className={styles.errorText}>
          {progress.message}
        </Caption1Strong>
      </div>
    );
  }

  // 進捗表示モード
  if (progress && progress.phase !== "idle" && progress.phase !== "completed") {
    return (
      <div className={styles.progressContainer}>
        {selectedFile && <Text>{selectedFile.name}</Text>}
        <Caption1>{formatProgressText(progress)}</Caption1>
        <ProgressBar
          className={styles.progressBar}
          thickness="large"
          value={getProgressValue(progress)}
        />
      </div>
    );
  }

  // 従来のローディング表示（後方互換性のため残す）
  if (isLoading && !progress) {
    return (
      <div className={styles.progressContainer}>
        <ProgressBar className={styles.progressBar} thickness="large" />
        <p className={styles.progressText}>ファイルをアップロード中です...</p>
      </div>
    );
  }

  return (
    <div
      className={styles.root}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      {selectedFile ? (
        <SelectedFileSimple
          fileName={selectedFile.name}
          onDelete={handleDelete}
        />
      ) : (
        <UploadFileSymbol withDialog />
      )}
    </div>
  );
};

/** 進捗テキストをフォーマット */
const formatProgressText = (progress: ImportProgress): string => {
  switch (progress.phase) {
    case "parsing":
      return `ステップ 1/2: ファイル取得中 (${progress.rowCount.toLocaleString()}行)`;
    case "inserting": {
      const percent = Math.round((progress.current / progress.total) * 100);
      return `ステップ 2/2: 書込中 ${percent}% (${progress.current.toLocaleString()} / ${progress.total.toLocaleString()}行)`;
    }
    default:
      return "";
  }
};

/** 進捗バーの値を取得（0-1） */
const getProgressValue = (progress: ImportProgress): number | undefined => {
  switch (progress.phase) {
    case "parsing":
      // パース中は不確定（undefined = indeterminate）
      return undefined;
    case "inserting":
      return progress.current / progress.total;
    default:
      return undefined;
  }
};

// 従来のreact-dropzone経由でファイル選択するコンポーネント
const FileUploaderWithDropzone = ({
  onUpload,
  isLoading,
}: {
  onUpload: (file: File | null) => void;
  isLoading?: boolean;
}): JSX.Element => {
  const styles = useStyles();
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
  } | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setSelectedFile({
          name: file.name,
          size: file.size,
        });
        onUpload(file);
      }
    },
  });

  if (isLoading) {
    return (
      <div className={styles.root}>
        <Spinner />
        ファイルをアップロード中です...
      </div>
    );
  }

  return (
    <div {...getRootProps()} className={styles.root}>
      <input hidden type="file" {...getInputProps()} />
      {selectedFile ? (
        <SelectedFileWithSize
          fileName={selectedFile.name}
          fileSize={selectedFile.size}
          onDelete={(event) => {
            event.stopPropagation();
            setSelectedFile(null);
            onUpload(null);
          }}
        />
      ) : isDragActive ? (
        <DropFileSymbol />
      ) : (
        <UploadFileSymbol />
      )}
    </div>
  );
};

const useSelectedFileStyles = makeStyles({
  root: {
    display: "flex",
    alignItems: "flex-start",
    gap: tokens.spacingHorizontalXXXL,
  },
  fileSize: {
    fontSize: tokens.fontSizeBase300,
  },
});

type SelectedFileSimpleProps = {
  fileName: string;
  onDelete: MouseEventHandler<HTMLButtonElement>;
};

function SelectedFileSimple({
  fileName,
  onDelete,
}: SelectedFileSimpleProps): JSX.Element {
  const styles = useSelectedFileStyles();

  return (
    <div className={styles.root}>
      <div>
        <Text>{fileName}</Text>
      </div>
      <div>
        <Button
          appearance="subtle"
          icon={<DeleteRegular />}
          onClick={onDelete}
          type="button"
        />
      </div>
    </div>
  );
}

type SelectedFileWithSizeProps = {
  fileName: string;
  fileSize: number;
  onDelete: MouseEventHandler<HTMLButtonElement>;
};

function SelectedFileWithSize({
  fileName,
  fileSize,
  onDelete,
}: SelectedFileWithSizeProps): JSX.Element {
  const styles = useSelectedFileStyles();

  return (
    <div className={styles.root}>
      <div>
        <p>{fileName}</p>
        <p className={styles.fileSize}>
          {formatByteValue(fileSize, {
            unit: "MB",
          })}
        </p>
      </div>
      <div>
        <Button
          appearance="subtle"
          icon={<DeleteRegular />}
          onClick={onDelete}
          type="button"
        />
      </div>
    </div>
  );
}
