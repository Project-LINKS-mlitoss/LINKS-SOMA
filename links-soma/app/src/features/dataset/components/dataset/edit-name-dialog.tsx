import { useState } from "react";
import {
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { DialogSurface } from "../../../../shared/components/ui/dialog-surface";
import { DialogTitle } from "../../../../shared/components/ui/dialog-title";
import { DialogActions } from "../../../../shared/components/ui/dialog-actions";
import { DialogBody } from "../../../../shared/components/ui/dialog-body";
import { DialogContent } from "../../../../shared/components/ui/dialog-content";
import { Button } from "../../../../shared/components/ui/button";
import { Input } from "../../../../shared/components/ui/input";
import { type ReturnUseDialogState } from "../../../../shared/hooks/use-dialog-state";

const useStyles = makeStyles({
  input: {
    width: "100%",
  },
});

interface Props {
  initialName: string | null;
  onSubmit: (newName: string) => void;
  dialogState: ReturnUseDialogState;
}

export function EditNameDialog({
  initialName,
  onSubmit,
  dialogState,
}: Props): JSX.Element {
  const styles = useStyles();
  const [newName, setNewName] = useState(initialName);
  const { isOpen, setIsOpen } = dialogState;
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (): void => {
    if (!newName) {
      setError("データ名を入力してください");
      return;
    }
    onSubmit(newName);
    setIsOpen(false);
  };

  return (
    <Dialog
      onOpenChange={(e, data) => {
        e.stopPropagation();
        setIsOpen(data.open);
      }}
      open={isOpen}
    >
      <DialogSurface
        aria-describedby={undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label="close"
                  icon={
                    <Dismiss24Regular
                      color={tokens.colorNeutralForeground1}
                      strokeWidth={2}
                    />
                  }
                />
              </DialogTrigger>
            }
          >
            データ名の編集
          </DialogTitle>
          <DialogContent>
            <Input
              className={styles.input}
              onChange={(e) => {
                setNewName(e.target.value);
                setError(null);
              }}
              value={newName || ""}
            />
            {error && <div>{error}</div>}
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={handleSubmit} size="medium">
              保存
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
