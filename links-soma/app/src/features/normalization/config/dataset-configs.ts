/**
 * 名寄せ処理のデータセット設定（スキーマベース動的生成）
 * FormNormalizationコンポーネントで使用するデータセットの設定を一元管理
 */

import { type lang } from "../../../shared/config/lang";
import { type FormNormalizationType } from "../hooks/use-form-normalization";
import { extractNormalizationDatasetColumns } from "../util/extract-dataset-columns-from-schema";

// スキーマからデータセットのキーを取得する型
type DataKeys = keyof FormNormalizationType["data"];

// データキーのマッピング（スキーマのスネークケース → UIのキャメルケース）
export const dataKeyMapping = {
  resident_registry: "residentRegistry",
  water_status: "waterStatus",
  water_usage: "waterUsage",
  building_registry: "buildingRegistry",
  building_type_determination: "buildingTypeDetermination",
  geocoding: "geocoding",
  building_polygon: "buildingPolygon",
  vacant_house: "vacantHouse",
  optional_data_source: "optionalDataSource",
} as const satisfies Record<
  DataKeys,
  keyof typeof lang.components.normalizationData
>;

// 表示スタイルの設定（大きな表示にするデータセット）
const LARGE_APPEARANCE_DATASETS_KEYS: DataKeys[] = [
  "resident_registry",
  "water_status",
];

const CATEGORY_DATASETS_KEYS: DataKeys[] = [];

// 必須データセットのキー（ツールチップの説明に基づく）
const REQUIRED_DATASETS_KEYS: DataKeys[] = [
  "resident_registry",
  "water_status",
  "water_usage",
];

// 特殊フォームを持つデータセット
const DATASETS_WITH_FORM = [
  "address_of_lot_number",
  "building_type_determination",
  "building_polygon",
] as const;

// DATASETS_WITH_FORMの要素の型
type DatasetsWithFormType = (typeof DATASETS_WITH_FORM)[number];

type DatasetConfig = {
  fieldName: `data.${DataKeys}`;
  dataKey: keyof typeof lang.components.normalizationData;
  schemaKey: DataKeys;
  appearance: "large" | "default";
  hasColumns: boolean;
  category: "address" | "default";
  hasForm: boolean;
  requirement: "required" | "optional";
};

/**
 * スキーマから動的にデータセット設定を生成
 */
function generateDatasetConfigs(): DatasetConfig[] {
  const schemaDatasets = extractNormalizationDatasetColumns();

  return Object.entries(schemaDatasets).map(([schemaKey, datasetInfo]) => {
    const typedSchemaKey = schemaKey as DataKeys;
    const dataKey = dataKeyMapping[typedSchemaKey];

    if (!dataKey) {
      throw new Error(`Unknown dataset key: ${schemaKey}`);
    }

    const appearance = LARGE_APPEARANCE_DATASETS_KEYS.includes(typedSchemaKey)
      ? "large"
      : "default";

    const category = CATEGORY_DATASETS_KEYS.includes(typedSchemaKey)
      ? "address"
      : "default";

    const hasForm = (DATASETS_WITH_FORM as readonly DataKeys[]).includes(
      typedSchemaKey,
    );

    const requirement = REQUIRED_DATASETS_KEYS.includes(typedSchemaKey)
      ? "required"
      : "optional";

    return {
      fieldName: `data.${typedSchemaKey}` as const,
      dataKey,
      schemaKey: typedSchemaKey,
      appearance,
      hasColumns: datasetInfo.hasColumns,
      category,
      hasForm,
      requirement,
    };
  });
}

// スキーマベースで生成される動的設定
const DATASET_CONFIGS: DatasetConfig[] = generateDatasetConfigs();

// レイアウト用の分類
export const CATEGORY_DEFAULT_DATASETS_WITH_LARGE = DATASET_CONFIGS.filter(
  (config) => config.appearance === "large" && config.category === "default",
);

export const CATEGORY_DEFAULT_DATASETS = DATASET_CONFIGS.filter(
  (config) => config.appearance !== "large" && config.category === "default",
);

export const CATEGORY_ADDRESS_DATASETS_WITH_LARGE = DATASET_CONFIGS.filter(
  (config) => config.appearance === "large" && config.category === "address",
);

export const CATEGORY_ADDRESS_DATASETS = DATASET_CONFIGS.filter(
  (config) => config.appearance !== "large" && config.category === "address",
);

/**
 * schemaKeyがbuilding_type_determinationまたはaddress_of_lot_numberであるかを検証する型ガード関数
 * @param schemaKey - 検証対象のスキーマキー
 * @returns schemaKeyがbuilding_type_determinationまたはaddress_of_lot_numberの場合true
 */
export function isSpecialDatasetSchemaKey(
  schemaKey: string,
): schemaKey is DatasetsWithFormType {
  return DATASETS_WITH_FORM.includes(schemaKey as DatasetsWithFormType);
}

// 必須・任意による分類
export const REQUIRED_DATASETS = DATASET_CONFIGS.filter(
  (config) => config.requirement === "required",
);

export const OPTIONAL_DATASETS = DATASET_CONFIGS.filter(
  (config) => config.requirement === "optional",
);
