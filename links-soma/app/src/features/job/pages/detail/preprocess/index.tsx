import {
  Card,
  makeStyles,
  tokens,
  Table,
  TableHeader,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  mergeClasses,
  Caption1,
  Subtitle2,
  Text,
} from "@fluentui/react-components";
import { ErrorCircleFilled, ArrowLeftRegular } from "@fluentui/react-icons";
import { useNavigate, useParams } from "react-router-dom";
import { DialogSaveWithName } from "../../../../../shared/components/dialog-save-with-name";
import { useFetchJobTasks } from "../../../hooks/use-fetch-job-tasks";
import { type SelectJobTask } from "../../../../../db/schema";
import { type PreprocessParameters } from "../../../../../shared/types/job-parameters";
import { downloadFile } from "../../../../../shared/utils/download-file";
import { useFetchJobResults } from "../../../hooks/use-fetch-job-results";
import { useDialogState } from "../../../../../shared/hooks/use-dialog-state";
import {
  BreadcrumbBase,
  BreadcrumbItem,
  Button,
} from "../../../../../shared/components/ui";
import { useFetchJobs } from "../../../hooks/use-fetch-jobs";
import { useFetchNormalizedDatasets } from "../../../../dataset/hooks/use-fetch-normalized-datasets";
import { ErrorJobTaskInfo } from "../../../components/error-job-task-info";
import {
  FOOTER_HEIGHT,
  SIDEBAR_WIDTH,
} from "../../../../../shared/config/layout-constants";
import { ROUTES } from "../../../../../shared/config/routes";
import { THEME_COLORS } from "../../../../../shared/config/theme-colors";
import { JobParametersSection } from "../../../components/job-parameters-section";
import { PreprocessSummaryView } from "./preprocess-summary-view";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
    position: "relative",
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
  content: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "flex-start",
    flexDirection: "column",
    minHeight: "300px",
    padding: `${tokens.spacingVerticalXXL} ${tokens.spacingHorizontalXXL}`,
    gap: tokens.spacingVerticalXL,
  },
  table: {
    width: "100%",
  },
  tableHeader: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  headerCell: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  tableCell: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontSize: tokens.fontSizeBase200,
  },
  successRateCell: {
    display: "flex",
    alignItems: "center",
    fontWeight: tokens.fontWeightBold,
    color: THEME_COLORS.success,
  },
  result: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    borderRadius: tokens.borderRadiusSmall,
  },
  info: {
    backgroundColor: "#ecf2ef",
    color: THEME_COLORS.success,
  },
  error: {
    backgroundColor: "rgba(196, 49, 75, 0.08)",
    color: "rgb(196, 49, 75)",
  },
  processing: {
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
  },
  buttonWrapper: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
  },
  errorIcon: {
    color: "#6264A7",
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
  noData: {
    color: "#616161",
    fontSize: tokens.fontSizeBase300,
  },
  saveWithNameButton: {
    backgroundColor: THEME_COLORS.success,
    color: "#fff",
    "&:hover": {
      border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    },
  },
  savedLabel: {
    display: "flex",
    alignItems: "center",
    color: THEME_COLORS.success,
    fontWeight: tokens.fontWeightSemibold,
  },
  jobListTitle: {
    marginTop: tokens.spacingVerticalXXL,
  },
});

const PreprocessPercentTypeMap: {
  [key in Exclude<SelectJobTask["preprocess_type"], null>]: string;
} = {
  e014: "結合率",
  e016: "結合率",
  e015: "結合率",
};

const MESSAGE = {
  info: "処理が完了しました。",
  error: "処理に失敗しました。",
  processing: "処理を実行中です",
};

export function PreprocessDetail(): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data } = useFetchJobTasks({ jobId: Number(id) });
  const { data: jobResultsData } = useFetchJobResults({ jobId: Number(id) });
  const { data: job, mutate } = useFetchJobs(Number(id));

  const { data: normalizedDatasets, mutate: mutateNormalizedDatasets } =
    useFetchNormalizedDatasets();
  const normalizedDataset = normalizedDatasets?.find(
    (ds) => ds.job_results_id === jobResultsData?.id,
  );

  const dialogState = useDialogState();

  const hasData = data && data.length > 0;

  // preprocess_summaryのタスクを取得
  const summaryTask = data?.find(
    (task) => task.result?.taskResultType === "preprocess_summary",
  );
  const summaryData =
    summaryTask?.result?.taskResultType === "preprocess_summary"
      ? summaryTask.result
      : null;

  const handleBack = (): void => {
    navigate(-1);
  };

  const isNamed = job && job[0].is_named;

  const isError = job && job[0].status === "error";
  const isProcessing =
    job &&
    job[0].status !== "complete" &&
    job[0].status !== "error" &&
    job[0].status !== "draft";

  const getDefaultName = (): string => {
    if (!job?.[0]?.parameters) return "";
    const params = job[0].parameters as PreprocessParameters;
    const refDate = params.settings?.reference_date;
    if (!refDate) return "";
    const [year, month, day] = refDate.split("-");
    return `推定日_${year}年${month}月${day}日_名寄せ処理済みデータ`;
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
              children: "処理結果 - 名寄せ処理",
              current: true,
              href: ROUTES.JOB.DETAIL_PREPROCESS(id || ""),
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
              ? MESSAGE.processing
              : MESSAGE[isError ? "error" : "info"]}
          </span>
          {id && !isProcessing && <ErrorJobTaskInfo jobId={Number(id)} />}
          {!isError && !isProcessing && (
            <div className={styles.buttonWrapper}>
              {isNamed ? (
                <Text className={styles.savedLabel}>
                  「{normalizedDataset?.file_name}」として保存済み
                </Text>
              ) : (
                <Button
                  className={styles.saveWithNameButton}
                  onClick={() => {
                    dialogState.setIsOpen(true);
                  }}
                >
                  名前をつけて保存
                </Button>
              )}
              <DialogSaveWithName
                defaultValue={getDefaultName()}
                dialogState={dialogState}
                onSave={async (inputValue: string) => {
                  if (!jobResultsData) return;
                  await window.ipcRenderer.invoke("createNormalizedDatasets", {
                    jobId: jobResultsData.job_id,
                    insertParams: {
                      file_name: inputValue,
                      file_path: jobResultsData.file_path,
                      job_results_id: jobResultsData.id,
                    },
                  });
                  await mutate();
                  await mutateNormalizedDatasets();
                }}
              />

              <Button
                onClick={async () => {
                  if (!jobResultsData) return;
                  await downloadFile(jobResultsData.file_path);
                }}
              >
                ダウンロード
              </Button>
            </div>
          )}
        </div>

        {/* 前処理サマリー */}
        {summaryData && <PreprocessSummaryView data={summaryData} />}

        <Subtitle2 className={styles.jobListTitle}>処理一覧</Subtitle2>

        {/* 処理一覧 */}
        <Card className={styles.content}>
          {hasData ? (
            <Table className={styles.table}>
              <TableHeader className={styles.tableHeader}>
                <TableRow>
                  <TableHeaderCell className={styles.headerCell}>
                    処理の種類
                  </TableHeaderCell>
                  <TableHeaderCell className={styles.headerCell}>
                    指標
                  </TableHeaderCell>
                  <TableHeaderCell className={styles.headerCell}>
                    成功率
                  </TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => {
                  const shouldShow = ["e014", "e015", "e016"].some(
                    (v) =>
                      item.preprocess_type && item.preprocess_type.includes(v),
                  );
                  if (item.preprocess_type === null) return null;
                  if (
                    item.result?.taskResultType === "preprocess" &&
                    !item.result.input_source
                  )
                    return null;
                  if (shouldShow) {
                    return (
                      <TableRow key={item.id}>
                        <TableCell className={styles.tableCell}>
                          {item.result?.taskResultType === "preprocess" &&
                            item.result.input_source}
                        </TableCell>
                        <TableCell className={styles.tableCell}>
                          {PreprocessPercentTypeMap[item.preprocess_type]}
                        </TableCell>
                        <TableCell className={styles.tableCell}>
                          <div className={styles.successRateCell}>
                            {getIndexRate(item)}
                            {item.result?.taskResultType === "preprocess" &&
                            item.result.success_rate ? (
                              <Caption1>{`(${item.result.success_rate})`}</Caption1>
                            ) : (
                              ""
                            )}
                            {item.error_code && (
                              <ErrorCircleFilled className={styles.errorIcon} />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  return null;
                })}
              </TableBody>
            </Table>
          ) : (
            <div className={styles.noData}>
              現在表示できる処理結果はありません
            </div>
          )}
        </Card>

        {/* 実行設定 */}
        {job && job[0] && <JobParametersSection job={job[0]} />}

        <div className={styles.restartButtonWrapper}>
          <Button
            appearance="primary"
            onClick={() => navigate(`/normalization/create/${id}?step=confirm`)}
          >
            再実行へ
          </Button>
        </div>
      </div>
    </div>
  );
}

// 成功率を取得する関数
function getIndexRate(item: SelectJobTask): string {
  if (item.result?.taskResultType === "preprocess") {
    return `${parseFloat(item.result.joining_rate).toFixed(1)}%`;
  } else {
    return "N/A";
  }
}
