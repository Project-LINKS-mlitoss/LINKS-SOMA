import { Dialog } from "@fluentui/react-components";
import { type ReturnUseDialogState } from "../hooks/use-dialog-state";
import { DialogSurface } from "./ui/dialog-surface";
import { DialogTitle } from "./ui/dialog-title";
import { DialogActions } from "./ui/dialog-actions";
import { DialogBody } from "./ui/dialog-body";
import { DialogContent } from "./ui/dialog-content";
import { Button } from "./ui/button";

interface Props {
  fileName: string;
  onDelete?: (id: number) => void;
  dialogState: ReturnUseDialogState;
  jobMenu?: boolean;
  id: number;
}

export function DialogDeleteJob({
  fileName,
  onDelete,
  dialogState,
  id,
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
            選択した処理結果と処理に紐づく「名前をつけて保存」をしていないファイルは
            同時に削除されます。
            <br />
            よろしいですか？
            <br />
            *削除したデータを復元することはできません
          </DialogContent>

          <DialogActions>
            <Button
              appearance="primary"
              onClick={() => onDelete?.(id)}
              size="medium"
            >
              削除
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
