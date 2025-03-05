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

export const DialogExportMessage = ({ dialogState }: Props): JSX.Element => {
  const { isOpen: isDialogOpen, setIsOpen: setIsDialogOpen } = dialogState;
  const navigator = useNavigate();

  return (
    <Dialog
      onOpenChange={(e, { open }) => {
        e.stopPropagation();
        setIsDialogOpen(open);
      }}
      open={isDialogOpen}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>ダウンロード準備を開始しました</DialogTitle>
          <DialogContent>
            <Body1>
              準備が完了すると「処理一覧画面」からファイルがダウンロードできます。
              <br />
              ご利用のパソコンの性能によっては、処理の開始に数分かかる場合があります。しばらく経っても処理の開始がされない場合は、時間をおいて処理一覧画面を再度表示してください。
            </Body1>
          </DialogContent>
          <DialogActions>
            <Button appearance="primary" onClick={() => navigator("/job")}>
              処理一覧画面へ
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
