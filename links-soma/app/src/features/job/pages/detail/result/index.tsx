import {
  Link,
  makeStyles,
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { ArrowLeftRegular, ChevronRightRegular } from "@fluentui/react-icons";
import { useNavigate, useParams } from "react-router-dom";
import {
  BreadcrumbBase,
  BreadcrumbItem,
  Button,
} from "../../../../../shared/components/ui";
import { useFetchJobs } from "../../../hooks/use-fetch-jobs";
import { useFetchJobTasks } from "../../../hooks/use-fetch-job-tasks";
import { useJobElapsedSec } from "../../../hooks/use-job-elapsed";
import { useFetchDataSetCount } from "../../../hooks/use-fetch-data-set-count";
import { useFetchDataSetResults } from "../../../../dataset/hooks/use-fetch-data-set-results";
import { ErrorJobTaskInfo } from "../../../components/error-job-task-info";
import {
  FOOTER_HEIGHT,
  SIDEBAR_WIDTH,
} from "../../../../../shared/config/layout-constants";
import { ROUTES, withHash } from "../../../../../shared/config/routes";
import { lang } from "../../../../../shared/config/lang";
import {
  useTutorial,
  tutorialStore,
} from "../../../../../shared/tutorial/store";
import {
  JobParametersSection,
  type VerificationSection,
} from "../../../components/job-parameters-section";
import { toProbabilityBinRows } from "../../../util/probability-bins";
import { toErrorSections } from "../../../util/error-rows";

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
    gap: tokens.spacingHorizontalM,
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
  const { phase, stage } = useTutorial();
  const isTutorialEvaluation = phase === "running" && stage === "evaluation";
  const { id } = useParams<{ id: string }>();
  const { data: job } = useFetchJobs(Number(id));
  const { data: jobTasks } = useFetchJobTasks({ jobId: Number(id) });
  const { data: dataSetResults } = useFetchDataSetResults();
  const realElapsedSec = useJobElapsedSec(Number(id));

  // 段階別処理時間。実行情報セクションの内訳・証跡DLで使う
  const stageTimingTask = jobTasks?.find(
    (task) => task.result?.taskResultType === "stage_timing",
  );
  const stageTiming =
    stageTimingTask?.result?.taskResultType === "stage_timing"
      ? stageTimingTask.result
      : null;

  // 現在のジョブIDに紐づく推定結果を取得
  const dataSetResult = dataSetResults?.find((r) => r.job_id === Number(id));
  const resultTitle = dataSetResult?.title;
  // NR007 ⑨ 空き家推定結果データの件数（建物単位）
  const estimationCount = useFetchDataSetCount(dataSetResult?.id, "building");

  // 検証情報DL（NR007）に含める推定結果とエラー。
  // 画面に出ている動的な情報とそのラベルを写す方針のため、値が無いものは行を作らない
  // （行0件のセクションは sectionsToText が丸ごと落とす）。
  const l = lang.components["job-parameters-section"];
  const verificationExtra: VerificationSection[] = [];
  const resultRows: [string, string][] = [];
  if (resultTitle) resultRows.push([l.estimationResultFileName, resultTitle]);
  if (estimationCount != null) {
    resultRows.push([
      l.estimationResultCount,
      `${estimationCount.toLocaleString()}件`,
    ]);
  }
  if (resultRows.length) {
    verificationExtra.push({
      title: l.estimationResultSection,
      rows: resultRows,
    });
  }
  verificationExtra.push(...toErrorSections(jobTasks, job?.[0]?.status));

  // #1987 確率帯ごとの件数。DLクリック時に取得する。全行走査になるためページ表示時に
  // 走らせず、実行中に開いた場合も押した時点の推定結果を数えるため。
  const datasetCount =
    job?.[0]?.parameters?.parameterType === "result"
      ? job[0].parameters.normalized_dataset_paths.length
      : 0;
  const buildProbabilityBinSections = async (): Promise<
    VerificationSection[]
  > => {
    if (dataSetResult?.id == null) return [];
    const bins = await window.ipcRenderer.invoke("selectProbabilityBins", {
      dataSetResultId: dataSetResult.id,
    });
    const rows = toProbabilityBinRows(bins);
    if (!rows.length) return [];
    // 複数年度は1つの分布に合算される。年度別の分布と読み違えないよう明示する
    const scopeRows: [string, string][] =
      datasetCount > 1
        ? [
            [
              l.probabilityBinScope,
              l.probabilityBinScopeMultiYear(datasetCount),
            ],
          ]
        : [];
    return [{ title: l.probabilityBinSection, rows: [...scopeRows, ...rows] }];
  };

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
            {isProcessing ? (
              "処理を実行中です"
            ) : isError ? (
              "空き家推定に失敗しました。"
            ) : (
              <>
                処理が完了しました。推定結果は「{resultTitle ?? ""}
                」というファイル名で
                {estimationCount != null
                  ? `${estimationCount.toLocaleString()}件`
                  : ""}
                保存されています。
                <Link
                  href={withHash(
                    ROUTES.DATASET({ queryParams: { tab: "result" } }),
                  )}
                >
                  空き家推定結果データタブ
                </Link>
                から確認できます。
              </>
            )}
          </span>
          {id && !isProcessing && <ErrorJobTaskInfo jobId={Number(id)} />}
        </div>
        {/* 実行情報 */}
        {job && job[0] && (
          <JobParametersSection
            deferredSections={buildProbabilityBinSections}
            durations={{
              totalRealSec: realElapsedSec,
              durationTotalSec: stageTiming?.totalSec,
              stages: stageTiming?.stages,
            }}
            extraSections={verificationExtra}
            job={job[0]}
          />
        )}
      </div>
      <div className={styles.restartButtonWrapper}>
        <Button
          appearance="outline"
          onClick={() => navigate(ROUTES.EVALUATION.ROOT)}
        >
          空き家推定画面へ
        </Button>
        <Button
          appearance="primary"
          icon={<ChevronRightRegular />}
          iconPosition="after"
          onClick={() => {
            // 分析工程の推定結果名はガイドが evaluation_job_id から都度導出するため
            // ここでの記録は不要。ハンドオフのみ行う（ADR-0024）。
            if (isTutorialEvaluation) tutorialStore.goToStage("analysis");
            navigate(ROUTES.ANALYSIS.WORKBOOK);
          }}
        >
          分析で結果を確認
        </Button>
      </div>
    </div>
  );
}
