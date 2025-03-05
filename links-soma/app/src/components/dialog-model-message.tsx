import { Dialog, Body1 } from "@fluentui/react-components";
import { useNavigate } from "react-router-dom";
import { type ReturnUseDialogState } from "../hooks/use-dialog-state";
import { Button } from "./ui/button";
import { DialogSurface } from "./ui/dialog-surface";
import { DialogBody } from "./ui/dialog-body";
import { DialogTitle } from "./ui/dialog-title";
import { DialogContent } from "./ui/dialog-content";
import { DialogActions } from "./ui/dialog-actions";

type Props = {
  dialogState: ReturnUseDialogState;
};

export const DialogModelMessage = ({ dialogState }: Props): JSX.Element => {
  const { isOpen: isDialogOpen, setIsOpen: setIsDialogOpen } = dialogState;
  const navigator = useNavigate();

  return (
    <Dialog
      onOpenChange={(_, { open }) => setIsDialogOpen(open)}
      open={isDialogOpen}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>モデル構築処理を開始しました</DialogTitle>
          <DialogContent>
            <Body1>
              ご利用のパソコンの性能によっては、処理の開始に数分かかる場合があります。しばらく経っても処理の開始がされない場合は、時間をおいて処理一覧画面を再度表示してください。
            </Body1>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={() => navigator("/model")}>
              処理のステータスを確認
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
