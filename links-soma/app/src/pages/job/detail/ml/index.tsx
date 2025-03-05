import {
  makeStyles,
  tokens,
  Text,
  typographyStyles,
  mergeClasses,
  Tooltip,
} from "@fluentui/react-components";
import { useNavigate, useParams } from "react-router-dom";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { ArrowLeftRegular } from "@fluentui/react-icons";
import { DialogSaveWithName } from "../../../../components/dialog-save-with-name";
import { useFetchJobTasks } from "../../../../hooks/use-fetch-job-tasks";
import { useFetchJobResults } from "../../../../hooks/use-fetch-job-results";
import { downloadFile } from "../../../../utils/download-file";
import { useDialogState } from "../../../../hooks/use-dialog-state";
import { useFetchJobs } from "../../../../hooks/use-fetch-jobs";
import { Button } from "../../../../components/ui/button";
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
    display: "flex",
    width: "fit-content",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    ...typographyStyles.subtitle1,
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
  message: {
    color: "#09583B",
  },
  buttonWrapper: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
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
  columnContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "left",
    backgroundColor: "#fff",
    padding: tokens.spacingVerticalXXL,
    width: "100%",
    height: "fit-content",
  },
  columnTitle: typographyStyles.subtitle2,
  chartContainer: {
    width: "100%",
    marginTop: tokens.spacingVerticalL,
    position: "relative",
    display: "flex",
  },
  yAxisLabel: {
    width: "100px",
    display: "flex",
    flexDirection: "column",
    height: "100%",
    boxSizing: "border-box",
    gap: "9px",
  },
  barContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  barWrapper: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: `${tokens.spacingHorizontalS} 0`,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  bar: {
    height: "20px",
    backgroundColor: "#6264A7",
  },
  xAxis: {
    position: "relative",
    height: "20px",
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  xAxisTicks: {
    position: "relative",
    top: "-5px",
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
  },
  xAxisLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  yAxisLabelText: {
    maxWidth: "150px",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    marginTop: tokens.spacingHorizontalS,
    height: "20px",
  },
  graphWrapper: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
  },
  radarChartContainer: {
    backgroundColor: "#fff",
    padding: tokens.spacingVerticalXXL,
    width: "448px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  titleWrapper: {
    display: "flex",
    alignItems: "flex-start",
    width: "100%",
  },
  radarChartTitle: typographyStyles.subtitle2,
  detail: {
    backgroundColor: "#FDF7F8",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusSmall,
    width: "100%",
  },
  callout: {
    backgroundColor: "#ecf2ef",
    color: "#09583B",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusSmall,
    width: "100%",
    marginTop: tokens.spacingVerticalS,
  },
  saveWithNameButton: {
    backgroundColor: "#09583B",
    color: "#fff",
    "&:hover": {
      border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    },
  },
});

const SAFE_COLOR = "#8884d8";
const ERROR_COLOR = "#C4314B";

const MESSAGE = {
  info: "処理が完了しました。",
  error: "処理に失敗しました。",
};

export function MlDetail(): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data } = useFetchJobTasks({ jobId: Number(id) });
  const { data: jobResultsData } = useFetchJobResults({ jobId: Number(id) });
  const { data: job, mutate } = useFetchJobs(Number(id));

  const dialogState = useDialogState();

  if (!data || data.length === 0 || !data[0].result)
    return <>データが存在しません</>;
  if (data[0].result.taskResultType === "preprocess")
    return <>データ形式が正しくありません</>;

  const isError = job && job[0].status === "error";

  /** @see https://project-links.slack.com/archives/C074TSBS7PW/p1731043911917709?thread_ts=1730328973.471009&cid=C074TSBS7PW */
  const isLowAccuracy = data && Number(data[0].result.accuracy) < 51;

  const handleBack = (): void => {
    navigate(-1);
  };

  const result = data[0].result;
  const isNamed = job && job[0].is_named;

  // result オブジェクトから radarData を生成
  const radarData = [
    { subject: "正解率", A: Number.parseFloat(result.accuracy) },
    { subject: "F値", A: Number.parseFloat(result.f1Score) },
    { subject: "特異度", A: Number.parseFloat(result.specificity) },
    { subject: "適合率", A: Number.parseFloat(result.precision) },
    { subject: "再現率", A: Number.parseFloat(result.recall) },
  ];

  // important_columns から chartData を生成
  const chartData =
    result.important_columns && result.important_columns.length
      ? result.important_columns.map((item) => ({
          label: item.column,
          value: Number.parseFloat(item.value),
        }))
      : [];

  // 取りうる値の最大値を取得し、10分割してxAxisLabelsを作成
  const maxValue = Math.max(...chartData.map((data) => data.value || 0));
  const roundedMaxValue = Math.ceil(maxValue / 10) * 10;
  const xAxisLabels = Array.from({ length: 11 }, (_, i) =>
    ((roundedMaxValue / 10) * i).toFixed(1),
  );

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
              children: "処理結果 - モデル構築",
              current: true,
              href: ROUTES.JOB.DETAIL_ML(id || ""),
            },
          ].map((item) => (
            <BreadcrumbItem key={item.href} {...item} />
          ))}
        />
        <div className={styles.heading}>
          <Button
            appearance="subtle"
            icon={<ArrowLeftRegular />}
            onClick={handleBack}
          />
          処理結果
        </div>

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
                  await window.ipcRenderer.invoke("createModelFiles", {
                    jobId: jobResultsData.job_id,
                    insertParams: {
                      file_name: inputValue,
                      file_path: jobResultsData.file_path,
                    },
                  });
                  await mutate();
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

        <div className={styles.graphWrapper}>
          {/* RadarChart */}
          <div className={styles.radarChartContainer}>
            <div className={styles.titleWrapper}>
              <span className={styles.radarChartTitle}>
                処理結果のパラメーター
              </span>
            </div>
            <RadarChart
              cx={200}
              cy={200}
              data={radarData}
              height={400}
              outerRadius={150}
              width={400}
            >
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <PolarRadiusAxis angle={90} domain={[0, 100]} />
              <Radar
                dataKey="A"
                fill={isLowAccuracy ? ERROR_COLOR : SAFE_COLOR}
                fillOpacity={0.6}
                name="指標"
                stroke={isLowAccuracy ? ERROR_COLOR : SAFE_COLOR}
              />
            </RadarChart>
            {isLowAccuracy && (
              <div className={styles.detail}>
                学習データ量が少なすぎます。正答率を上げるためには、〇〇以上のデータに修正して再実行をしてください。
              </div>
            )}
            <div className={styles.callout}>
              <Text>
                各指標について：
                <ul style={{ margin: "8px 0 0 20px", padding: 0 }}>
                  <li>
                    正解率：全てのケースのうち、空き家と非空き家を正しく判定できた割合
                  </li>
                  <li>
                    F値：適合率と再現率のバランスを示す指標。空き家判定の総合的な性能を表す
                  </li>
                  <li>
                    特異度：実際に非空き家である物件を、正しく非空き家と判定できた割合
                  </li>
                  <li>
                    適合率：空き家と判定した物件のうち、実際に空き家だった割合
                  </li>
                  <li>
                    再現率：実際の空き家のうち、正しく空き家と判定できた割合
                  </li>
                </ul>
              </Text>
            </div>
          </div>
          {/* 棒グラフ */}
          <div className={styles.columnContainer}>
            <span className={styles.columnTitle}>重要度の高いカラム</span>
            <div className={styles.chartContainer}>
              {/* Y軸のラベル */}
              <div className={styles.yAxisLabel}>
                {chartData.map((data, index) => (
                  <Tooltip
                    key={index}
                    content={data.label || "--"}
                    relationship="label"
                  >
                    <Text className={styles.yAxisLabelText}>
                      {data.label || "--"}
                    </Text>
                  </Tooltip>
                ))}
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.barContainer}>
                  {chartData.map((data, index) => (
                    <div key={index} className={styles.barWrapper}>
                      <div
                        className={styles.bar}
                        style={{ width: `${data.value || 0}%` }}
                      ></div>
                      <Text style={{ marginLeft: tokens.spacingHorizontalS }}>
                        {data.value ? data.value.toFixed(1) : "--"}
                      </Text>
                    </div>
                  ))}
                </div>

                {/* X軸 */}
                <div className={styles.xAxis}>
                  <div className={styles.xAxisTicks}>
                    {xAxisLabels.map((label, index) => (
                      <div
                        key={index}
                        style={{
                          position: "absolute",
                          left: `${(index * 100) / 10}%`,
                          transform: "translateX(-50%)",
                        }}
                      >
                        <Text className={styles.xAxisLabel}>{label}</Text>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.restartButtonWrapper}>
        <Button
          appearance="primary"
          onClick={() => navigate(`/model/create/${id}`)}
        >
          再実行へ
        </Button>
      </div>
    </div>
  );
}
