/**
 * 下書き確認ダイアログ
 * 既存の下書きがある場合に表示し、続行か新規作成かを選択させる
 */

import { Dialog, makeStyles, tokens } from "@fluentui/react-components";
import { DocumentEdit24Regular } from "@fluentui/react-icons";
import {
  Button,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "../../../../shared/components/ui";

const useStyles = makeStyles({
  content: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  iconContainer: {
    display: "flex",
    justifyContent: "center",
    marginBottom: tokens.spacingVerticalM,
  },
  icon: {
    fontSize: "48px",
    color: tokens.colorBrandForeground1,
  },
  description: {
    textAlign: "center",
    color: tokens.colorNeutralForeground2,
  },
});

type Props = {
  /** ダイアログの開閉状態 */
  open: boolean;
  /** 続けるボタンのハンドラ */
  onContinue: () => void;
  /** 新規作成ボタンのハンドラ */
  onNewCreate: () => void;
  /** ダイアログを閉じるハンドラ */
  onClose: () => void;
};

export const DialogDraftConfirm = ({
  open,
  onContinue,
  onNewCreate,
  onClose,
}: Props): JSX.Element => {
  const styles = useStyles();

  return (
    <Dialog onOpenChange={(_, data) => !data.open && onClose()} open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>下書きがあります</DialogTitle>
          <DialogContent>
            <div className={styles.content}>
              <div className={styles.iconContainer}>
                <DocumentEdit24Regular className={styles.icon} />
              </div>
              <p className={styles.description}>
                保存された下書きがあります。続けて編集しますか？
                <br />
                新規作成を選択すると、下書きは削除されます。
              </p>
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="outline" onClick={onNewCreate}>
              新規作成
            </Button>
            <Button appearance="primary" onClick={onContinue}>
              続ける
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
