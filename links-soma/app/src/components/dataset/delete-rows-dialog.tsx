import {
  makeStyles,
  tokens,
  Dialog,
  DialogTrigger,
} from "@fluentui/react-components";
import { DeleteRegular } from "@fluentui/react-icons";
import { useState } from "react";
import { DialogSurface } from "../ui/dialog-surface";
import { DialogTitle } from "../ui/dialog-title";
import { DialogActions } from "../ui/dialog-actions";
import { DialogBody } from "../ui/dialog-body";
import { DialogContent } from "../ui/dialog-content";
import { Button } from "../ui/button";

const useStyles = makeStyles({
  button: {
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    "&:hover, &:active, &:focus, &:focus-within": {
      border: `1px solid ${tokens.colorNeutralStroke1Selected}`,
    },
  },
  input: {
    width: "100%",
  },
});

interface Props {
  disabled?: boolean;
  onDelete: () => void;
}

export function DeleteRowsDialog({ disabled, onDelete }: Props): JSX.Element {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const handleDelete = (): void => {
    onDelete();
    setOpen(false);
  };

  return (
    <Dialog
      onOpenChange={() => {
        setOpen((prev) => !prev);
      }}
      open={open}
    >
      <DialogTrigger disableButtonEnhancement>
        <Button
          appearance="outline"
          className={styles.button}
          disabled={disabled}
          icon={<DeleteRegular />}
        />
      </DialogTrigger>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>このデータを削除しますか？</DialogTitle>
          <DialogContent>
            削除したデータを復元することはできません
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={handleDelete} size="medium">
              削除
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
