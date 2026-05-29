import {
  Caption1,
  Dialog,
  makeStyles,
  DialogTrigger,
  Checkbox,
  tokens,
} from "@fluentui/react-components";
import { DismissFilled } from "@fluentui/react-icons";
import { useState } from "react";
import { type ReturnUseDialogState } from "../../../shared/hooks/use-dialog-state";
import { LOCKED_EXPLANATORY_COLUMNS } from "../constants";
import {
  Button,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "../../../shared/components/ui";
import { toOdsDisplayName } from "../../../shared/types/optional-data-source";

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
  dialogActionsInner: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    gap: tokens.spacingHorizontalL,
  },
  selectedCount: {
    color: tokens.colorNeutralForeground3,
    marginTop: "2px",
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

  // ダイアログを開くたびに親の最新値で内部stateを同期
  const [prevOpen, setPrevOpen] = useState(false);
  if (isDialogOpen && !prevOpen) {
    setSelectedExplanatoryVariable(initialValues || []);
  }
  if (isDialogOpen !== prevOpen) {
    setPrevOpen(isDialogOpen);
  }

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
                disabled={LOCKED_EXPLANATORY_COLUMNS.includes(column)}
                id={column}
                label={toOdsDisplayName(column)}
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
            <div className={styles.dialogActionsInner}>
              <Caption1 className={styles.selectedCount}>
                {selectedExplanatoryVariable.length}カラム選択中
              </Caption1>
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
            </div>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
