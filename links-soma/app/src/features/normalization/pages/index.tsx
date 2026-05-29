import { useState, useCallback } from "react";
import { Card, makeStyles, tokens } from "@fluentui/react-components";
import { AddFilled } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../shared/components/ui/button";
import { TableJobsByType } from "../../job/components/table-jobs-by-type";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../shared/components/ui/breadcrumb";
import { ROUTES } from "../../../shared/config/routes";
import { useFetchDraftJob } from "../hooks/use-fetch-draft-job";
import { notifyJobChanged } from "../../job/hooks/job-change-notifier";
import { DialogDraftConfirm } from "./_components/dialog-draft-confirm";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
  },
  content: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    flexDirection: "column",
    minHeight: "300px",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    gap: tokens.spacingVerticalXL,
  },
  buttonContainer: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
  },
});

export function Normalization(): JSX.Element {
  const styles = useStyles();
  const navigator = useNavigate();
  const { data: draftJob } = useFetchDraftJob();
  const [showDraftConfirmDialog, setShowDraftConfirmDialog] = useState(false);

  // 「名寄せ処理を始める」ボタンクリック時
  const handleStartClick = useCallback(() => {
    if (draftJob) {
      // 下書きがある場合は確認ダイアログを表示
      setShowDraftConfirmDialog(true);
    } else {
      // 下書きがない場合は直接ウィザードへ
      navigator("/normalization/create");
    }
  }, [draftJob, navigator]);

  // 「続ける」ボタンクリック時
  const handleContinueDraft = useCallback(() => {
    setShowDraftConfirmDialog(false);
    if (draftJob) {
      navigator(`/normalization/create/${draftJob.id}?step=confirm`);
    }
  }, [draftJob, navigator]);

  // 「新規作成」ボタンクリック時
  const handleNewCreate = useCallback(async () => {
    if (draftJob) {
      // 既存の下書きを削除
      await window.ipcRenderer.invoke("deleteJob", { id: draftJob.id });
      // Normalization の draftJob および処理一覧テーブルを再取得
      notifyJobChanged();
    }
    setShowDraftConfirmDialog(false);
    navigator("/normalization/create");
  }, [draftJob, navigator]);

  // ダイアログを閉じる
  const handleCloseDialog = useCallback(() => {
    setShowDraftConfirmDialog(false);
  }, []);

  return (
    <div className={styles.root}>
      <BreadcrumbBase
        breadcrumbItem={[
          {
            children: "名寄せ処理",
            current: true,
            href: ROUTES.NORMALIZATION.ROOT,
          },
        ].map((item) => (
          <BreadcrumbItem key={item.href} {...item} />
        ))}
      />
      <h2 className={styles.heading}>名寄せ処理</h2>

      <Card className={styles.content}>
        <div className={styles.buttonContainer}>
          <Button
            icon={
              <AddFilled
                color={tokens.colorNeutralForeground1}
                fontSize={tokens.fontSizeBase400}
                strokeWidth={2}
              />
            }
            onClick={handleStartClick}
            size="small"
          >
            名寄せ処理を始める
          </Button>
        </div>

        <TableJobsByType jobType="preprocess" />
      </Card>

      {/* 下書き確認ダイアログ */}
      <DialogDraftConfirm
        onClose={handleCloseDialog}
        onContinue={handleContinueDraft}
        onNewCreate={handleNewCreate}
        open={showDraftConfirmDialog}
      />
    </div>
  );
}
