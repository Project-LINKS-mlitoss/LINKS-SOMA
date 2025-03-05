import {
  Dialog,
  DialogTrigger,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useNavigate, useParams } from "react-router-dom";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { FormNormalization } from "../../../components/form-normalization";
import { Button } from "../../../components/ui/button";
import { DialogSurface } from "../../../components/ui/dialog-surface";
import { DialogBody } from "../../../components/ui/dialog-body";
import { DialogTitle } from "../../../components/ui/dialog-title";
import { DialogContent } from "../../../components/ui/dialog-content";
import { DialogActions } from "../../../components/ui/dialog-actions";
import { useDialogState } from "../../../hooks/use-dialog-state";
import { useFetchJob } from "../../../hooks/use-fetch-job";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../components/ui/breadcrumb";
import { ROUTES } from "../../../routes";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: tokens.spacingVerticalL,
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
  },
  content: {
    display: "block",
    minHeight: "300px",
  },
  stickyWrapper: {
    position: "relative",
    width: "100%",
    height: "100vh",
    overflowY: "scroll",
  },
  footerActions: {
    position: "sticky",
    bottom: 0,
    width: "100%",
    backgroundColor: "#fff",
    padding: `${tokens.spacingVerticalMNudge} ${tokens.spacingHorizontalXXL}`,
    display: "flex",
    justifyContent: "flex-end",
  },
});

const formId = "normalization-form";

export function NormalizationCreate(): JSX.Element {
  const styles = useStyles();
  const navigator = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { isOpen, setIsOpen } = useDialogState();
  const { data: job, isLoading: isJobLoading } = useFetchJob({
    id: Number(id),
  });
  const preprocessParameters =
    job?.parameters.parameterType === "preprocess" ? job.parameters : undefined;

  return (
    <>
      <div className={styles.stickyWrapper}>
        <div className={styles.root}>
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
          <div>
            {!isJobLoading ? (
              <FormNormalization
                afterSubmit={() => {
                  setIsOpen(true);
                }}
                formId={formId}
                preprocessParameters={preprocessParameters}
              />
            ) : null}
          </div>
        </div>
        <div className={styles.footerActions}>
          <Button
            appearance="primary"
            form={formId}
            size="medium"
            type="submit"
          >
            開始する
          </Button>
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
      </div>
    </>
  );
}
