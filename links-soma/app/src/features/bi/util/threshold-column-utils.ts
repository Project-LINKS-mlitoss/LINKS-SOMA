/**
 * 閾値に基づくカラム名生成ユーティリティ
 * 閾値パラメータを受け取り、対応するDBカラム名を返す
 */

import {
  type ThresholdValue,
  THRESHOLD_VALUES,
} from "../types/schema/parameter";

// 型の再エクスポート
export type { ThresholdValue } from "../types/schema/parameter";

/** 閾値パラメータの値を数値に変換 */
export function parseThresholdValue(value: string): ThresholdValue {
  return parseInt(value, 10) as ThresholdValue;
}

/** 閾値からサフィックスを生成（例: 5 → "_05", 95 → "_95"） */
export function getThresholdSuffix(threshold: ThresholdValue): string {
  return `_${threshold.toString().padStart(2, "0")}`;
}

/**
 * 建物単位: 閾値に対応する predicted_label カラム名を取得
 * @param threshold 閾値（5-95）、undefined の場合は元のカラム名
 */
export function getBuildingPredictedLabelColumn(
  threshold?: ThresholdValue,
): string {
  if (threshold === undefined) {
    return "predicted_label";
  }
  return `predicted_label${getThresholdSuffix(threshold)}`;
}

/**
 * 地域単位: 閾値に対応する vacant_house_count カラム名を取得
 * @param threshold 閾値（5-95）、undefined の場合は元のカラム名
 */
export function getAreaVacantHouseCountColumn(
  threshold?: ThresholdValue,
): string {
  if (threshold === undefined) {
    return "vacant_house_count";
  }
  return `vacant_house_count${getThresholdSuffix(threshold)}`;
}

/**
 * 地域単位: 閾値に対応する predicted_probability カラム名を取得
 * @param threshold 閾値（5-95）、undefined の場合は元のカラム名
 */
export function getAreaPredictedProbabilityColumn(
  threshold?: ThresholdValue,
): string {
  if (threshold === undefined) {
    return "predicted_probability";
  }
  return `predicted_probability${getThresholdSuffix(threshold)}`;
}

/** 閾値関連カラムのベース名一覧 */
export const THRESHOLD_COLUMN_BASES = {
  building: {
    predictedLabel: "predicted_label",
  },
  area: {
    vacantHouseCount: "vacant_house_count",
    predictedProbability: "predicted_probability",
  },
} as const;

/**
 * パラメータ配列から閾値を抽出
 * @param parameters ビューパラメータ配列
 * @returns 閾値（未設定の場合は undefined）
 */
export function extractThresholdFromParameters(
  parameters: Array<{ key: string; type: string; value: unknown }>,
): ThresholdValue | undefined {
  const thresholdParam = parameters.find((p) => p.key === "threshold");
  if (!thresholdParam || typeof thresholdParam.value !== "string") {
    return undefined;
  }
  // 空文字列の場合は未設定として扱う
  if (thresholdParam.value === "") {
    return undefined;
  }
  const parsed = parseThresholdValue(thresholdParam.value);
  // NaNや無効な値の場合は未設定として扱う
  if (
    Number.isNaN(parsed) ||
    !THRESHOLD_VALUES.includes(parsed as (typeof THRESHOLD_VALUES)[number])
  ) {
    return undefined;
  }
  return parsed;
}

/**
 * 閾値に基づいてカラム名を解決する共通関数
 * フィルター条件やY軸カラムの解決に使用
 *
 * @param column 元のカラム名
 * @param threshold 閾値（undefined の場合は元のカラム名をそのまま返す）
 * @param unit 単位（building または area）
 * @returns 解決されたカラム名
 *
 * @example
 * // 建物単位で閾値50の場合
 * resolveColumnWithThreshold("predicted_label", 50, "building")
 * // => "predicted_label_50"
 *
 * // 地域単位で閾値30の場合
 * resolveColumnWithThreshold("vacant_house_count", 30, "area")
 * // => "vacant_house_count_30"
 */
export function resolveColumnWithThreshold(
  column: string,
  threshold: ThresholdValue | undefined,
  unit: "building" | "area",
): string {
  if (threshold === undefined) {
    return column;
  }

  if (unit === "building") {
    if (column === THRESHOLD_COLUMN_BASES.building.predictedLabel) {
      return getBuildingPredictedLabelColumn(threshold);
    }
  } else {
    if (column === THRESHOLD_COLUMN_BASES.area.vacantHouseCount) {
      return getAreaVacantHouseCountColumn(threshold);
    }
    if (column === THRESHOLD_COLUMN_BASES.area.predictedProbability) {
      return getAreaPredictedProbabilityColumn(threshold);
    }
  }

  return column;
}
