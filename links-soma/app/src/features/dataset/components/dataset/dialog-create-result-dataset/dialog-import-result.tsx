import {
  Body1Strong,
  Caption1,
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  CheckmarkCircleFilled,
  ChevronDownRegular,
  ChevronRightRegular,
  DismissFilled,
  WarningFilled,
} from "@fluentui/react-icons";
import { useState } from "react";
import { type CsvImportResult } from "../../../../../shared/csv-import-progress";
import { DialogSurface } from "../../../../../shared/components/ui/dialog-surface";
import { DialogBody } from "../../../../../shared/components/ui/dialog-body";
import { DialogTitle } from "../../../../../shared/components/ui/dialog-title";
import { Button } from "../../../../../shared/components/ui/button";
import { DialogContent } from "../../../../../shared/components/ui/dialog-content";
import { DialogActions } from "../../../../../shared/components/ui/dialog-actions";

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
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalL,
  },
  successMessage: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    color: tokens.colorPaletteGreenForeground1,
  },
  successIcon: {
    fontSize: "20px",
  },
  resultSection: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
  },
  resultTitle: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  resultItem: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  warningSection: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    backgroundColor: tokens.colorPaletteYellowBackground1,
    border: `1px solid ${tokens.colorPaletteYellowBorder1}`,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
  },
  warningHeader: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    color: tokens.colorPaletteYellowForeground2,
    cursor: "pointer",
    userSelect: "none",
  },
  warningIcon: {
    fontSize: "16px",
  },
  unmappedFile: {
    marginTop: tokens.spacingVerticalXS,
  },
  unmappedFileTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  unmappedList: {
    margin: 0,
    paddingLeft: tokens.spacingHorizontalL,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
});

type Props = {
  isOpen: boolean;
  onClose: () => void;
  result: CsvImportResult | null;
};

export const DialogImportResult = ({
  isOpen,
  onClose,
  result,
}: Props): JSX.Element | null => {
  const styles = useStyles();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!result) return null;

  const hasUnmappedColumns =
    (result.building?.unmappedColumns.length ?? 0) > 0 ||
    (result.area?.unmappedColumns.length ?? 0) > 0;

  return (
    <Dialog onOpenChange={(_, { open }) => !open && onClose()} open={isOpen}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  icon={
                    <DismissFilled className={styles.icon} strokeWidth={2} />
                  }
                />
              </DialogTrigger>
            }
            className={styles.dialogTitle}
          >
            インポート完了
          </DialogTitle>
          <DialogContent className={styles.content}>
            <div className={styles.successMessage}>
              <CheckmarkCircleFilled className={styles.successIcon} />
              <span>インポートが完了しました</span>
            </div>

            <div className={styles.resultSection}>
              <div className={styles.resultTitle}>
                <Body1Strong>{result.title}</Body1Strong>
              </div>
              {result.building && (
                <div className={styles.resultItem}>
                  • {result.building.fileName}:{" "}
                  {result.building.rowCount.toLocaleString()}件
                </div>
              )}
              {result.area && (
                <div className={styles.resultItem}>
                  • {result.area.fileName}:{" "}
                  {result.area.rowCount.toLocaleString()}件
                </div>
              )}
            </div>

            {hasUnmappedColumns && (
              <div className={styles.warningSection}>
                <div
                  className={styles.warningHeader}
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  <WarningFilled className={styles.warningIcon} />
                  <Caption1>一部のカラムは変換されませんでした</Caption1>
                  {isExpanded ? (
                    <ChevronDownRegular />
                  ) : (
                    <ChevronRightRegular />
                  )}
                </div>

                {isExpanded && (
                  <>
                    {result.building &&
                      result.building.unmappedColumns.length > 0 && (
                        <div className={styles.unmappedFile}>
                          <div className={styles.unmappedFileTitle}>
                            【{result.building.fileName}】
                            {result.building.unmappedColumns.length}件
                          </div>
                          <ul className={styles.unmappedList}>
                            {result.building.unmappedColumns.map((col) => (
                              <li key={col}>{col}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {result.area && result.area.unmappedColumns.length > 0 && (
                      <div className={styles.unmappedFile}>
                        <div className={styles.unmappedFileTitle}>
                          【{result.area.fileName}】
                          {result.area.unmappedColumns.length}件
                        </div>
                        <ul className={styles.unmappedList}>
                          {result.area.unmappedColumns.map((col) => (
                            <li key={col}>{col}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={onClose}>
              閉じる
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
