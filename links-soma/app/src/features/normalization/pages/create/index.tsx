import {
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { Button } from "../../../../shared/components/ui/button";
import { DialogSurface } from "../../../../shared/components/ui/dialog-surface";
import { DialogBody } from "../../../../shared/components/ui/dialog-body";
import { DialogTitle } from "../../../../shared/components/ui/dialog-title";
import { DialogContent } from "../../../../shared/components/ui/dialog-content";
import { DialogActions } from "../../../../shared/components/ui/dialog-actions";
import { useDialogState } from "../../../../shared/hooks/use-dialog-state";
import { useFetchJob } from "../../../job/hooks/use-fetch-job";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../../shared/components/ui/breadcrumb";
import { ROUTES } from "../../../../shared/config/routes";
import {
  type PreprocessParameters,
  type DraftPreprocessParameters,
} from "../../../../shared/types/job-parameters";
import { WizardContainer } from "./wizard-container";
import { TOTAL_STEPS } from "./wizard-steps";

const useStyles = makeStyles({
  pageWrapper: {
    display: "flex",
    flexDirection: "column",
    minHeight: "100vh",
    margin: `-${tokens.spacingVerticalXXL} -${tokens.spacingHorizontalXXL}`,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    boxSizing: "border-box",
  },
  header: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
  },
  wizardWrapper: {
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
});

export function NormalizationCreate(): JSX.Element {
  const styles = useStyles();
  const navigator = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { isOpen, setIsOpen } = useDialogState();
  const { data: job, isLoading: isJobLoading } = useFetchJob({
    id: Number(id),
  });

  // クエリパラメータで開始ステップを判定
  // ?step=confirm → 確認画面、?step=1 → ステップ1、なし → ステップ0
  const stepParam = searchParams.get("step");
  const parsedStep = Number(stepParam);
  const initialStep =
    stepParam === "confirm"
      ? TOTAL_STEPS - 1
      : !isNaN(parsedStep)
        ? Math.min(Math.max(0, parsedStep), TOTAL_STEPS - 1)
        : 0;

  // 下書きjobかどうかを判定
  const isDraft = job?.status === "draft" && job.type === "preprocess";

  // パラメータを取得
  // - draft: parametersをそのまま使用（下書き再開）
  // - 再実行: preprocessパラメータを使用
  const preprocessParameters =
    isDraft || job?.parameters.parameterType === "preprocess"
      ? (job?.parameters as PreprocessParameters)
      : undefined;

  // 下書きの場合、手動スキップ状態を取得
  const initialManuallySkippedSteps = isDraft
    ? (job?.parameters as DraftPreprocessParameters).manuallySkippedSteps
    : undefined;

  // 下書きの場合、住所の表記ゆれチェックjobのIDを取得
  const initialJoinCheckJobId = isDraft
    ? (job?.parameters as DraftPreprocessParameters).joinCheckJobId
    : undefined;

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.header}>
        <BreadcrumbBase
          breadcrumbItem={[
            {
              children: "名寄せ処理",
              href: ROUTES.NORMALIZATION.ROOT,
            },
            {
              children: "作成",
              current: true,
              href: ROUTES.NORMALIZATION.CREATE,
            },
          ].map((item) => (
            <BreadcrumbItem key={item.href} {...item} />
          ))}
        />
        <h2 className={styles.heading}>名寄せ処理</h2>
      </div>

      <div className={styles.wizardWrapper}>
        {!isJobLoading ? (
          <WizardContainer
            afterSubmit={() => {
              setIsOpen(true);
            }}
            initialJobId={isDraft ? job?.id : undefined}
            initialJoinCheckJobId={initialJoinCheckJobId}
            initialManuallySkippedSteps={initialManuallySkippedSteps}
            initialStep={initialStep}
            isDraft={isDraft}
            preprocessParameters={preprocessParameters}
          />
        ) : null}
      </div>

      {/* 完了ダイアログ */}
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
              データ名寄せ処理を開始しました
            </DialogTitle>
            <DialogContent>
              ご利用のパソコンの性能によっては、処理の開始に数分かかる場合があります。しばらく経っても処理の開始がされない場合は、時間をおいて処理一覧画面を再度表示してください。
            </DialogContent>
            <DialogActions>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="outline">キャンセル</Button>
              </DialogTrigger>
              <Button
                appearance="primary"
                onClick={() => {
                  navigator("/normalization");
                }}
              >
                処理のステータスを確認
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}
