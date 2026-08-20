import { describe, expect, it } from "vitest";
import { lang } from "../../../../shared/config/lang";
import {
  WIZARD_STEPS,
  TOTAL_STEPS,
  resolveStepConfig,
  buildWizardSteps,
  type WizardStepConfig,
} from "./wizard-steps";

const normData = lang.components.normalizationData;

/** dataset ステップの schemaKey 列（順序検証用） */
const datasetKeys = (steps: typeof WIZARD_STEPS): (string | null)[] =>
  steps.filter((s) => s.type === "dataset").map((s) => s.schemaKey);

const findStep = (
  steps: typeof WIZARD_STEPS,
  schemaKey: string,
): WizardStepConfig => {
  const step = steps.find((s) => s.schemaKey === schemaKey);
  if (!step) throw new Error(`step not found: ${schemaKey}`);
  return step;
};

describe("resolveStepConfig（目的による必須性・説明文の解決）", () => {
  it("vacant_house は AIモデル構築のみ必須、空き家推定では任意", () => {
    const vacantHouse = findStep(WIZARD_STEPS, "vacant_house");
    expect(resolveStepConfig(vacantHouse, "model_training").isRequired).toBe(
      true,
    );
    expect(
      resolveStepConfig(vacantHouse, "vacancy_estimation").isRequired,
    ).toBe(false);
  });

  it("vacant_house の説明文は目的別 descriptionByPurpose を返す", () => {
    const vacantHouse = findStep(WIZARD_STEPS, "vacant_house");
    expect(resolveStepConfig(vacantHouse, "model_training").description).toBe(
      normData.vacantHouse.descriptionByPurpose.model_training,
    );
    expect(
      resolveStepConfig(vacantHouse, "vacancy_estimation").description,
    ).toBe(normData.vacantHouse.descriptionByPurpose.vacancy_estimation);
  });

  it("必須データ(water_status)の必須性は目的に依存せず、説明文は既定値のまま", () => {
    const waterStatus = findStep(WIZARD_STEPS, "water_status");
    for (const purpose of ["vacancy_estimation", "model_training"] as const) {
      const resolved = resolveStepConfig(waterStatus, purpose);
      expect(resolved.isRequired).toBe(true);
      expect(resolved.description).toBe(waterStatus.description);
    }
  });

  it("building_registry は目的で説明文だけ変わり、必須性は任意のまま", () => {
    const buildingRegistry = findStep(WIZARD_STEPS, "building_registry");
    const resolved = resolveStepConfig(buildingRegistry, "model_training");
    expect(resolved.isRequired).toBe(false);
    expect(resolved.description).toBe(
      normData.buildingRegistry.descriptionByPurpose.model_training,
    );
  });

  it("元の WIZARD_STEPS を破壊しない（純粋関数）", () => {
    const vacantHouse = findStep(WIZARD_STEPS, "vacant_house");
    const before = vacantHouse.isRequired;
    resolveStepConfig(vacantHouse, "model_training");
    expect(vacantHouse.isRequired).toBe(before);
  });
});

describe("buildWizardSteps（必須→任意の安定ソート）", () => {
  it("ステップ総数は目的に依らず TOTAL_STEPS で不変", () => {
    expect(buildWizardSteps("vacancy_estimation")).toHaveLength(TOTAL_STEPS);
    expect(buildWizardSteps("model_training")).toHaveLength(TOTAL_STEPS);
  });

  it("intro / settings / confirmation の位置は不変", () => {
    for (const purpose of ["vacancy_estimation", "model_training"] as const) {
      const steps = buildWizardSteps(purpose);
      expect(steps[0].type).toBe("intro");
      expect(steps[1].type).toBe("settings");
      expect(steps[steps.length - 1].type).toBe("confirmation");
    }
  });

  it("空き家推定では並びが WIZARD_STEPS のまま（既に必須先頭のため）", () => {
    expect(datasetKeys(buildWizardSteps("vacancy_estimation"))).toEqual(
      datasetKeys(WIZARD_STEPS),
    );
  });

  it("AIモデル構築では vacant_house が必須ブロック末尾（resident_registry の直後）へ繰り上がる", () => {
    const keys = datasetKeys(buildWizardSteps("model_training"));
    expect(keys).toEqual([
      "water_status",
      "water_usage",
      "resident_registry",
      "vacant_house",
      "geocoding",
      "building_registry",
      "building_polygon",
      "building_type_determination",
      "optional_data_source",
    ]);
  });

  it("AIモデル構築でも必須データの相対順は安定（water_status→water_usage→resident_registry）", () => {
    const steps = buildWizardSteps("model_training");
    const required = steps
      .filter((s) => s.type === "dataset" && s.isRequired)
      .map((s) => s.schemaKey);
    expect(required).toEqual([
      "water_status",
      "water_usage",
      "resident_registry",
      "vacant_house",
    ]);
  });

  it("全ての必須データセットが全ての任意データセットより前に並ぶ", () => {
    for (const purpose of ["vacancy_estimation", "model_training"] as const) {
      const datasets = buildWizardSteps(purpose).filter(
        (s) => s.type === "dataset",
      );
      const lastRequired = datasets.map((s) => s.isRequired).lastIndexOf(true);
      const firstOptional = datasets.map((s) => s.isRequired).indexOf(false);
      expect(lastRequired).toBeLessThan(firstOptional);
    }
  });
});
