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
} from "@fluentui/react-components";
import { ErrorCircleFilled, ArrowLeftRegular } from "@fluentui/react-icons";
import { useNavigate, useParams } from "react-router-dom";
import { DialogSaveWithName } from "../../../../components/dialog-save-with-name";
import { useFetchJobTasks } from "../../../../hooks/use-fetch-job-tasks";
import { type SelectJobTask } from "../../../../schema";
import { downloadFile } from "../../../../utils/download-file";
import { useFetchJobResults } from "../../../../hooks/use-fetch-job-results";
import { useDialogState } from "../../../../hooks/use-dialog-state";
import { Button } from "../../../../components/ui/button";
import { useFetchJobs } from "../../../../hooks/use-fetch-jobs";
import { ErrorJobTaskInfo } from "../../../../components/error-job-task-info";
import {
  BreadcrumbBase,
  BreadcrumbItem,
} from "../../../../components/ui/breadcrumb";
import { ROUTES } from "../../../../routes";

const useStyles = makeStyles({
  root: {
    display: "grid",
    gap: tokens.spacingVerticalXXL,
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
    color: "#09583B",
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
    color: "#09583B",
  },
  error: {
    backgroundColor: "rgba(196, 49, 75, 0.08)",
    color: "rgb(196, 49, 75)",
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
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "#fff",
    height: "68px",
    width: "100%",
    padding: tokens.spacingHorizontalXXL,
  },
  noData: {
    color: "#616161",
    fontSize: tokens.fontSizeBase300,
  },
  saveWithNameButton: {
    backgroundColor: "#09583B",
    color: "#fff",
    "&:hover": {
      border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    },
  },
});

/**
 * @todo PreprocessTypeの日本語表現を追加する
 * https://github.com/eukarya-inc/links-akiya/issues/447
 * */
const PreprocessTypeMap: {
  [key in Exclude<SelectJobTask["preprocess_type"], null>]: string;
} = {
  e014: "テキストマッチング機能",
  e016: "空間結合機能",
};

const PreprocessPercentTypeMap: {
  [key in Exclude<SelectJobTask["preprocess_type"], null>]: string;
} = {
  e014: "結合率",
  e016: "結合率",
};

const MESSAGE = {
  info: "処理が完了しました。",
  error: "処理に失敗しました。",
};

export function PreprocessDetail(): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data } = useFetchJobTasks({ jobId: Number(id) });
  const { data: jobResultsData } = useFetchJobResults({ jobId: Number(id) });
  const { data: job, mutate } = useFetchJobs(Number(id));

  const dialogState = useDialogState();

  const hasData = data && data.length > 0;

  const handlePreviewClick = (): void => {
    navigate(`/job/preview/${id}`);
  };

  const handleBack = (): void => {
    navigate(-1);
  };

  const isNamed = job && job[0].is_named;

  const isError = job && job[0].status === "error";

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
              children: "処理結果 - 前処理",
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
            isError ? styles.error : styles.info,
          )}
        >
          <span>{MESSAGE[isError ? "error" : "info"]}</span>
          {id && <ErrorJobTaskInfo jobId={Number(id)} />}
          {!isError && (
            <div className={styles.buttonWrapper}>
              <Button
                className={isNamed ? "" : styles.saveWithNameButton}
                disabled={isNamed}
                onClick={() => {
                  dialogState.setIsOpen(true);
                }}
              >
                名前をつけて保存
              </Button>
              <DialogSaveWithName
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
                }}
              />

              <Button onClick={handlePreviewClick}>プレビューを見る</Button>
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
                  /** e014, e016のみ表示する: https://project-links.slack.com/archives/C074TSBS7PW/p1732600089563499?thread_ts=1732155822.403759&cid=C074TSBS7PW */
                  const shouldShow = ["e014", "e016"].some(
                    (v) =>
                      item.preprocess_type && item.preprocess_type.includes(v),
                  );
                  if (item.preprocess_type === null) return null;
                  if (shouldShow) {
                    return (
                      <TableRow key={item.id}>
                        <TableCell className={styles.tableCell}>
                          {PreprocessTypeMap[item.preprocess_type]}
                          {item.result?.taskResultType === "preprocess" &&
                          item.result.input_source
                            ? `(${item.result.input_source.join(", ")})`
                            : ""}
                        </TableCell>
                        <TableCell className={styles.tableCell}>
                          {PreprocessPercentTypeMap[item.preprocess_type]}
                        </TableCell>
                        <TableCell className={styles.tableCell}>
                          <div className={styles.successRateCell}>
                            {getIndexRate(item)}
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
      </div>
      <div className={styles.restartButtonWrapper}>
        <Button
          appearance="primary"
          onClick={() => navigate(`/normalization/create/${id}`)}
        >
          再実行へ
        </Button>
      </div>
    </div>
  );
}

// 成功率を取得する関数
function getIndexRate(item: SelectJobTask): string {
  if (item.result?.taskResultType === "preprocess") {
    return parseFloat(item.result.joining_rate).toFixed(1);
  } else {
    return "N/A";
  }
}
