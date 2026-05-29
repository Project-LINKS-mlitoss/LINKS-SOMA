import { Dismiss24Regular } from "@fluentui/react-icons";
import { Dialog, DialogTrigger, tokens } from "@fluentui/react-components";
import {
  DialogBody,
  DialogTitle,
  DialogActions,
  Button,
  DialogContent,
  DialogSurface,
} from "../../../../shared/components/ui";
import { type useDialogState } from "../../../../shared/hooks/use-dialog-state";

type Props = {
  onSubmit: () => void;
  /** ダイアログの開閉状態を制御 */
  dialogState: ReturnType<typeof useDialogState>;
};

export function DeleteDialog({ onSubmit, dialogState }: Props): JSX.Element {
  const { isOpen, setIsOpen } = dialogState;

  return (
    <Dialog onOpenChange={(_, { open }) => setIsOpen(open)} open={isOpen}>
      <DialogSurface>
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
            ビューを削除しますか？
          </DialogTitle>
          <DialogContent>削除したビューはもとに戻せません</DialogContent>
          <DialogActions position="start">
            <Button>キャンセル</Button>
          </DialogActions>
          <DialogActions position="end">
            <Button appearance="primary" onClick={onSubmit}>
              削除
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
