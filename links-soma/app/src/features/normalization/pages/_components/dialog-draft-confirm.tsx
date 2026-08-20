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
import { lang } from "../../../../shared/config/lang";

const t = lang.components.draftConfirm;

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
    // lang 側の文言に含む改行 (\n) をそのまま反映する。
    whiteSpace: "pre-line",
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
  /**
   * この下書きが進行中/中断中ガイドに参照されているか。
   * true のとき新規作成の結果が重い（下書き削除＋ガイド進行リセット）ため、
   * 文言を強めて 1 枚で伝える（別途ガイド終了確認を重ねない）。
   */
  guideReferenced?: boolean;
  /**
   * ダイアログの発火経路。
   * - "resume"（既定）: 名寄せ一覧の「始める」。続ける/新規作成を提示。
   * - "modelTraining": モデル構築画面の導線（新規開始専用）。続けるは出さず、新規作成/キャンセルを提示。
   */
  mode?: "resume" | "modelTraining";
};

export const DialogDraftConfirm = ({
  open,
  onContinue,
  onNewCreate,
  onClose,
  guideReferenced = false,
  mode = "resume",
}: Props): JSX.Element => {
  const styles = useStyles();
  const isModelTraining = mode === "modelTraining";
  const body = isModelTraining
    ? t.bodyModelTraining
    : guideReferenced
      ? t.bodyGuideReferenced
      : t.body;

  return (
    <Dialog onOpenChange={(_, data) => !data.open && onClose()} open={open}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogContent>
            <div className={styles.content}>
              <div className={styles.iconContainer}>
                <DocumentEdit24Regular className={styles.icon} />
              </div>
              <p className={styles.description}>{body}</p>
            </div>
          </DialogContent>
          <DialogActions>
            {isModelTraining ? (
              <>
                <Button appearance="outline" onClick={onClose}>
                  {t.cancel}
                </Button>
                <Button appearance="primary" onClick={onNewCreate}>
                  {t.newCreate}
                </Button>
              </>
            ) : (
              <>
                <Button appearance="outline" onClick={onNewCreate}>
                  {t.newCreate}
                </Button>
                <Button appearance="primary" onClick={onContinue}>
                  {t.continue}
                </Button>
              </>
            )}
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
