import { makeStyles, Spinner, tokens } from "@fluentui/react-components";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { DeleteRegular } from "@fluentui/react-icons";
import { type MouseEventHandler } from "react";
import { formatByteValue } from "../../../utils/format-byte-value";
import { Button } from "../button";
import { DropFileSymbol } from "./drop-file-symbol";
import { UploadFileSymbol } from "./upload-file-symbol";

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
  },
  spin: {
    animation: "$spin 2s linear infinite",
  },
});

type Props = {
  onUpload: (file: File | null) => void;
  isLoading?: boolean;
};

export const FileUploader = ({ onUpload, isLoading }: Props): JSX.Element => {
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
        <SelectedFile
          fileName={selectedFile.name}
          fileSize={selectedFile.size}
          onDelete={(event) => {
            event.stopPropagation(); // ファイル選択のイベントが発火しないようにする
            setSelectedFile(null);
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

type SelectedFileProps = {
  fileName: string;
  fileSize: number;
  onDelete: MouseEventHandler<HTMLButtonElement>;
};

function SelectedFile({
  fileName,
  fileSize,
  onDelete,
}: SelectedFileProps): JSX.Element {
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
