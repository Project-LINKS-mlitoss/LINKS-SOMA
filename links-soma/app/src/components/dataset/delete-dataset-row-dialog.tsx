import { Dialog } from "@fluentui/react-components";
import { DialogSurface } from "../ui/dialog-surface";
import { DialogTitle } from "../ui/dialog-title";
import { DialogActions } from "../ui/dialog-actions";
import { DialogBody } from "../ui/dialog-body";
import { DialogContent } from "../ui/dialog-content";
import { Button } from "../ui/button";
import { type ReturnUseDialogState } from "../../hooks/use-dialog-state";

interface Props {
  fileName: string;
  onDelete?: () => void;
  dialogState: ReturnUseDialogState;
}

export function DeleteDataSetRowDialog({
  fileName,
  onDelete,
  dialogState,
}: Props): JSX.Element {
  const { isOpen, setIsOpen } = dialogState;

  return (
    <Dialog
      onOpenChange={(e, data) => {
        e.stopPropagation();
        setIsOpen(data.open);
      }}
      open={isOpen}
    >
      <DialogSurface onClick={(e) => e.stopPropagation()}>
        <DialogBody>
          <DialogTitle>「{fileName}」を削除しますか？</DialogTitle>
          <DialogContent>
            削除したデータを復元することはできません
          </DialogContent>

          <DialogActions>
            <Button appearance="primary" onClick={onDelete} size="medium">
              削除
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
