import { useState, useCallback, useEffect } from "react";
import { Card, makeStyles, tokens } from "@fluentui/react-components";
import { AddFilled } from "@fluentui/react-icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TableJobsByType } from "../../job/components/table-jobs-by-type";
import {
  BreadcrumbBase,
  BreadcrumbItem,
  Button,
} from "../../../shared/components/ui";
import { ROUTES } from "../../../shared/config/routes";
import {
  NORMALIZATION_PURPOSES,
  type NormalizationPurpose,
} from "../hooks/use-form-normalization";
import { useFetchDraftJob } from "../hooks/use-fetch-draft-job";
import { notifyJobChanged } from "../../job/hooks/job-change-notifier";
import { useGuideDraftGuard } from "../../../shared/tutorial/use-guide-draft-guard";
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
  const [searchParams] = useSearchParams();
  const { data: draftJob } = useFetchDraftJob();
  const [showDraftConfirmDialog, setShowDraftConfirmDialog] = useState(false);
  // ダイアログの発火経路。modelTraining はモデル構築画面の導線（新規開始専用）。
  const [dialogMode, setDialogMode] = useState<"resume" | "modelTraining">(
    "resume",
  );
  // modelTraining 導線で引き継ぐ目的（新規作成時に ?purpose= で渡す）。
  const [pendingPurpose, setPendingPurpose] =
    useState<NormalizationPurpose | null>(null);
  // 破壊操作（新規作成＝下書き削除）のガイド参照は述語フック経由で扱う
  // （ADR-0024: ドメインは tutorial の store を直接持たない）。
  const { guideReferenced, releaseIfReferenced } = useGuideDraftGuard(
    draftJob?.id,
  );

  // モデル構築画面の「名寄せ処理から始める」導線（?newPurpose=...）。
  // 下書きがあれば確認ダイアログ（新規開始専用）、なければそのままウィザードへ。
  // クエリは一度だけ消費し、再取得での再発火を防ぐため URL から除去する。
  useEffect(() => {
    if (draftJob === undefined) return; // 下書き取得中
    const raw = searchParams.get("newPurpose");
    if (raw == null) return;
    const purpose = (NORMALIZATION_PURPOSES as readonly string[]).includes(raw)
      ? (raw as NormalizationPurpose)
      : null;
    if (purpose != null && draftJob) {
      setPendingPurpose(purpose);
      setDialogMode("modelTraining");
      setShowDraftConfirmDialog(true);
      navigator(ROUTES.NORMALIZATION.ROOT, { replace: true });
    } else if (purpose != null) {
      navigator(`${ROUTES.NORMALIZATION.CREATE}?purpose=${purpose}`, {
        replace: true,
      });
    } else {
      navigator(ROUTES.NORMALIZATION.ROOT, { replace: true });
    }
  }, [draftJob, searchParams, navigator]);

  // 「名寄せ処理を始める」ボタンクリック時
  const handleStartClick = useCallback(() => {
    if (draftJob) {
      // 下書きがある場合は確認ダイアログを表示
      setDialogMode("resume");
      setPendingPurpose(null);
      setShowDraftConfirmDialog(true);
    } else {
      // 下書きがない場合は直接ウィザードへ
      navigator(ROUTES.NORMALIZATION.CREATE);
    }
  }, [draftJob, navigator]);

  // 「続ける」ボタンクリック時
  const handleContinueDraft = useCallback(() => {
    setShowDraftConfirmDialog(false);
    if (draftJob) {
      navigator(`/normalization/create/${draftJob.id}?step=confirm`);
    }
  }, [draftJob, navigator]);

  // 「新規作成」= 下書き削除。ガイド参照中はダイアログ文言で重さを伝え、確認 1 枚で
  // ガイド解放＋削除を実行する（確認を二重に重ねない）。
  // modelTraining 導線では引き継いだ目的を ?purpose= で渡す。
  const handleNewCreate = useCallback(async () => {
    if (draftJob) {
      releaseIfReferenced();
      // 既存の下書きを削除
      await window.ipcRenderer.invoke("deleteJob", { id: draftJob.id });
      // Normalization の draftJob および処理一覧テーブルを再取得
      notifyJobChanged();
    }
    setShowDraftConfirmDialog(false);
    navigator(
      pendingPurpose != null
        ? `${ROUTES.NORMALIZATION.CREATE}?purpose=${pendingPurpose}`
        : ROUTES.NORMALIZATION.CREATE,
    );
  }, [draftJob, releaseIfReferenced, navigator, pendingPurpose]);

  // ダイアログを閉じる
  const handleCloseDialog = useCallback(() => {
    setShowDraftConfirmDialog(false);
    setPendingPurpose(null);
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

      {/* 下書き確認ダイアログ（ガイド参照中は文言を強め、確認 1 枚で完結） */}
      <DialogDraftConfirm
        guideReferenced={guideReferenced}
        mode={dialogMode}
        onClose={handleCloseDialog}
        onContinue={handleContinueDraft}
        onNewCreate={handleNewCreate}
        open={showDraftConfirmDialog}
      />
    </div>
  );
}
