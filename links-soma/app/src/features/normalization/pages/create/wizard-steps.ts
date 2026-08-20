/**
 * 名寄せ処理ウィザードのステップ設定
 */

import { lang } from "../../../../shared/config/lang";
import {
  type FormNormalizationType,
  type NormalizationPurpose,
} from "../../hooks/use-form-normalization";

// データセットのスキーマキー型
export type DataKeys = keyof FormNormalizationType["data"];

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
 * 目的に応じてステップの必須性・説明文を解決する。
 * - vacant_house（空き家調査結果）は AIモデル構築用のみ必須
 * - 一部データセットは目的で説明文が変わる
 */
export const resolveStepConfig = (
  step: WizardStepConfig,
  purpose: NormalizationPurpose,
): WizardStepConfig => {
  const isRequired =
    step.schemaKey === "vacant_house"
      ? purpose === "model_training"
      : step.isRequired;
  return {
    ...step,
    isRequired,
    description: resolveStepDescription(step, purpose),
  };
};

const resolveStepDescription = (
  step: WizardStepConfig,
  purpose: NormalizationPurpose,
): string => {
  switch (step.schemaKey) {
    case "vacant_house":
      return normData.vacantHouse.descriptionByPurpose[purpose];
    case "optional_data_source":
      return normData.optionalDataSource.descriptionByPurpose[purpose];
    case "building_registry":
      return normData.buildingRegistry.descriptionByPurpose[purpose];
    case "building_type_determination":
      return normData.buildingTypeDetermination.descriptionByPurpose[purpose];
    default:
      return step.description;
  }
};

/**
 * 目的で解決したステップ列を返す。データセットステップは必須→任意の順に
 * 安定ソートし、必須データを先に提示する。intro/settings/confirmation の位置は不変。
 */
export const buildWizardSteps = (
  purpose: NormalizationPurpose,
): WizardStepConfig[] => {
  const resolved = WIZARD_STEPS.map((step) => resolveStepConfig(step, purpose));
  const first = resolved.findIndex((step) => step.type === "dataset");
  if (first === -1) return resolved;
  const last = resolved.map((step) => step.type).lastIndexOf("dataset");
  const block = resolved.slice(first, last + 1);
  const required = block.filter((step) => step.isRequired);
  const optional = block.filter((step) => !step.isRequired);
  resolved.splice(first, block.length, ...required, ...optional);
  return resolved;
};

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
