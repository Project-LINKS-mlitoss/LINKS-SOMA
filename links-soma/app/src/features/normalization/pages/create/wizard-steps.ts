/**
 * 名寄せ処理ウィザードのステップ設定
 */

import { lang } from "../../../../shared/config/lang";
import { type FormNormalizationType } from "../../hooks/use-form-normalization";

// データセットのスキーマキー型
type DataKeys = keyof FormNormalizationType["data"];

// ステップタイプ
type StepType = "intro" | "settings" | "dataset" | "confirmation";

// ステップ設定の型
export type WizardStepConfig = {
  type: StepType;
  schemaKey: DataKeys | null;
  title: string;
  description: string;
  isRequired: boolean;
};

// lang.ts の normalizationData へのショートカット
const normData = lang.components.normalizationData;

/**
 * ウィザードステップの定義
 */
export const WIZARD_STEPS: WizardStepConfig[] = [
  // ===== はじめに =====
  {
    type: "intro",
    schemaKey: null,
    title: lang.components.normalizationParameters.wizardIntro.label,
    description:
      lang.components.normalizationParameters.wizardIntro.description,
    isRequired: true,
  },
  // ===== 設定 =====
  {
    type: "settings",
    schemaKey: null,
    title: "基本設定",
    description: lang.components.normalizationParameters.settings.description,
    isRequired: true,
  },
  // ===== 必須データセット =====
  {
    type: "dataset",
    schemaKey: "water_status",
    title: normData.waterStatus.label,
    description: normData.waterStatus.description,
    isRequired: true,
  },
  {
    type: "dataset",
    schemaKey: "water_usage",
    title: normData.waterUsage.label,
    description: normData.waterUsage.description,
    isRequired: true,
  },
  {
    type: "dataset",
    schemaKey: "resident_registry",
    title: normData.residentRegistry.label,
    description: normData.residentRegistry.description,
    isRequired: true,
  },
  {
    type: "dataset",
    schemaKey: "census",
    title: normData.census.label,
    description: normData.census.description,
    isRequired: true,
  },
  // ===== 任意データセット =====
  {
    type: "dataset",
    schemaKey: "geocoding",
    title: normData.geocoding.label,
    description: normData.geocoding.description,
    isRequired: false,
  },
  {
    type: "dataset",
    schemaKey: "building_registry",
    title: normData.buildingRegistry.label,
    description: normData.buildingRegistry.description,
    isRequired: false,
  },
  {
    type: "dataset",
    schemaKey: "building_polygon",
    title: normData.buildingPolygon.label,
    description: normData.buildingPolygon.description,
    isRequired: false,
  },
  {
    type: "dataset",
    schemaKey: "building_type_determination",
    title: normData.buildingTypeDetermination.label,
    description: normData.buildingTypeDetermination.description,
    isRequired: false,
  },
  {
    type: "dataset",
    schemaKey: "vacant_house",
    title: normData.vacantHouse.label,
    description: normData.vacantHouse.description,
    isRequired: false,
  },
  {
    type: "dataset",
    schemaKey: "optional_data_source",
    title: normData.optionalDataSource.label,
    description: normData.optionalDataSource.description,
    isRequired: false,
  },
  // ===== 確認 =====
  {
    type: "confirmation",
    schemaKey: null,
    title: lang.components.normalizationParameters.wizardConfirmation.label,
    description:
      lang.components.normalizationParameters.wizardConfirmation.description,
    isRequired: true,
  },
];

export const TOTAL_STEPS = WIZARD_STEPS.length;

/**
 * ステップインデックスからステップ設定を取得
 */
export const getStepConfig = (
  stepIndex: number,
): WizardStepConfig | undefined => {
  return WIZARD_STEPS[stepIndex];
};

/**
 * type または schemaKey からステップインデックスを取得
 */
export const getStepIndex = (
  key: WizardStepConfig["type"] | WizardStepConfig["schemaKey"],
): number => {
  const index = WIZARD_STEPS.findIndex(
    (step) => step.type === key || step.schemaKey === key,
  );
  if (index === -1) {
    throw new Error(`Step not found: ${key}`);
  }
  return index;
};

/**
 * データセットタイプのステップのみを取得
 */
export const getDatasetSteps = (): WizardStepConfig[] => {
  return WIZARD_STEPS.filter((step) => step.type === "dataset");
};
