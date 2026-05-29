import { z } from "zod";
import { schema as normalizationSchema } from "../hooks/use-form-normalization";
import { LanguageMap } from "../../../shared/config/metadata";
import { lang } from "../../../shared/config/lang";

// スキーマからデータセットカラム情報を抽出する型定義
type DatasetColumnInfo = {
  key: string;
  label: string;
  description?: string;
};

// データセットの構造情報を表す型
type DatasetInfo = {
  dataKey: string;
  hasColumns: boolean;
  columns: DatasetColumnInfo[];
  hasSpecialFields?: boolean; // building_polygonのような特殊フィールドがあるか
};

// モジュールレベルのキャッシュ
// スキーマは実行時に変更されないため、一度解析すれば再利用可能
let cachedDatasets: Record<string, DatasetInfo> | null = null;

/**
 * NORMALIZATION_PARAMETER_LABELのキーかどうかを判定する型ガード
 */
function isValidLabelKey(
  key: string,
): key is keyof typeof LanguageMap.NORMALIZATION_PARAMETER_LABEL {
  return key in LanguageMap.NORMALIZATION_PARAMETER_LABEL;
}

/**
 * normalizationParametersのキーかどうかを判定する型ガード
 */
function isValidNormalizationParameterKey(
  key: string,
): key is keyof typeof lang.components.normalizationParameters {
  return key in lang.components.normalizationParameters;
}

/**
 * Zodスキーマからデータセットのカラム情報を動的に抽出する
 * 結果はモジュールレベルでキャッシュされる
 */
export function extractNormalizationDatasetColumns(): Record<
  string,
  DatasetInfo
> {
  // キャッシュがあれば返す
  if (cachedDatasets !== null) {
    return cachedDatasets;
  }

  const dataSchema = normalizationSchema.shape.data;
  const datasets: Record<string, DatasetInfo> = {};

  // 各データセットを解析
  Object.entries(dataSchema.shape).forEach(([dataKey, datasetSchema]) => {
    const shape = datasetSchema.shape;

    // columnsフィールドの存在確認
    const hasColumns = "columns" in shape;
    const columns: DatasetColumnInfo[] = [];

    if (hasColumns && shape.columns instanceof z.ZodObject) {
      // columnsオブジェクトからカラム情報を抽出
      Object.keys(shape.columns.shape).forEach((columnKey) => {
        // 型ガードを使用して安全にラベルを取得
        const label = isValidLabelKey(columnKey)
          ? LanguageMap.NORMALIZATION_PARAMETER_LABEL[columnKey]
          : columnKey;

        const description = isValidNormalizationParameterKey(columnKey)
          ? lang.components.normalizationParameters[columnKey].description
          : ``;

        columns.push({
          key: columnKey,
          label,
          description,
        });
      });
    }

    // 特殊フィールド（input_file_type, data_typeなど）の確認
    const hasSpecialFields = Object.keys(shape).some(
      (key) => !["id", "path", "columns"].includes(key),
    );

    datasets[dataKey] = {
      dataKey,
      hasColumns,
      columns,
      hasSpecialFields,
    };
  });

  // キャッシュに保存
  cachedDatasets = datasets;

  return datasets;
}

/**
 * 特定のデータセットのカラム情報を取得
 */
export function getNormalizationDatasetInfo(
  dataKey: string,
): DatasetInfo | undefined {
  const datasets = extractNormalizationDatasetColumns();
  return datasets[dataKey];
}
