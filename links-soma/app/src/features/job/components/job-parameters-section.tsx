import { Fragment, useState } from "react";
import {
  makeStyles,
  mergeClasses,
  tokens,
  Caption1Strong,
  Caption2,
} from "@fluentui/react-components";
import {
  ChevronRight16Regular,
  ChevronDown16Regular,
  ArrowDownload16Regular,
} from "@fluentui/react-icons";
import { Link } from "react-router-dom";
import { Button } from "../../../shared/components/ui";
import { downloadText } from "../../../shared/utils/download-text";
import { rendererLogger } from "../../../shared/utils/renderer-logger";
import { type SelectJob } from "../../../db/schema";
import {
  type PreprocessParameters,
  type ModelCreateParameters,
  type ResultParameters,
  type ExportParameters,
} from "../../../shared/types/job-parameters";
import { useResolveJobFileNames } from "../hooks/use-resolve-job-file-names";
import {
  useFetchDataSetFileStats,
  type DataSetFileStat,
} from "../hooks/use-fetch-data-set-file-stats";
import { useFetchJobResults } from "../hooks/use-fetch-job-results";
import { useFetchNormalizedDatasets } from "../../dataset/hooks/use-fetch-normalized-datasets";
import { toJobStatusSection } from "../util/job-status-rows";
import { fetchOdsColumns } from "../util/ods-columns";
import {
  buildingTypeValuesText,
  dataSourceExtras,
  dataSourceValueText,
  formatVolume,
} from "../util/data-source-rows";
import { lang } from "../../../shared/config/lang";
import { LanguageMap } from "../../../shared/config/metadata";
import { normalizationPurposeLabel } from "../../../shared/config/normalization-purpose-label";
import { toOdsDisplayName } from "../../../shared/types/optional-data-source";
import {
  TYPE_DISPLAY_MAP,
  type JobType,
} from "../../../shared/config/job-type-display-map";
import { ROUTES } from "../../../shared/config/routes";
import {
  buildVerificationText,
  type VerificationSection,
} from "../util/verification-text";

export type { VerificationSection };

const useStyles = makeStyles({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  headingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heading: {
    color: tokens.colorNeutralForeground3,
  },
  downloadButton: {
    minWidth: "auto",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "160px 1fr",
    gap: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    alignItems: "baseline",
  },
  label: {
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase100,
  },
  value: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
    wordBreak: "break-all",
  },
  volume: {
    display: "block",
    color: tokens.colorNeutralForeground3,
  },
  sectionTitle: {
    gridColumn: "1 / -1",
    marginTop: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalS,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    color: tokens.colorNeutralForeground2,
    fontWeight: tokens.fontWeightSemibold,
  },
  valueRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  toggleButton: {
    minWidth: "auto",
    height: "auto",
    padding: `0 ${tokens.spacingHorizontalXS}`,
    fontSize: tokens.fontSizeBase100,
  },
  columnMappingValue: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
  },
  indent1: {
    paddingLeft: tokens.spacingHorizontalM,
    fontWeight: tokens.fontWeightRegular,
  },
  indent2: {
    paddingLeft: tokens.spacingHorizontalXXL,
    fontWeight: tokens.fontWeightRegular,
  },
  link: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorBrandForeground1,
    textDecorationLine: "none",
    ":hover": {
      textDecorationLine: "underline",
    },
  },
});

// lang.ts へのショートカット
const l = lang.components["job-parameters-section"];

// 秒数を「X分YY秒（Z.Z秒）」形式に変換する（NR007 処理速度の確認用）
const formatDuration = (sec: string | undefined): string | undefined => {
  if (!sec) return undefined;
  const total = Number.parseFloat(sec);
  if (Number.isNaN(total)) return undefined;
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}分${String(seconds).padStart(2, "0")}秒（${total.toFixed(1)}秒）`;
};

/** 処理時間（NR007）。実測秒数 */
export type ModelDurations = {
  /** 処理全体（実時間）: ジョブ作成→完了。プロセス起動・import含む */
  totalRealSec?: string;
  /** プロセス内処理（E021 train_and_evaluate）。起動・import除く。モデル構築のみ */
  durationTotalSec?: string;
  /** モデル学習（PU Bagging）の純計算。モデル構築のみ */
  durationTrainingSec?: string;
  /** 段階別内訳（名寄せ・推定）。各段階の所要秒数。key は lang.ts の stageLabels で解決 */
  stages?: { key: string; durationSec: string }[];
};

/** 段階キーを表示ラベルに解決する。未定義キーはそのまま表示 */
const stageLabel = (key: string): string => l.stageLabels[key] ?? key;

// データソースキーから日本語表示名への変換
const DATA_SOURCE_LABELS: Record<string, string> = {
  water_status: lang.components.normalizationData.waterStatus.label,
  water_usage: lang.components.normalizationData.waterUsage.label,
  resident_registry: lang.components.normalizationData.residentRegistry.label,
  geocoding: lang.components.normalizationData.geocoding.label,
  building_registry: lang.components.normalizationData.buildingRegistry.label,
  building_polygon: lang.components.normalizationData.buildingPolygon.label,
  building_type_determination:
    lang.components.normalizationData.buildingTypeDetermination.label,
  vacant_house: lang.components.normalizationData.vacantHouse.label,
  optional_data_source:
    lang.components.normalizationData.optionalDataSource.label,
};

type Props = {
  job: SelectJob;
  /** 処理時間を実行情報カードに統合表示する（NR007） */
  durations?: ModelDurations;
  /** 画面側が持つ追加の検証情報（結合率・件数・内訳など）。DL一式に含める */
  extraSections?: VerificationSection[];
  /**
   * DLクリック時に取得する検証情報（確率帯など）。
   * ページ表示時に走らせたくない重い集計や、実行中に開いた場合に古くなる値をここへ置く。
   */
  deferredSections?: () => Promise<VerificationSection[]>;
};

/**
 * 開発者連携用の検証情報ファイル名を組み立てる。
 * 処理種別・実行日時（秒精度）を含め、受領側がどの処理の証跡か一見で判別できるようにする。
 * 内部連番IDでなく実行日時を一意キーに使う（いつの処理かが意味として伝わり、再実行でも重複しない）。
 * 例: 検証情報_モデル構築_20260625-040843.txt
 */
const buildVerificationFileName = (job: SelectJob): string => {
  const typeLabel = job.type
    ? (TYPE_DISPLAY_MAP[job.type as JobType] ?? l.heading)
    : l.heading;
  // "2026-06-25 04:08:43" → "20260625-040843"
  const timestamp = job.created_at
    .slice(0, 19)
    .replace(/[-:]/g, "")
    .replace(" ", "-");
  const parts = [l.downloadFilePrefix, typeLabel, timestamp].filter(Boolean);
  return `${parts.join("_")}.txt`;
};

/**
 * 実行情報カードの見出し（右上に検証情報ダウンロードボタン）。
 *
 * セクションはクリック時に組み立てる。表示に使わない重い集計をページ表示時に
 * 走らせず、実行中に開いた場合も押した時点の内容を書き出すため。
 */
const CardHeading = ({
  buildSections,
  fileName,
  jobId,
}: {
  buildSections: () => Promise<VerificationSection[]>;
  fileName: string;
  jobId?: number;
}): JSX.Element => {
  const styles = useStyles();
  const handleDownload = async (): Promise<void> => {
    let logText: string | undefined;
    if (jobId !== undefined) {
      try {
        logText = await window.ipcRenderer.invoke("selectJobLog", { jobId });
      } catch (error) {
        rendererLogger.error("Failed to fetch job log", { error });
      }
    }
    let sections: VerificationSection[];
    try {
      sections = await buildSections();
    } catch (error) {
      rendererLogger.error("Failed to build verification sections", { error });
      return;
    }
    downloadText(fileName, buildVerificationText(l.heading, sections, logText));
  };
  return (
    <div className={styles.headingRow}>
      <Caption1Strong className={styles.heading}>{l.heading}</Caption1Strong>
      <Button
        appearance="subtle"
        aria-label={l.downloadVerification}
        className={styles.downloadButton}
        icon={<ArrowDownload16Regular />}
        onClick={() => void handleDownload()}
        size="small"
      />
    </div>
  );
};

/**
 * ジョブのパラメータを「実行情報」セクションとして表示する共通コンポーネント
 * parameterType により分岐し、各ジョブ種別に応じた表示を行う
 */
export const JobParametersSection = ({
  job,
  durations,
  extraSections,
  deferredSections,
}: Props): JSX.Element | null => {
  const params = job.parameters;
  if (!params || params.parameterType === "unknown") return null;

  const fileName = buildVerificationFileName(job);
  const jobId = job.id;

  switch (params.parameterType) {
    case "preprocess":
      return (
        <PreprocessParametersView
          durations={durations}
          extraSections={extraSections}
          fileName={fileName}
          job={job}
          jobId={jobId}
          params={params}
        />
      );
    case "ml":
      return (
        <MlParametersView
          durations={durations}
          extraSections={extraSections}
          fileName={fileName}
          job={job}
          jobId={jobId}
          params={params}
        />
      );
    case "result":
      return (
        <ResultParametersView
          deferredSections={deferredSections}
          durations={durations}
          extraSections={extraSections}
          fileName={fileName}
          job={job}
          jobId={jobId}
          params={params}
        />
      );
    case "export":
      return <ExportParametersView params={params} />;
    default:
      return null;
  }
};

/** 起動・準備 = 実時間 − プロセス内処理（spawn・import 等）。算出不能時は undefined */
const formatSetupDuration = (
  durations?: ModelDurations,
): string | undefined => {
  const total = Number.parseFloat(durations?.totalRealSec ?? "");
  const process = Number.parseFloat(durations?.durationTotalSec ?? "");
  if (Number.isNaN(total) || Number.isNaN(process)) return undefined;
  return formatDuration(String(Math.max(0, total - process)));
};

/**
 * durations から処理時間セクションの行を組み立てる（DL用）。
 * 画面の内訳（ProcessingTimeRows）と同一構造で出力する: 実時間 ⊃ 起動・準備 + プロセス内処理 ⊃ 内訳。
 */
const durationRows = (durations?: ModelDurations): [string, string][] => {
  const rows: [string, string][] = [];
  const real = formatDuration(durations?.totalRealSec);
  if (real) rows.push([l.durationTotalReal, real]);
  const setup = formatSetupDuration(durations);
  if (setup) rows.push([`  ${l.durationSetup}`, setup]);
  const process = formatDuration(durations?.durationTotalSec);
  if (durations?.stages?.length) {
    // 名寄せ・推定: プロセス内処理 ⊃ 段階別
    if (process) rows.push([`  ${l.durationProcessAll}`, process]);
    for (const stage of durations.stages) {
      const d = formatDuration(stage.durationSec);
      if (d) rows.push([`    ${stageLabel(stage.key)}`, d]);
    }
  } else {
    // モデル構築: プロセス内処理 ⊃ 学習
    const training = formatDuration(durations?.durationTrainingSec);
    if (process) rows.push([`  ${l.durationProcess}`, process]);
    if (training) rows.push([`    ${l.durationTrainingNested}`, training]);
  }
  return rows;
};

/**
 * 処理時間サブセクション（NR007 処理速度の確認用）。
 *
 * 加算でなく入れ子（処理全体 ⊃ プロセス内処理 ⊃ モデル学習 or 段階別）。
 * 既定は「処理全体（実時間）」のみ表示し、内訳は段階開示で展開する（認知負荷最小化）。
 * 内訳の最下層はモデル構築=学習、名寄せ・推定=各段階。
 */
const ProcessingTimeRows = ({
  durations,
}: {
  durations?: ModelDurations;
}): JSX.Element | null => {
  const styles = useStyles();
  const [open, setOpen] = useState(false);

  const realDuration = formatDuration(durations?.totalRealSec);
  const processDuration = formatDuration(durations?.durationTotalSec);
  const trainingDuration = formatDuration(durations?.durationTrainingSec);
  const stages = durations?.stages ?? [];
  const hasStages = stages.length > 0;
  const setupDuration = formatSetupDuration(durations);

  if (!realDuration && !processDuration && !trainingDuration && !hasStages)
    return null;

  const hasBreakdown =
    hasStages || !!(setupDuration || processDuration || trainingDuration);

  return (
    <>
      <Caption2 className={styles.sectionTitle}>{l.processingTime}</Caption2>

      {/* 処理全体（実時間）— 内訳トグル付き */}
      <span className={styles.label}>{l.durationTotalReal}</span>
      <span className={styles.valueRow}>
        <span className={styles.value}>{realDuration ?? "--"}</span>
        {hasBreakdown && (
          <Button
            appearance="transparent"
            aria-expanded={open}
            className={styles.toggleButton}
            icon={open ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
            iconPosition="after"
            onClick={() => setOpen((v) => !v)}
            size="small"
          >
            {l.durationBreakdownToggle}
          </Button>
        )}
      </span>

      {/* 内訳（起動・準備 + プロセス内処理 ⊃ 段階別[名寄せ・推定] or 学習[モデル構築]） */}
      {hasBreakdown && open && (
        <>
          <span className={mergeClasses(styles.label, styles.indent1)}>
            {l.durationSetup}
          </span>
          <span className={styles.value}>{setupDuration ?? "--"}</span>
          {hasStages ? (
            <>
              {/* プロセス内処理（全段階） ⊃ 各段階。起動・準備 + プロセス内処理 = 実時間 */}
              <span className={mergeClasses(styles.label, styles.indent1)}>
                {l.durationProcessAll}
              </span>
              <span className={styles.value}>{processDuration ?? "--"}</span>
              {stages.map((stage) => (
                <Fragment key={stage.key}>
                  <span className={mergeClasses(styles.label, styles.indent2)}>
                    {stageLabel(stage.key)}
                  </span>
                  <span className={styles.value}>
                    {formatDuration(stage.durationSec) ?? "--"}
                  </span>
                </Fragment>
              ))}
            </>
          ) : (
            <>
              <span className={mergeClasses(styles.label, styles.indent1)}>
                {l.durationProcess}
              </span>
              <span className={styles.value}>{processDuration ?? "--"}</span>
              {trainingDuration && (
                <>
                  <span className={mergeClasses(styles.label, styles.indent2)}>
                    {l.durationTrainingNested}
                  </span>
                  <span className={styles.value}>{trainingDuration}</span>
                </>
              )}
            </>
          )}
        </>
      )}
    </>
  );
};

/** カラム対応のデータソース別グループ（システム項目ラベル → 入力カラム名） */
type ColumnMappingGroup = { source: string; rows: [string, string][] };

/** カラム対応を持つデータソース（建物ポリゴンはバイナリのため対象外） */
const COLUMN_MAPPED_SOURCES = [
  "water_status",
  "water_usage",
  "resident_registry",
  "geocoding",
  "building_registry",
  "building_type_determination",
  "vacant_house",
  "optional_data_source",
] as const;

const PARAMETER_LABELS: Record<string, string> =
  LanguageMap.NORMALIZATION_PARAMETER_LABEL;

/** params.data から各データの「システム項目 → 入力カラム名」対応を組み立てる（NR007 カラム対応） */
const collectColumnMappings = (
  params: PreprocessParameters,
): ColumnMappingGroup[] => {
  const groups: ColumnMappingGroup[] = [];
  const data = params.data;
  for (const key of COLUMN_MAPPED_SOURCES) {
    const entry = data[key];
    if (!entry || entry.id === 0 || !("columns" in entry) || !entry.columns) {
      continue;
    }
    const rows: [string, string][] = [];
    for (const [fieldKey, columnName] of Object.entries(entry.columns)) {
      if (!columnName) continue;
      rows.push([PARAMETER_LABELS[fieldKey] ?? fieldKey, String(columnName)]);
    }
    if (rows.length) {
      groups.push({ source: DATA_SOURCE_LABELS[key] ?? key, rows });
    }
  }
  return groups;
};

/**
 * カラム対応サブセクション（NR007）。
 * 各入力データの「システム項目 → 入力カラム名」対応を表示する。
 * 利用データ・処理時間と同じセクション見出し + 2カラム行に揃え、
 * 1データソース = 1行に集約して縦の情報量を抑える。
 */
const ColumnMappingRows = ({
  groups,
}: {
  groups: ColumnMappingGroup[];
}): JSX.Element | null => {
  const styles = useStyles();

  if (!groups.length) return null;

  return (
    <>
      <Caption2 className={styles.sectionTitle}>{l.columnMapping}</Caption2>
      {groups.map((group) => (
        <Fragment key={group.source}>
          <span className={styles.label}>{group.source}</span>
          <span className={styles.columnMappingValue}>
            {group.rows
              .map(([label, columnName]) => `${label}: ${columnName}`)
              .join(" / ")}
          </span>
        </Fragment>
      ))}
    </>
  );
};

/** キーバリュー行 */
const Row = ({
  label,
  value,
}: {
  label: string;
  value: string | JSX.Element | null | undefined;
}): JSX.Element | null => {
  const styles = useStyles();
  if (!value) return null;
  return (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </>
  );
};

/**
 * データソース行に属する設定の行（1段下げ）。
 * 家屋種別は処理対象選定用データの中の指定なので、他のデータと同列に置くと親子が消える。
 */
const SubRow = ({
  label,
  value,
}: {
  label: string;
  value: string;
}): JSX.Element => {
  const styles = useStyles();
  return (
    <>
      <span className={mergeClasses(styles.label, styles.indent1)}>
        {label}
      </span>
      <span className={styles.value}>{value}</span>
    </>
  );
};

/** ファイル名解決のためのraw_data_setsパスを収集 */
function collectRawPaths(params: PreprocessParameters): string[] {
  const paths: string[] = [];
  const data = params.data;
  const dataKeys = [
    "water_status",
    "water_usage",
    "resident_registry",
    "geocoding",
    "building_registry",
    "building_polygon",
    "building_type_determination",
    "vacant_house",
    "optional_data_source",
  ] as const;
  for (const key of dataKeys) {
    const entry = data[key];
    if (entry && entry.id !== 0 && entry.path) {
      paths.push(entry.path);
    }
  }
  return paths;
}

// ── 名寄せ処理パラメータ ──

/** 必須データ。画面・ファイルとも同じ並びで出す */
const REQUIRED_DATA_SOURCES = [
  "water_status",
  "water_usage",
  "resident_registry",
] as const;

/** 任意データ。画面・ファイルとも同じ並びで出す */
const OPTIONAL_DATA_SOURCES = [
  "geocoding",
  "building_registry",
  "building_polygon",
  "building_type_determination",
  "vacant_house",
  "optional_data_source",
] as const;

const WIZARD_SECTIONS = lang.components.normalizationParameters.wizardIntro;

const PreprocessParametersView = ({
  params,
  job,
  durations,
  extraSections,
  fileName,
  jobId,
}: {
  params: PreprocessParameters;
  job: SelectJob;
  durations?: ModelDurations;
  extraSections?: VerificationSection[];
  fileName: string;
  jobId?: number;
}): JSX.Element => {
  const styles = useStyles();
  const rawPaths = collectRawPaths(params);
  const { data: resolved } = useResolveJobFileNames({ rawPaths });
  const fileStats = useFetchDataSetFileStats(rawPaths);

  const data = params.data;
  const buildingTypeEntry = data.building_type_determination;
  const hasOptionalDataSource = !!data.optional_data_source?.id;

  const { data: jobResult } = useFetchJobResults({ jobId: job.id });

  const { data: normalizedDatasets } = useFetchNormalizedDatasets();
  const savedDatasetName = job.is_named
    ? normalizedDatasets?.find((ds) => ds.job_results_id === jobResult?.id)
        ?.file_name
    : undefined;

  const getFileName = (path: string): string => {
    if (!resolved) return path;
    return resolved.rawNames[path] ?? path;
  };

  /**
   * 利用データ一覧の行（DL用）。データソース行に続けて、その中の設定を1段下げて置く。
   * 家屋種別・追加カラムは特定のデータに属する情報なので、他のデータと同列に並べると
   * どのデータの話か読めなくなる。
   */
  const buildDataRows = (
    keys: readonly (keyof PreprocessParameters["data"])[],
    odsColumns: string[],
  ): [string, string][] => {
    const rows: [string, string][] = [];
    for (const key of keys) {
      const entry = data[key];
      if (!entry || entry.id === 0) continue;
      rows.push([
        DATA_SOURCE_LABELS[key] ?? key,
        dataSourceValueText(
          getFileName(entry.path),
          entry,
          fileStats?.[entry.path],
        ),
      ]);
      if (key === "building_type_determination") {
        rows.push([
          `  ${lang.components.normalizationParameters.building_type_values.label}`,
          buildingTypeValuesText(buildingTypeEntry?.residential_values),
        ]);
      }
      if (key === "optional_data_source" && odsColumns.length) {
        rows.push([
          `  ${l.odsColumnsSection(odsColumns.length)}`,
          odsColumns.join(" / "),
        ]);
      }
    }
    return rows;
  };

  // 実行設定（目的・推定基準日）。いつ時点の何のための名寄せかを決める値
  const settingsRows: [string, string][] = [
    [
      lang.components.normalizationPurpose.fieldLabel,
      normalizationPurposeLabel(params.settings?.purpose),
    ],
  ];
  if (params.settings?.reference_date) {
    settingsRows.push([
      LanguageMap.NORMALIZATION_PARAMETER_LABEL["reference_date"],
      params.settings.reference_date,
    ]);
  }
  // 名前をつけて保存した結果。画面上部の「「◯◯」として保存済み」に対応する
  if (savedDatasetName) {
    settingsRows.push([l.savedDataset, savedDatasetName]);
  }

  const columnGroups = collectColumnMappings(params);

  // 追加カラムはクリック時に読む。画面には出さないので、ジョブ詳細を開くたびに
  // 名寄せ結果ファイルを読みにいく必要がない
  const buildSections = async (): Promise<VerificationSection[]> => {
    const odsColumns =
      hasOptionalDataSource && jobResult?.file_path
        ? await fetchOdsColumns(jobResult.file_path)
        : [];
    return [
      toJobStatusSection(job),
      { rows: settingsRows },
      {
        title: WIZARD_SECTIONS.requiredSection,
        rows: buildDataRows(REQUIRED_DATA_SOURCES, odsColumns),
      },
      {
        title: WIZARD_SECTIONS.optionalSection,
        rows: buildDataRows(OPTIONAL_DATA_SOURCES, odsColumns),
      },
      ...columnGroups.map((group) => ({
        title: `${l.columnMapping}（${group.source}）`,
        rows: group.rows,
      })),
      ...(extraSections ?? []),
      { title: l.processingTime, rows: durationRows(durations) },
    ];
  };

  return (
    <div className={styles.section}>
      <CardHeading
        buildSections={buildSections}
        fileName={fileName}
        jobId={jobId}
      />
      <div className={styles.grid}>
        <Row
          label={lang.components.normalizationPurpose.fieldLabel}
          value={normalizationPurposeLabel(params.settings?.purpose)}
        />
        <Row
          label={LanguageMap.NORMALIZATION_PARAMETER_LABEL["reference_date"]}
          value={params.settings?.reference_date}
        />

        {/* 必須データ */}
        <Caption2 className={styles.sectionTitle}>
          {WIZARD_SECTIONS.requiredSection}
        </Caption2>
        {REQUIRED_DATA_SOURCES.map((key) => {
          const entry = data[key];
          if (!entry || entry.id === 0) return null;
          return (
            <DataSourceRow
              key={key}
              dataKey={key}
              entry={entry}
              getFileName={getFileName}
              stat={fileStats?.[entry.path]}
            />
          );
        })}

        {/* 任意データ。データに属する設定（家屋種別・追加カラム）はその下に1段下げる */}
        {OPTIONAL_DATA_SOURCES.some(
          (key) => data[key] && data[key].id !== 0,
        ) && (
          <>
            <Caption2 className={styles.sectionTitle}>
              {WIZARD_SECTIONS.optionalSection}
            </Caption2>
            {OPTIONAL_DATA_SOURCES.map((key) => {
              const entry = data[key];
              if (!entry || entry.id === 0) return null;
              return (
                <Fragment key={key}>
                  <DataSourceRow
                    dataKey={key}
                    entry={entry}
                    getFileName={getFileName}
                    stat={fileStats?.[entry.path]}
                  />
                  {key === "building_type_determination" && (
                    <SubRow
                      label={
                        lang.components.normalizationParameters
                          .building_type_values.label
                      }
                      value={buildingTypeValuesText(
                        buildingTypeEntry?.residential_values,
                      )}
                    />
                  )}
                </Fragment>
              );
            })}
          </>
        )}

        <ColumnMappingRows groups={columnGroups} />
        <ProcessingTimeRows durations={durations} />
      </div>
    </div>
  );
};

/** 個別データソース行の表示（利用データ一覧 ① + データ量 ②） */
const DataSourceRow = ({
  dataKey,
  entry,
  getFileName,
  stat,
}: {
  dataKey: string;
  entry: {
    id: number;
    path: string;
    input_file_type?: string;
    data_type?: string;
  };
  getFileName: (path: string) => string;
  stat?: DataSetFileStat;
}): JSX.Element => {
  const styles = useStyles();
  const label = DATA_SOURCE_LABELS[dataKey] ?? dataKey;
  const fileName = getFileName(entry.path);

  // 追加情報（ファイル形式・データ種別）。DL側と同じ関数で組み立てる
  const extras = dataSourceExtras(entry);

  const volume = formatVolume(stat);

  return (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {fileName}
        {extras.length > 0 && ` (${extras.join(", ")})`}
        {volume && <span className={styles.volume}>{volume}</span>}
      </span>
    </>
  );
};

// ── モデル構築パラメータ ──

const MlParametersView = ({
  params,
  job,
  durations,
  extraSections,
  fileName,
  jobId,
}: {
  params: ModelCreateParameters;
  job: SelectJob;
  durations?: ModelDurations;
  extraSections?: VerificationSection[];
  fileName: string;
  jobId?: number;
}): JSX.Element => {
  const styles = useStyles();
  const { data: resolved } = useResolveJobFileNames({
    normalizedPaths: params.input_path ? [params.input_path] : [],
  });

  const datasetName = params.input_path
    ? (resolved?.normalizedNames[params.input_path] ?? params.input_path)
    : undefined;

  const settingsRows: [string, string][] = [];
  if (datasetName) settingsRows.push([l.normalizedDataset, datasetName]);
  // 内部カラム名のまま出さない（建物関連データ由来は「[追加] カラム名」になる）
  const vars = params.settings?.explanatory_variables
    ?.map(toOdsDisplayName)
    .join("、");
  if (vars) settingsRows.push([l.explanatoryVariables, vars]);

  const sections: VerificationSection[] = [
    toJobStatusSection(job),
    { rows: settingsRows },
    ...(extraSections ?? []),
    { title: l.processingTime, rows: durationRows(durations) },
  ];

  return (
    <div className={styles.section}>
      <CardHeading
        buildSections={async () => sections}
        fileName={fileName}
        jobId={jobId}
      />
      <div className={styles.grid}>
        <Row label={l.normalizedDataset} value={datasetName} />
        <Row label={l.explanatoryVariables} value={vars} />
        <ProcessingTimeRows durations={durations} />
      </div>
    </div>
  );
};

// ── 空き家推定パラメータ ──

const ResultParametersView = ({
  params,
  job,
  durations,
  extraSections,
  deferredSections,
  fileName,
  jobId,
}: {
  params: ResultParameters;
  job: SelectJob;
  durations?: ModelDurations;
  extraSections?: VerificationSection[];
  deferredSections?: () => Promise<VerificationSection[]>;
  fileName: string;
  jobId?: number;
}): JSX.Element => {
  const styles = useStyles();
  const { data: resolved } = useResolveJobFileNames({
    modelPath: params.model_path,
    normalizedPaths: params.normalized_dataset_paths,
    rawPaths: params.area_grouping?.path ? [params.area_grouping.path] : [],
  });

  const modelName = resolved?.modelName ?? params.model_path;
  const areaGroupingName = params.area_grouping?.path
    ? (resolved?.rawNames[params.area_grouping.path] ??
      params.area_grouping.path)
    : null;

  const settingsRows: [string, string][] = [];
  if (params.settings?.threshold != null) {
    settingsRows.push([l.threshold, String(params.settings.threshold)]);
  }
  if (modelName) settingsRows.push([l.modelFile, modelName]);

  // 検証情報DL（NR007）。画面に描画している入力データを同じ並びで書き出す。
  // 地域集計をしていないジョブでは画面から3行とも消えるため、DL側も同じく空になる。
  const usedDataRows: [string, string][] = params.normalized_dataset_paths.map(
    (path): [string, string] => [
      l.normalizedDataset,
      resolved?.normalizedNames[path] ?? path,
    ],
  );
  if (areaGroupingName) {
    usedDataRows.push([l.areaGroupingData, areaGroupingName]);
    const columns = params.area_grouping?.columns;
    if (columns?.area_group_id) {
      usedDataRows.push([
        lang.pages["evaluation/create"].column1.label,
        columns.area_group_id,
      ]);
    }
    if (columns?.area_group_name) {
      usedDataRows.push([
        lang.pages["evaluation/create"].column2.label,
        columns.area_group_name,
      ]);
    }
  }

  // 処理時間の手前に遅延セクションを差し込む。画面の並び（設定→入力データ→
  // 結果→処理時間）を保ったまま、クリック時に取る集計を結果の隣に置くため。
  const buildSections = async (): Promise<VerificationSection[]> => [
    toJobStatusSection(job),
    { rows: settingsRows },
    { title: l.usedDataSection, rows: usedDataRows },
    ...(extraSections ?? []),
    ...(deferredSections ? await deferredSections() : []),
    { title: l.processingTime, rows: durationRows(durations) },
  ];

  return (
    <div className={styles.section}>
      <CardHeading
        buildSections={buildSections}
        fileName={fileName}
        jobId={jobId}
      />
      <div className={styles.grid}>
        <Row
          label={l.threshold}
          value={String(params.settings?.threshold ?? "")}
        />
        <Row label={l.modelFile} value={modelName} />
        <Row
          label={l.normalizedDataset}
          value={
            params.normalized_dataset_paths.length > 0 ? (
              <div>
                {params.normalized_dataset_paths.map((path) => (
                  <div key={path} className={styles.value}>
                    {resolved?.normalizedNames[path] ?? path}
                  </div>
                ))}
              </div>
            ) : null
          }
        />
        {areaGroupingName && (
          <>
            <Row label={l.areaGroupingData} value={areaGroupingName} />
            <Row
              label={lang.pages["evaluation/create"].column1.label}
              value={params.area_grouping?.columns?.area_group_id}
            />
            <Row
              label={lang.pages["evaluation/create"].column2.label}
              value={params.area_grouping?.columns?.area_group_name}
            />
          </>
        )}
        <ProcessingTimeRows durations={durations} />
      </div>
    </div>
  );
};

// ── ダウンロード準備パラメータ ──

const TARGET_UNIT_LABELS: Record<string, string> = {
  building: l.targetUnitBuilding,
  area: l.targetUnitArea,
};

const ExportParametersView = ({
  params,
}: {
  params: ExportParameters;
}): JSX.Element => {
  const styles = useStyles();
  const { data: resolved } = useResolveJobFileNames({
    dataSetResultId: params.data_set_results_id ?? undefined,
    viewId: params.view_id ?? undefined,
  });

  const dataSetResultTitle = params.data_set_results_id
    ? (resolved?.dataSetResultTitle ?? null)
    : null;

  // ビュー表示: タイトル未設定なら「(タイトル未設定)」、削除済みなら「(削除済み)」
  const renderViewValue = (): JSX.Element | undefined => {
    if (!params.view_id) return undefined;
    const viewRoute = resolved?.viewRoute;
    const displayTitle = resolved?.viewTitle || l.viewTitleEmpty;

    // ビューが削除済み（resolvedはあるがviewRouteがない）
    if (resolved && !viewRoute) {
      return <span className={styles.value}>{l.deleted}</span>;
    }

    // リンク可能な場合
    if (viewRoute) {
      return (
        <Link
          className={styles.link}
          to={ROUTES.ANALYSIS.WORKBOOK_EDIT({
            id: viewRoute.workbookId,
            queryParams: {
              sheetId: viewRoute.sheetId,
              viewId: viewRoute.viewId,
            },
          })}
        >
          {displayTitle}
        </Link>
      );
    }

    // まだ解決中（resolved未取得）— Rowを非表示にして誤表示を防ぐ
    return undefined;
  };

  return (
    <div className={styles.section}>
      <Caption1Strong className={styles.heading}>{l.heading}</Caption1Strong>
      <div className={styles.grid}>
        <Row
          label={l.fileType}
          value={params.output_file_type?.toUpperCase()}
        />
        <Row label={l.coordinateSystem} value={params.output_coordinate} />
        <Row
          label={l.targetUnit}
          value={
            params.target_unit
              ? (TARGET_UNIT_LABELS[params.target_unit] ?? params.target_unit)
              : undefined
          }
        />
        <Row label={l.referenceView} value={renderViewValue()} />
        <Row
          label={LanguageMap.NORMALIZATION_PARAMETER_LABEL["reference_date"]}
          value={params.reference_date}
        />
        <Row
          label={l.targetDataset}
          value={
            params.data_set_results_id
              ? (dataSetResultTitle ?? l.deleted)
              : undefined
          }
        />
      </div>
    </div>
  );
};
