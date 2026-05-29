import {
  Link,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeftRegular } from "@fluentui/react-icons";
import { useNavigate, useParams } from "react-router-dom";
import {
  BreadcrumbBase,
  BreadcrumbItem,
  Button,
} from "../../../../../shared/components/ui";
import { useFetchJobs } from "../../../hooks/use-fetch-jobs";
import { useFetchDataSetResults } from "../../../../dataset/hooks/use-fetch-data-set-results";
import { ErrorJobTaskInfo } from "../../../components/error-job-task-info";
import {
  FOOTER_HEIGHT,
  SIDEBAR_WIDTH,
} from "../../../../../shared/config/layout-constants";
import { ROUTES, withHash } from "../../../../../shared/config/routes";
import { JobParametersSection } from "../../../components/job-parameters-section";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
    paddingBottom: FOOTER_HEIGHT,
  },
  pageContainer: {
    display: "flex",
    flexDirection: "column",
    minHeight: "calc(100vh - 48px)",
    justifyContent: "space-between",
  },
  heading: {
    fontSize: tokens.fontSizeBase500,
    lineHeight: tokens.lineHeightBase600,
    display: "flex",
    width: "fit-content",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  result: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    backgroundColor: "#ecf2ef",
    borderRadius: tokens.borderRadiusSmall,
  },
  info: {
    backgroundColor: "#ecf2ef",
    color: "#09583B",
  },
  error: {
    backgroundColor: "rgba(196, 49, 75, 0.08)",
    color: "rgb(196, 49, 75)",
  },
  processing: {
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
  },
  restartButtonWrapper: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalXXL}`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    position: "fixed",
    bottom: 0,
    left: SIDEBAR_WIDTH,
    right: 0,
  },
});

export function ResultDetail(): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: job } = useFetchJobs(Number(id));
  const { data: dataSetResults } = useFetchDataSetResults();

  // 現在のジョブIDに紐づく推定結果を取得
  const resultTitle = dataSetResults?.find(
    (r) => r.job_id === Number(id),
  )?.title;

  const isError = job && job[0].status === "error";
  const isProcessing =
    job &&
    job[0].status !== "complete" &&
    job[0].status !== "error" &&
    job[0].status !== "draft";

  const handleBack = (): void => {
    navigate(-1);
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.root}>
        <BreadcrumbBase
          breadcrumbItem={[
            {
              children: "処理一覧",
              href: ROUTES.JOB.ROOT,
            },
            {
              children: "処理結果 - 推定結果",
              current: true,
              href: ROUTES.JOB.DETAIL_RESULT(id || ""),
            },
          ].map((item) => (
            <BreadcrumbItem key={item.href} {...item} />
          ))}
        />
        <h2 className={styles.heading}>
          <Button
            appearance="subtle"
            icon={<ArrowLeftRegular />}
            onClick={handleBack}
          />
          処理結果
        </h2>

        <div
          className={mergeClasses(
            styles.result,
            isProcessing
              ? styles.processing
              : isError
                ? styles.error
                : styles.info,
          )}
        >
          <span>
            {isProcessing
              ? "処理を実行中です"
              : isError
                ? "空き家推定に失敗しました。"
                : <>
                    処理が完了しました。推定結果は「{resultTitle ?? ""}」というファイル名で保存されています。
                    <Link
                      href={withHash(ROUTES.DATASET({ queryParams: { tab: "result" } }))}
                    >
                      空き家推定結果データタブ
                    </Link>
                    から確認できます。
                  </>}
          </span>
          {id && !isProcessing && <ErrorJobTaskInfo jobId={Number(id)} />}
        </div>
        {/* 実行設定 */}
        {job && job[0] && <JobParametersSection job={job[0]} />}
      </div>
      <div className={styles.restartButtonWrapper}>
        <Button appearance="primary" onClick={() => navigate(`/evaluation`)}>
          空き家推定画面へ
        </Button>
      </div>
    </div>
  );
}
