import {
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeftRegular } from "@fluentui/react-icons";
import { type ReactElement } from "react";
import { DialogSurface } from "../ui/dialog-surface";
import { DialogBody } from "../ui/dialog-body";
import { DialogTitle } from "../ui/dialog-title";
import { DialogContent } from "../ui/dialog-content";
import { Button } from "../ui/button";
import { type ReturnUseDialogState } from "../../hooks/use-dialog-state";

const useStyles = makeStyles({
  dialogTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
  content: {
    paddingBottom: tokens.spacingVerticalXXL,
  },
  datasetButton: {
    padding: 0,
    justifyContent: "flex-start",
    color: tokens.colorBrandForeground1,
    textDecoration: "underline",
    borderRadius: 0,
    textAlign: "left",
    "&:hover": {
      textDecoration: "none",
    },
  },
  tableContainer: {
    overflowX: "auto",
  },
  table: {
    tableLayout: "auto",
  },
  th: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  td: {
    minWidth: "153px",
  },
});

interface Props {
  content: ReactElement;
  dialogState: ReturnUseDialogState;
  datasetName: string | null;
  hideTrigger?: boolean;
}

export function DataPreviewDialog({
  content,
  dialogState,
  datasetName,
  hideTrigger,
}: Props): JSX.Element {
  const styles = useStyles();
  const { isOpen, setIsOpen } = dialogState;

  return (
    <>
      <Dialog
        onOpenChange={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        open={isOpen}
      >
        {!hideTrigger ? (
          <DialogTrigger disableButtonEnhancement>
            <Button
              appearance="transparent"
              className={styles.datasetButton}
              onClick={(e) => e.stopPropagation()}
            >
              {datasetName}
            </Button>
          </DialogTrigger>
        ) : (
          <></> // type errorを回避するためnullではなく<></>を返す
        )}
        <DialogSurface onClick={(e) => e.stopPropagation()}>
          <DialogTitle className={styles.dialogTitle}>
            <div className={styles.actions}>
              <Button
                appearance="transparent"
                icon={<ArrowLeftRegular />}
                onClick={() => setIsOpen(false)}
              />
              {datasetName}
            </div>
          </DialogTitle>
          <DialogBody>
            <DialogContent className={styles.content}>{content}</DialogContent>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </>
  );
}
