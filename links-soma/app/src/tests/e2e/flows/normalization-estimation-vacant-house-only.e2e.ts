/**
 * 空き家調査結果のみ付与した最小構成の名寄せ・推定 E2Eテスト
 *
 * test-matrix.md N19 対応。
 * 必須データ (水道閉開栓・水道使用量・住基・国勢調査) + vacant_house のみ。
 * 他 optional (geocoding / building_registry / building_polygon /
 * building_type_determination / optional_data_source) はすべて skip。
 *
 * 既存 E2E との関係:
 * - vacant_house を select する E2E は本テストが初。既存テストは全て skip 状態
 * - 最小構成では `normalization-estimation-without-geocoding` が juki のみ (vacant_house 含まず)
 *
 * vacant_house の経路 (コード根拠):
 * - param_adapter.py:117: vacant_house UI param → labels_data に変換
 * - IF001.py:391-397: runtime_cfg["labels"] 経由で assign_labels() が is_vacant カラムを追加
 * - vacant_house は preprocess_type="e014" task を作らない (labels 経路)
 *   → expectedJoinSteps = 1 (juki) + 0 (touki skip) + 0 (geocoding skip) = 1
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-estimation-vacant-house-only
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み
 * 2. Pythonバイナリがビルド済み（cd ml && npm run build）
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import {
  startNormalizationWizard,
  walkWizard,
} from "../../helpers/wizard-operations";
import {
  waitForJobCompletionById,
  saveJobResult,
  verifyNormalizationJoiningRates,
  verifyEstimationResultCount,
} from "../../helpers/job-operations";
import {
  navigateAndStartAction,
  fillEstimationForm,
  startPipelineAndNavigateToStatus,
} from "../../helpers/pipeline-operations";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

/** 保存時に使う固定名（空き家のみ最小構成テスト用） */
const SAVED_DATASET_NAME = "E2Eテスト_空き家のみ最小構成";

test.describe("空き家のみ付与最小構成名寄せ・推定処理", () => {
  test("空き家のみ付与最小構成で名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    // vacantHouse=select、他 optional は全 skip が本テストの差分
    await walkWizard(page, {
      geocoding: "skip",
      buildingRegistry: "skip",
      buildingPolygon: "skip",
      buildingTypeDetermination: "skip",
      vacantHouse: "select",
      optionalDataSource: "skip",
    });

    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

    const { newJobId: preprocessJobId } =
      await startPipelineAndNavigateToStatus(page, {
        startButton: "開始する",
        confirmMessage: "データ名寄せ処理を開始しました",
        statusHashIncludes: "normalization",
        draftUrlPathSegment: "normalization",
      });
    if (preprocessJobId === undefined) {
      throw new Error("preprocess jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: preprocessJobId,
      type: "preprocess",
      label: "名寄せ（空き家のみ付与最小構成）",
    });

    expect(finalStatus).toBe("complete");

    // expectedJoinSteps = 1 (juki) のみ
    // (touki/geocoding=skip、vacant_house は labels 経路で join task を作らない)
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 1,
      label: "名寄せ（空き家のみ付与最小構成）",
    });
  });

  test("名寄せ結果を名前をつけて保存できること", async () => {
    test.setTimeout(60000);

    await saveJobResult(page, { title: SAVED_DATASET_NAME });
  });

  test("空き家のみ付与最小構成名寄せ結果で空き家推定が完了すること", async () => {
    test.setTimeout(3600000);

    await navigateAndStartAction(page, {
      href: "#evaluation",
      hashIncludes: "evaluation",
      startButton: "空き家推定を始める",
      createHashIncludes: "evaluation/create",
    });

    await fillEstimationForm(page, { datasetName: SAVED_DATASET_NAME });

    const { newJobId: resultJobId } = await startPipelineAndNavigateToStatus(
      page,
      {
        startButton: "分析開始",
        confirmMessage: "分析を開始しました",
        statusHashIncludes: "evaluation",
        createHashExcludes: "create",
        trackJobType: "result",
        trackLabel: "推定（空き家のみ付与最小構成）",
      },
    );
    if (resultJobId === undefined) {
      throw new Error("result jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: resultJobId,
      type: "result",
      interval: 30000,
      label: "推定（空き家のみ付与最小構成）",
    });

    expect(finalStatus).toBe("complete");

    // 推定結果件数検証: complete でも 0 件出力されていないか
    await verifyEstimationResultCount(page, {
      label: "推定（空き家のみ付与最小構成）",
    });
  });
});
