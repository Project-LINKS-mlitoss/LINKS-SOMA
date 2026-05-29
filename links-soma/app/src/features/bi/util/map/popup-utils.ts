import { translateColumnToJapanese } from "../../../../shared/column-translation-utils";
import { formatDate } from "../../../../shared/utils/format-date";
import {
  type OptionalDataSourceEntry,
  ODS_SUFFIX,
  toOdsDisplayName,
} from "../../../../shared/types/optional-data-source";
import {
  EXCLUDED_COLUMN_PATTERNS,
  CURRENTLY_DISPLAYED_COLUMNS,
} from "../../components/views/map/map-container/const";

// 除外カラムかどうかを判定する関数（修正しやすいように分離）
const isExcludedColumn = (columnName: string): boolean => {
  // 完全一致による除外（登録したカラム名と完全に一致する場合のみ除外）
  const exactMatchPatterns = new Set<string>([
    ...EXCLUDED_COLUMN_PATTERNS.idColumns,
    ...EXCLUDED_COLUMN_PATTERNS.dateTimeColumns,
    ...EXCLUDED_COLUMN_PATTERNS.geometryColumns,
    ...EXCLUDED_COLUMN_PATTERNS.systemFlags,
    ...EXCLUDED_COLUMN_PATTERNS.others,
    ...EXCLUDED_COLUMN_PATTERNS.plateauMetadata,
    ...EXCLUDED_COLUMN_PATTERNS.buildingDimensions,
    ...EXCLUDED_COLUMN_PATTERNS.disasterRiskDetails,
    ...EXCLUDED_COLUMN_PATTERNS.geocodingDetails,
  ]);

  if (exactMatchPatterns.has(columnName)) return true;

  // 閾値別カラムのみ正規表現で除外（それ以外は完全一致で除外する方針）
  const matchesRegexPattern = EXCLUDED_COLUMN_PATTERNS.thresholdPatterns.some(
    (regex) => regex.test(columnName),
  );

  return matchesRegexPattern;
};

// カラムの並び順を制御する関数（現在表示中を先頭に、未表示を後に）
const orderColumns = <T extends Record<string, unknown>>(
  properties: T,
  currentlyDisplayed: readonly string[],
): string[] => {
  const allColumns = Object.keys(properties);
  const filteredColumns = allColumns.filter((col) => !isExcludedColumn(col));

  // 現在表示中のカラムを先頭に
  const displayedColumns = currentlyDisplayed.filter((col) =>
    filteredColumns.includes(col),
  );

  // 未表示のカラムを後に
  const undisplayedColumns = filteredColumns.filter(
    (col) => !currentlyDisplayed.includes(col),
  );

  return [...displayedColumns, ...undisplayedColumns];
};

// 値のフォーマット関数（修正しやすいように分離）
const formatValue = (key: string, value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  // 日付の場合
  if (key.includes("date") && typeof value === "string") {
    return formatDate(value, "YYYY/MM/DD");
  }

  // 確率・比率の場合（パーセント表示）
  if (
    key.includes("ratio") ||
    key.includes("percentage") ||
    key === "predicted_probability"
  ) {
    if (typeof value === "number") {
      return `${Math.floor(value * 1000) / 10}%`;
    }
  }

  // フラグの場合
  if (key === "water_disconnection_flag") {
    return value === 0 ? "開" : "閉";
  }

  // R7フラグの場合
  if (key === "buildingtype_determination_not_possible_flag") {
    return value === 1 ? "該当" : "非該当";
  }

  // 数値の場合
  if (typeof value === "number") {
    // 小数点がある場合は適切に丸める
    if (value % 1 !== 0) {
      return (Math.floor(value * 1000) / 1000).toString();
    }
    return value.toString();
  }

  return String(value);
};

// 単位を取得する関数
const getUnit = (key: string): string => {
  const unitMap: Record<string, string> = {
    area: "m²",
    total_water_usage: "立米",
    max_water_usage: "立米",
    avg_water_usage: "立米",
    min_water_usage: "立米",
    household_size: "人",
    members_under_15: "人",
    members_15_to_64: "人",
    members_over_65: "人",
    total_building_count: "件",
    vacant_house_count: "件",
    measuredheight: "m",
    depth: "m",
    duration: "時間",
    floors_above_ground: "階",
    floors_below_ground: "階",
  };

  return unitMap[key] || "";
};

/**
 * optional_data_source（JSON配列）をフラットなプロパティに展開する。
 * 元のoptional_data_sourceキーは除去し、各entryをname→valueに展開する。
 * optionalKeysに展開したキー名を返し、ラベル付与を呼び出し側に委ねる。
 */
const flattenOptionalDataSource = <T extends Record<string, unknown>>(
  properties: T,
): { properties: Record<string, unknown>; optionalKeys: Set<string> } => {
  const { optional_data_source, ...rest } = properties;
  const entries = optional_data_source as
    | OptionalDataSourceEntry[]
    | null
    | undefined;

  if (!Array.isArray(entries))
    return { properties: rest, optionalKeys: new Set() };

  const optionalKeys = new Set(entries.map((entry) => entry.name));
  const expanded = Object.fromEntries(
    entries.map((entry) => [entry.name, entry.value ?? null]),
  );
  return { properties: { ...rest, ...expanded }, optionalKeys };
};

// 全カラム表示用のデータを生成する関数
export const generateAllColumnsData = <T extends Record<string, unknown>>(
  properties: T,
  type: "area" | "building",
): Array<{ key: string; label: string; value: string | null }> => {
  const { properties: flatProperties, optionalKeys } =
    flattenOptionalDataSource(properties);
  const currentlyDisplayed = CURRENTLY_DISPLAYED_COLUMNS[type];
  const orderedColumns = orderColumns(flatProperties, currentlyDisplayed);

  return orderedColumns.map((key) => {
    const value = flatProperties[key];
    const isOptional = optionalKeys.has(key);

    // optional_data_sourceの値はユーザー定義のためフォーマット・単位を適用しない
    if (isOptional) {
      const label = toOdsDisplayName(`${key}${ODS_SUFFIX}`);
      return {
        key,
        label,
        value: value === null || value === undefined ? null : String(value),
      };
    }

    const formattedValue = formatValue(key, value);

    if (formattedValue === null) {
      return {
        key,
        label: translateColumnToJapanese(key, type),
        value: null,
      };
    }

    const unit = getUnit(key);
    const displayValue = unit ? `${formattedValue}${unit}` : formattedValue;

    return {
      key,
      label: translateColumnToJapanese(key, type),
      value: displayValue,
    };
  });
};
