import {
  Caption1,
  Caption1Strong,
  makeStyles,
  tokens,
  Text,
  typographyStyles,
  mergeClasses,
  Tooltip,
} from "@fluentui/react-components";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeftRegular } from "@fluentui/react-icons";
import { DialogSaveWithName } from "../../../../../shared/components/dialog-save-with-name";
import { useFetchJobTasks } from "../../../hooks/use-fetch-job-tasks";
import { useFetchJobResults } from "../../../hooks/use-fetch-job-results";
import { useFetchModelFiles } from "../../../../model/hooks/use-fetch-model-files";
import { downloadFile } from "../../../../../shared/utils/download-file";
import { toOdsDisplayName } from "../../../../../shared/types/optional-data-source";
import { useDialogState } from "../../../../../shared/hooks/use-dialog-state";
import { useFetchJobs } from "../../../hooks/use-fetch-jobs";
import {
  BreadcrumbBase,
  BreadcrumbItem,
  Button,
  TextWithTooltip,
} from "../../../../../shared/components/ui";
import { ErrorJobTaskInfo } from "../../../components/error-job-task-info";
import { JobParametersSection } from "../../../components/job-parameters-section";
import {
  FOOTER_HEIGHT,
  SIDEBAR_WIDTH,
} from "../../../../../shared/config/layout-constants";
import { THEME_COLORS } from "../../../../../shared/config/theme-colors";
import { ROUTES } from "../../../../../shared/config/routes";

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
    borderRadius: tokens.borderRadiusSmall,
  },
  info: {
    backgroundColor: THEME_COLORS.successBackground,
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
  message: {
    color: THEME_COLORS.success,
  },
  buttonWrapper: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
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
  metricsWrapper: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    flexWrap: "wrap",
  },
  metricsCard: {
    backgroundColor: "#fff",
    padding: tokens.spacingVerticalXXL,
    flex: "1 1 300px",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  metricsTitle: typographyStyles.subtitle2,
  metricsTable: {
    width: "100%",
    borderCollapse: "collapse" as const,
  },
  metricsTableHeader: {
    backgroundColor: tokens.colorNeutralBackground2,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    textAlign: "left" as const,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  metricsTableHeaderRight: {
    textAlign: "right" as const,
  },
  metricsTableCell: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: tokens.fontSizeBase300,
  },
  metricsTableCellValue: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    fontSize: tokens.fontSizeBase300,
    textAlign: "right" as const,
    fontWeight: tokens.fontWeightSemibold,
  },
  thresholdCard: {
    backgroundColor: "#fff",
    padding: tokens.spacingVerticalXXL,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  thresholdGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: tokens.spacingVerticalM,
  },
  thresholdItem: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusSmall,
  },
  thresholdLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  thresholdValue: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  callout: {
    backgroundColor: THEME_COLORS.successBackground,
    color: THEME_COLORS.success,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusSmall,
    width: "100%",
    marginTop: tokens.spacingVerticalS,
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
  noteCard: {
    backgroundColor: "#fff",
    padding: tokens.spacingVerticalXXL,
    width: "100%",
  },
  noteTitle: {
    ...typographyStyles.subtitle2,
    display: "block",
    marginBottom: tokens.spacingVerticalS,
  },
  noteText: {
    color: tokens.colorNeutralForeground1,
    whiteSpace: "pre-wrap" as const,
  },
  noParametersSection: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  noParametersHeading: {
    color: tokens.colorNeutralForeground3,
  },
});

const MESSAGE = {
  info: "モデル構築が完了しました。",
  error: "処理に失敗しました。",
  processing: "処理を実行中です",
};

export function MlDetail(): JSX.Element {
  const styles = useStyles();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data } = useFetchJobTasks({ jobId: Number(id) });
  const { data: jobResultsData } = useFetchJobResults({ jobId: Number(id) });
  const { data: job, mutate } = useFetchJobs(Number(id));
  const { data: modelFiles } = useFetchModelFiles();

  // job_idに対応するmodel_fileを取得
  const modelFile = modelFiles?.find(
    (file) => file.created_by_job_id === Number(id),
  );

  const dialogState = useDialogState();
  const isNamed = !!modelFile;
  const mlParams =
    job?.[0]?.parameters?.parameterType === "ml"
      ? job[0].parameters
      : undefined;
  const hasParameters =
    !!mlParams?.input_path &&
    (mlParams?.settings?.explanatory_variables?.length ?? 0) > 0;

  const getDefaultName = (): string => {
    const createdAt = job?.[0]?.created_at;
    if (!createdAt) return "";
    const date = new Date(createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}年${month}月${day}日_モデル`;
  };

  const isError = job && job[0].status === "error";
  const isProcessing =
    job &&
    job[0].status !== "complete" &&
    job[0].status !== "error" &&
    job[0].status !== "draft";

  // 処理中でない場合のみ結果データを検証
  const hasValidResult =
    data &&
    data.length > 0 &&
    data[0].result &&
    data[0].result.taskResultType !== "preprocess" &&
    data[0].result.taskResultType !== "preprocess_summary" &&
    data[0].result.taskResultType !== "join_check";

  if (!isProcessing && !isError && !hasValidResult)
    return <>データが存在しません</>;

  const handleBack = (): void => {
    navigate(-1);
  };

  // 結果データが存在する場合のみグラフ用データを計算
  const result =
    hasValidResult && data[0].result?.taskResultType === "model_create"
      ? data[0].result
      : null;

  // 比率（0〜1）をパーセンテージ文字列に変換するヘルパー
  // E021は比率で出力するため、表示時に×100する
  const toPercent = (value: string | undefined, decimals = 1): string => {
    if (!value) return "--";
    const num = Number.parseFloat(value);
    if (Number.isNaN(num)) return "--";
    return `${(num * 100).toFixed(decimals)}%`;
  };

  // Precision@K テーブルデータ
  const precisionAtKData = result
    ? [
        { k: "100", value: result.precisionAt100 },
        { k: "500", value: result.precisionAt500 },
        { k: "1,000", value: result.precisionAt1000 },
        { k: "3,000", value: result.precisionAt3000 },
        { k: "5,000", value: result.precisionAt5000 },
      ]
    : [];

  // Lift テーブルデータ
  const liftData = result
    ? [
        { k: "1,000", value: result.liftAt1000 },
        { k: "5,000", value: result.liftAt5000 },
      ]
    : [];

  // important_columns から chartData を生成
  const chartData =
    result?.important_columns && result.important_columns.length
      ? result.important_columns.map((item) => ({
          label: toOdsDisplayName(item.column),
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
            <>
              <div className={styles.buttonWrapper}>
                {isNamed ? (
                  <Text className={styles.savedLabel}>
                    「{modelFile?.file_name}」として保存済み
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
                    await window.ipcRenderer.invoke("createModelFiles", {
                      insertParams: {
                        file_name: inputValue,
                        file_path: jobResultsData.file_path,
                        created_by_job_id: jobResultsData.job_id,
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
            </>
          )}
        </div>

        {result && modelFile?.note && (
          <div className={styles.noteCard}>
            <span className={styles.noteTitle}>モデル説明</span>
            <Text className={styles.noteText}>{modelFile.note}</Text>
          </div>
        )}

        {result && (
          <>
            {/* Precision@K と Lift */}
            <div className={styles.metricsWrapper}>
              {/* Precision@K テーブル */}
              <div className={styles.metricsCard}>
                <span className={styles.metricsTitle}>
                  <TextWithTooltip
                    textNode={"Precision@K（上位K件中の空き家割合）"}
                    tooltipContent={
                      <>
                        •モデルが「空き家の可能性が⾼い」と判定した上位K件のうち、既に空き家として把握されている建物がどれ
                        だけ含まれているかを⽰します。（Precision@100が88%＝上位100件のうち88件が把握済み空き家だった）
                        <br />
                        •既に空き家と把握されている建物とは、「空き家調査結果データ」をもとにしています。
                        <br />
                        •この数値は「⾃治体が既に空き家として台帳等で把握している建物」に対する⼀致率です。把握されていない空き家は「未知」として扱われるため、Precisionが低くても直ちにモデルの品質が悪いとは限りません。
                      </>
                    }
                  />
                </span>
                <table className={styles.metricsTable}>
                  <thead>
                    <tr>
                      <th className={styles.metricsTableHeader}>上位K件</th>
                      <th
                        className={mergeClasses(
                          styles.metricsTableHeader,
                          styles.metricsTableHeaderRight,
                        )}
                      >
                        Precision（%）
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {precisionAtKData.map((row) => (
                      <tr key={row.k}>
                        <td className={styles.metricsTableCell}>{row.k}</td>
                        <td className={styles.metricsTableCellValue}>
                          {toPercent(row.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Lift テーブル */}
              <div className={styles.metricsCard}>
                <span className={styles.metricsTitle}>
                  <TextWithTooltip
                    textNode="Lift（ランダム抽出比）"
                    tooltipContent={
                      <>
                        •ランダムに建物を選んだ場合と⽐べて、モデルを使うことで何倍効率よく空き家を⾒つけられるかを⽰します。（Lift@Kが8.71X＝上位1,000件で⾒ると、ランダムに選んだ場合の約8.7倍の効率で既知の空き家が含まる）
                        <br />
                        •Liftが1.0に近い場合、モデルがランダムと変わらない選び⽅をしていることを意味します。上位K件のLiftが極端に低い場合（たとえば2倍未満）は、モデルが有効に機能していない可能性があります
                      </>
                    }
                  />
                </span>
                <table className={styles.metricsTable}>
                  <thead>
                    <tr>
                      <th className={styles.metricsTableHeader}>上位K件</th>
                      <th
                        className={mergeClasses(
                          styles.metricsTableHeader,
                          styles.metricsTableHeaderRight,
                        )}
                      >
                        Lift（倍）
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {liftData.map((row) => (
                      <tr key={row.k}>
                        <td className={styles.metricsTableCell}>{row.k}</td>
                        <td className={styles.metricsTableCellValue}>
                          {row.value
                            ? `${Number.parseFloat(row.value).toFixed(2)}x`
                            : "--"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 判定ライン */}
            <div className={styles.thresholdCard}>
              <span className={styles.metricsTitle}>
                <TextWithTooltip
                  textNode="判定ライン"
                  tooltipContent={
                    <>
                      •空き家候補として抽出する件数やその基準（閾値）を⽰します。
                      <br />
                      •再現率⽬標を⾼く設定する（＝既知の空き家をなるべく漏らさない）ほど、閾値が下がり、候補件数は増えます。候補件数が増えれば、その中には空き家ではない建物も多く含まれることになります。逆に、再現率⽬標を下げると候補件数は絞られますが、実際の空き家を⾒落とすリスクが⾼まります。
                      <br />
                      •この設定は、空き家の調査体制や⽬的に応じて判断します。たとえば、限られた⼈員で効率よく調査したい場合は候補件数を絞る⽅向、なるべく⾒落としを減らしたい場合は候補件数が増えることを許容する等です。
                    </>
                  }
                />
              </span>
              <div className={styles.thresholdGrid}>
                <div className={styles.thresholdItem}>
                  <span className={styles.thresholdLabel}>再現率目標</span>
                  <span className={styles.thresholdValue}>
                    {toPercent(result.recallTarget)}
                  </span>
                </div>
                <div className={styles.thresholdItem}>
                  <span className={styles.thresholdLabel}>判定閾値スコア</span>
                  <span className={styles.thresholdValue}>
                    {result.threshold
                      ? Number.parseFloat(result.threshold).toFixed(4)
                      : "--"}
                  </span>
                </div>
                <div className={styles.thresholdItem}>
                  <span className={styles.thresholdLabel}>候補件数</span>
                  <span className={styles.thresholdValue}>
                    {result.candidateCount
                      ? `${Number.parseInt(result.candidateCount).toLocaleString()}件`
                      : "--"}
                  </span>
                </div>
                <div className={styles.thresholdItem}>
                  <span className={styles.thresholdLabel}>候補割合</span>
                  <span className={styles.thresholdValue}>
                    {toPercent(result.candidateRatio)}
                  </span>
                </div>
              </div>
            </div>

            {/* 特徴量重要度の棒グラフ */}
            <div className={styles.columnContainer}>
              <span className={styles.columnTitle}>
                <TextWithTooltip
                  textNode={
                    chartData.length === 20
                      ? `特徴量重要度（上位${chartData.length}件を表示）`
                      : "特徴量重要度"
                  }
                  tooltipContent={
                    <>
                      •モデルがどのデータ項⽬をどの程度重視して推定しているかを⽰します。
                      <br />
                      •特徴量重要度はモデルが「そのデータ項⽬をどれだけ使ったか」を⽰すものであり、「その項⽬の値が⾼い（低い）と空き家になる」という因果関係を直接⽰すものではありません。
                      <br />
                      •説明変数が多い場合は上位20件のみ表示しています。
                    </>
                  }
                />
              </span>
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
                          style={{
                            width: `${roundedMaxValue > 0 ? ((data.value || 0) / roundedMaxValue) * 100 : 0}%`,
                          }}
                        ></div>
                        <Text style={{ marginLeft: tokens.spacingHorizontalS }}>
                          {data.value !== null && data.value !== undefined
                            ? data.value.toFixed(1)
                            : "--"}
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
          </>
        )}
        {/* 実行設定 */}
        {job && job[0] && hasParameters ? (
          <JobParametersSection job={job[0]} />
        ) : (
          <div className={styles.noParametersSection}>
            <Caption1Strong className={styles.noParametersHeading}>
              実行設定
            </Caption1Strong>
            <Caption1>なし</Caption1>
          </div>
        )}

        <div className={styles.restartButtonWrapper}>
          {hasParameters ? (
            <Button
              appearance="primary"
              onClick={() => navigate(ROUTES.MODEL.RECREATE(id || ""))}
            >
              再実行へ
            </Button>
          ) : (
            <Button
              appearance="primary"
              onClick={() => navigate(ROUTES.MODEL.ROOT)}
            >
              モデル構築へ
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
