import {
  Dialog,
  makeStyles,
  DialogTrigger,
  Checkbox,
} from "@fluentui/react-components";
import { DismissFilled } from "@fluentui/react-icons";
import { useState } from "react";
import { type ReturnUseDialogState } from "../hooks/use-dialog-state";
import { DEFAULT_SELECTED_COLUMNS } from "../hooks/use-form-model-create";
import { Button } from "./ui/button";
import { DialogSurface } from "./ui/dialog-surface";
import { DialogBody } from "./ui/dialog-body";
import { DialogTitle } from "./ui/dialog-title";
import { DialogContent } from "./ui/dialog-content";
import { DialogActions } from "./ui/dialog-actions";

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
  disabledButton: {
    backgroundColor: "#EFF0F0",
    color: "#89949F",
    cursor: "not-allowed",
    ":hover": {
      backgroundColor: "#EFF0F0",
    },
  },
});

/** 仮: もっと具体的に書けそうなら書く・書けなかったら普通にstringとして書く */
type ExplanatoryVariable = string;

type Props = {
  dialogState: ReturnUseDialogState;
  onSelected: (data: ExplanatoryVariable[]) => void;
  columnOptions: ExplanatoryVariable[];
  initialValues: ExplanatoryVariable[] | undefined;
};

export const DialogExplanatoryVariables = ({
  dialogState,
  onSelected,
  columnOptions,
  initialValues,
}: Props): JSX.Element => {
  const styles = useStyles();
  const [selectedExplanatoryVariable, setSelectedExplanatoryVariable] =
    useState<ExplanatoryVariable[]>(initialValues || []);

  const { isOpen: isDialogOpen, setIsOpen: setIsDialogOpen } = dialogState;

  const handleClick = (): void => {
    onSelected(selectedExplanatoryVariable);
    setIsDialogOpen(false);
  };

  return (
    <Dialog
      onOpenChange={(_, { open }) => setIsDialogOpen(open)}
      open={isDialogOpen}
    >
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
            説明変数に使うカラムの選択
          </DialogTitle>
          <DialogContent>
            {columnOptions.map((column) => (
              <Checkbox
                key={column}
                checked={selectedExplanatoryVariable.includes(column)}
                disabled={DEFAULT_SELECTED_COLUMNS.includes(column)}
                id={column}
                label={column}
                name={column}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedExplanatoryVariable((prev) => [...prev, column]);
                  } else {
                    setSelectedExplanatoryVariable(
                      (prev) => prev.filter((item) => item !== column), // ここでfilterを使っているのは、配列の中から選択した要素を取り除くため
                    );
                  }
                }}
              />
            ))}
          </DialogContent>
          <DialogActions>
            <Button
              appearance="primary"
              className={
                selectedExplanatoryVariable.length === 0
                  ? styles.disabledButton
                  : ""
              }
              disabled={selectedExplanatoryVariable.length === 0}
              onClick={handleClick}
            >
              保存
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
