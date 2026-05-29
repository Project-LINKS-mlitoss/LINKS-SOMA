import {
  Body1Strong,
  Caption1,
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { DismissFilled } from "@fluentui/react-icons";
import { DialogSurface } from "../../../../../shared/components/ui/dialog-surface";
import { DialogBody } from "../../../../../shared/components/ui/dialog-body";
import { DialogTitle } from "../../../../../shared/components/ui/dialog-title";
import { Button } from "../../../../../shared/components/ui/button";
import { DialogContent } from "../../../../../shared/components/ui/dialog-content";
import { FileUploader } from "../../../../../shared/components/ui/file-uploader/file-uploader";
import { DialogActions } from "../../../../../shared/components/ui/dialog-actions";
import { DialogImportResult } from "./dialog-import-result";
import { type UseDialogCreateResultDatasetReturn } from "./type";

const useStyles = makeStyles({
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  icon: {
    width: "24px",
    height: "24px",
    ":hover": { cursor: "pointer" },
  },
  uploadWrap: {
    height: "325px",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: tokens.spacingVerticalXXS,
  },
  uploadContent: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: `${tokens.spacingVerticalXL} ${tokens.spacingHorizontalXXXL}`,
    gap: tokens.spacingVerticalL,
  },
  disabledButton: {
    backgroundColor: "#EFF0F0",
    color: "#89949F",
    cursor: "not-allowed",
    ":hover": {
      backgroundColor: "#EFF0F0",
    },
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
  },
  actionsContainer: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    alignItems: "center",
    width: "max-content",
  },
});

type Props = UseDialogCreateResultDatasetReturn;

export const DialogCreateResultDataset = ({
  dialogState: { isOpen, setIsOpen },
  buildingFileState: { handlePathSelect: handleBuildingPathSelect },
  areaFileState: { handlePathSelect: handleAreaPathSelect },
  disabled,
  isLoading,
  handleClick,
  buildingProgress,
  areaProgress,
  resultModalState,
}: Props): JSX.Element => {
  const styles = useStyles();

  const hasError =
    buildingProgress.phase === "error" || areaProgress.phase === "error";

  return (
    <>
      <Dialog
        onOpenChange={(_, { open }) => {
          // アップロード中は閉じない
          if (isLoading && !open) return;
          setIsOpen(open);
        }}
        open={isOpen}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle
              action={
                <DialogTrigger action="close">
                  <Button
                    appearance="subtle"
                    aria-label="close"
                    disabled={isLoading}
                    icon={
                      <DismissFilled className={styles.icon} strokeWidth={2} />
                    }
                  />
                </DialogTrigger>
              }
              className={styles.dialogTitle}
            >
              空き家推定結果をアップロード
            </DialogTitle>
            <DialogContent className={styles.uploadWrap}>
              <div className={styles.uploadContent}>
                <Body1Strong>建物単位データを追加</Body1Strong>
                <FileUploader
                  dialogTitle="建物単位CSVファイルを選択"
                  isLoading={isLoading}
                  onPathSelect={handleBuildingPathSelect}
                  progress={buildingProgress}
                />
              </div>
              <div className={styles.uploadContent}>
                <Body1Strong>地域単位データを追加</Body1Strong>
                <FileUploader
                  dialogTitle="地域単位CSVファイルを選択"
                  isLoading={isLoading}
                  onPathSelect={handleAreaPathSelect}
                  progress={areaProgress}
                />
              </div>
            </DialogContent>
            <DialogActions>
              <div className={styles.actionsContainer}>
                {hasError && (
                  <Caption1 className={styles.errorText}>
                    データに問題があり、アップロードに失敗しました
                  </Caption1>
                )}
                {hasError ? (
                  <Button appearance="primary" onClick={() => setIsOpen(false)}>
                    アップロードを終了
                  </Button>
                ) : (
                  <Button
                    appearance="primary"
                    className={disabled ? styles.disabledButton : ""}
                    disabled={disabled || isLoading}
                    onClick={handleClick}
                  >
                    アップロードを開始
                  </Button>
                )}
              </div>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <DialogImportResult
        isOpen={resultModalState.isOpen}
        onClose={resultModalState.onClose}
        result={resultModalState.result}
      />
    </>
  );
};
