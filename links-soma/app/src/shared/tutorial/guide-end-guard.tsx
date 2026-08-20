/**
 * 名寄せ下書きが「上書き/削除されそう」な時に、ガイド進行を失う前に確認するガード（ADR-0024）。
 *
 * ドメイン（下書き確認の「新規作成」/ job 削除）は tutorial を import せず、
 * `requestGuarded` 経由で「ガイドが参照中か」を尋ねるだけにする。参照中なら専用ダイアログを出し、
 * 確認時にガイドを終了してから本来の破壊操作を実行する。既存ダイアログの作法を踏襲する。
 */

import { useCallback, useRef, useState } from "react";
import { Dialog } from "@fluentui/react-components";
import {
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "../components/ui";
import { lang } from "../config/lang";
import { rendererLogger } from "../utils/renderer-logger";
import { tutorialStore } from "./store";

const t = lang.components.tutorial;

type PendingAction = () => void | Promise<void>;

export type UseGuideEndGuardResult = {
  /**
   * 破壊操作の直前に呼ぶ。draftJobId が進行中ガイドに参照されていれば確認ダイアログを出し、
   * 確認後に proceed を実行する。参照されていなければ即 proceed する。
   */
  requestGuarded: (
    draftJobId: number,
    proceed: PendingAction,
  ) => Promise<void>;
  /** 呼び出し側のツリーに描画する確認ダイアログ。 */
  GuardDialog: () => JSX.Element;
};

export const useGuideEndGuard = (): UseGuideEndGuardResult => {
  const [open, setOpen] = useState(false);
  const pendingRef = useRef<PendingAction | null>(null);

  const runPending = useCallback(async (): Promise<void> => {
    const proceed = pendingRef.current;
    pendingRef.current = null;
    if (proceed) await proceed();
  }, []);

  const requestGuarded = useCallback(
    async (draftJobId: number, proceed: PendingAction): Promise<void> => {
      let referenced = false;
      try {
        referenced = await window.ipcRenderer.invoke(
          "isDraftReferencedByGuide",
          { draftJobId },
        );
      } catch (error) {
        rendererLogger.error("Guide reference check failed", error);
      }
      if (!referenced) {
        await proceed();
        return;
      }
      pendingRef.current = proceed;
      setOpen(true);
    },
    [],
  );

  const handleConfirm = useCallback(async (): Promise<void> => {
    // ガイドを終了してから本来の破壊操作を実行する。
    tutorialStore.reset();
    setOpen(false);
    await runPending();
  }, [runPending]);

  const handleCancel = useCallback((): void => {
    pendingRef.current = null;
    setOpen(false);
  }, []);

  const GuardDialog = useCallback(
    (): JSX.Element => (
      <Dialog
        onOpenChange={(_, data) => {
          if (!data.open) handleCancel();
        }}
        open={open}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>{t.guardTitle}</DialogTitle>
            <DialogContent>{t.guardBody}</DialogContent>
            <DialogActions>
              <Button appearance="outline" onClick={handleCancel}>
                {t.cancel}
              </Button>
              <Button
                appearance="primary"
                onClick={() => void handleConfirm()}
              >
                {t.guardConfirm}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    ),
    [open, handleCancel, handleConfirm],
  );

  return { requestGuarded, GuardDialog };
};
