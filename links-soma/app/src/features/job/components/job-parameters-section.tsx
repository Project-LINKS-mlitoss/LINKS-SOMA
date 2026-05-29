import {
  makeStyles,
  tokens,
  Caption1Strong,
  Caption2,
} from "@fluentui/react-components";
import { Link } from "react-router-dom";
import { type SelectJob } from "../../../db/schema";
import {
  type PreprocessParameters,
  type ModelCreateParameters,
  type ResultParameters,
  type ExportParameters,
} from "../../../shared/types/job-parameters";
import { useResolveJobFileNames } from "../hooks/use-resolve-job-file-names";
import { lang } from "../../../shared/config/lang";
import { ROUTES } from "../../../shared/config/routes";
import { translateColumnToJapanese } from "../../../shared/column-translation-utils";

const useStyles = makeStyles({
  section: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalL,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  heading: {
    color: tokens.colorNeutralForeground3,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "160px 1fr",
    gap: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalM}`,
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
  sectionTitle: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
    gridColumn: "1 / -1",
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

// データソースキーから日本語表示名への変換
const DATA_SOURCE_LABELS: Record<string, string> = {
  water_status: lang.components.normalizationData.waterStatus.label,
  water_usage: lang.components.normalizationData.waterUsage.label,
  resident_registry: lang.components.normalizationData.residentRegistry.label,
  census: lang.components.normalizationData.census.label,
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
};

/**
 * ジョブのパラメータを「実行設定」セクションとして表示する共通コンポーネント
 * parameterType により分岐し、各ジョブ種別に応じた表示を行う
 */
export const JobParametersSection = ({ job }: Props): JSX.Element | null => {
  const params = job.parameters;
  if (!params || params.parameterType === "unknown") return null;

  switch (params.parameterType) {
    case "preprocess":
      return <PreprocessParametersView params={params} />;
    case "ml":
      return <MlParametersView params={params} />;
    case "result":
      return <ResultParametersView params={params} />;
    case "export":
      return <ExportParametersView params={params} />;
    default:
      return null;
  }
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

/** ファイル名解決のためのraw_data_setsパスを収集 */
function collectRawPaths(params: PreprocessParameters): string[] {
  const paths: string[] = [];
  const data = params.data;
  const dataKeys = [
    "water_status",
    "water_usage",
    "resident_registry",
    "census",
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

/** データ種別の表示値 */
const DATA_TYPE_LABELS: Record<string, string> = {
  plateau: l.dataTypePlateau,
  others: l.dataTypeOthers,
};

const FILE_TYPE_LABELS: Record<string, string> = {
  csv: "CSV",
  geopackage: "GeoPackage",
  shapefile: "Shapefile",
};

// ── 名寄せ処理パラメータ ──

const PreprocessParametersView = ({
  params,
}: {
  params: PreprocessParameters;
}): JSX.Element => {
  const styles = useStyles();
  const rawPaths = collectRawPaths(params);
  const { data: resolved } = useResolveJobFileNames({ rawPaths });

  const getFileName = (path: string): string => {
    if (!resolved) return path;
    return resolved.rawNames[path] ?? path;
  };

  const data = params.data;

  // 必須データ
  const requiredDataSources = [
    "water_status",
    "water_usage",
    "resident_registry",
    "census",
  ] as const;

  // 任意データ
  const optionalDataSources = [
    "geocoding",
    "building_registry",
    "building_polygon",
    "building_type_determination",
    "vacant_house",
    "optional_data_source",
  ] as const;

  return (
    <div className={styles.section}>
      <Caption1Strong className={styles.heading}>{l.heading}</Caption1Strong>
      <div className={styles.grid}>
        <Row
          label={`推定したい日付（${translateColumnToJapanese("reference_date", "building")}）`}
          value={params.settings?.reference_date}
        />

        {/* 必須データ */}
        <Caption2 className={styles.sectionTitle}>
          {lang.components.normalizationParameters.wizardIntro.requiredSection}
        </Caption2>
        {requiredDataSources.map((key) => {
          const entry = data[key];
          if (!entry || entry.id === 0) return null;
          return (
            <DataSourceRow
              key={key}
              dataKey={key}
              entry={entry}
              getFileName={getFileName}
            />
          );
        })}

        {/* 任意データ */}
        {optionalDataSources.some((key) => data[key] && data[key].id !== 0) && (
          <>
            <Caption2 className={styles.sectionTitle}>
              {
                lang.components.normalizationParameters.wizardIntro
                  .optionalSection
              }
            </Caption2>
            {optionalDataSources.map((key) => {
              const entry = data[key];
              if (!entry || entry.id === 0) return null;
              return (
                <DataSourceRow
                  key={key}
                  dataKey={key}
                  entry={entry}
                  getFileName={getFileName}
                />
              );
            })}
          </>
        )}

      </div>
    </div>
  );
};

/** 個別データソース行の表示 */
const DataSourceRow = ({
  dataKey,
  entry,
  getFileName,
}: {
  dataKey: string;
  entry: {
    id: number;
    path: string;
    input_file_type?: string;
    data_type?: string;
  };
  getFileName: (path: string) => string;
}): JSX.Element => {
  const styles = useStyles();
  const label = DATA_SOURCE_LABELS[dataKey] ?? dataKey;
  const fileName = getFileName(entry.path);

  // 追加情報（ファイル形式・データ種別）
  const extras: string[] = [];
  if ("data_type" in entry && entry.data_type) {
    extras.push(DATA_TYPE_LABELS[entry.data_type] ?? entry.data_type);
  }
  if ("input_file_type" in entry && entry.input_file_type) {
    extras.push(
      FILE_TYPE_LABELS[entry.input_file_type] ?? entry.input_file_type,
    );
  }

  return (
    <>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {fileName}
        {extras.length > 0 && ` (${extras.join(", ")})`}
      </span>
    </>
  );
};

// ── モデル構築パラメータ ──

const MlParametersView = ({
  params,
}: {
  params: ModelCreateParameters;
}): JSX.Element => {
  const styles = useStyles();
  const { data: resolved } = useResolveJobFileNames({
    normalizedPaths: params.input_path ? [params.input_path] : [],
  });

  const datasetName = params.input_path
    ? (resolved?.normalizedNames[params.input_path] ?? params.input_path)
    : undefined;

  return (
    <div className={styles.section}>
      <Caption1Strong className={styles.heading}>{l.heading}</Caption1Strong>
      <div className={styles.grid}>
        <Row label={l.normalizedDataset} value={datasetName} />
        <Row
          label={l.explanatoryVariables}
          value={params.settings?.explanatory_variables?.join("、")}
        />
      </div>
    </div>
  );
};

// ── 空き家推定パラメータ ──

const ResultParametersView = ({
  params,
}: {
  params: ResultParameters;
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

  return (
    <div className={styles.section}>
      <Caption1Strong className={styles.heading}>{l.heading}</Caption1Strong>
      <div className={styles.grid}>
        <Row
          label={lang.components["dialog-model-advanced"].threshold.label}
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
          label={`推定したい日付（${translateColumnToJapanese("reference_date", "building")}）`}
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
