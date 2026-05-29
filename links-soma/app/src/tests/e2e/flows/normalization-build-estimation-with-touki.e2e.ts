/**
 * 登記データあり 名寄せ → モデル構築 → 推定 E2Eテスト
 *
 * normalization-estimation-with-touki.e2e.ts との違い:
 * - 元テストはプリセットモデルで推定（FEATURE_COLS変更時に非互換）
 * - 本テストは名寄せ結果からモデル構築し、そのモデルで推定する
 *
 * 検証内容:
 * 1. 名寄せ処理: 登記データを含む名寄せが正常完了
 * 2. モデル構築: 新FEATURE_COLS（39個）でPU Baggingモデル構築が正常完了
 * 3. 空き家推定: 構築したモデルで推定が正常完了
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-build-estimation-with-touki
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み（登記.csv、建物ポリゴンデータ含む）
 * 2. Pythonバイナリがビルド済み（cd ml && npm run build）
 *
 * 所要時間: 30-120分（名寄せ + モデル構築 + 推定処理時間に依存）
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
  generateJobName,
  verifyNormalizationJoiningRates,
  verifyEstimationResultCount,
} from "../../helpers/job-operations";
import {
  navigateAndStartAction,
  fillModelBuildingForm,
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

let savedDatasetName = "";
let savedModelName = "";
const BUILDING_POLYGON_NAME = "建物ポリゴンデータ";

test.describe("登記データあり 名寄せ → モデル構築 → 推定", () => {
  // ─── 名寄せ ───

  test("登記データを含む名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    await walkWizard(page, {
      buildingRegistry: "select",
      buildingPolygon: { name: BUILDING_POLYGON_NAME },
      vacantHouse: "select",
    });

    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

    const { newJobId: preprocessJobId } = await startPipelineAndNavigateToStatus(
      page,
      {
        startButton: "開始する",
        confirmMessage: "データ名寄せ処理を開始しました",
        statusHashIncludes: "normalization",
        draftUrlPathSegment: "normalization",
      },
    );
    if (preprocessJobId === undefined) {
      throw new Error("preprocess jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: preprocessJobId,
      type: "preprocess",
      label: "名寄せ（登記+モデル構築用）",
    });

    expect(finalStatus).toBe("complete");

    // 結合率検証: 住基(juki) + 登記(touki) + ジオコーディング(geo) = 3件想定
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 3,
      label: "名寄せ（登記+モデル構築用）",
    });
  });

  test("名寄せ結果を保存できること", async () => {
    test.setTimeout(60000);

    savedDatasetName = await generateJobName(page, "登記+構築+推定");
    await saveJobResult(page, { title: savedDatasetName });
  });

  // ─── モデル構築 ───

  test("名寄せ結果でモデル構築が完了すること", async () => {
    test.setTimeout(3600000);

    await navigateAndStartAction(page, {
      href: "#model",
      hashIncludes: "model",
      startButton: "モデル構築を始める",
      createHashIncludes: "model/create",
    });

    await fillModelBuildingForm(page, { datasetName: savedDatasetName });

    const { newJobId: mlJobId } = await startPipelineAndNavigateToStatus(page, {
      startButton: "モデル構築開始",
      confirmMessage: "モデル構築処理を開始しました",
      statusHashIncludes: "model",
      createHashExcludes: "create",
      trackJobType: "ml",
      trackLabel: "モデル構築（登記データあり）",
    });
    if (mlJobId === undefined) {
      throw new Error("ml jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: mlJobId,
      type: "ml",
      tableIndex: 1,
      interval: 30000,
      label: "モデル構築（登記データあり）",
    });

    expect(finalStatus).toBe("complete");
  });

  test("モデル構築結果を保存できること", async () => {
    test.setTimeout(60000);

    savedModelName = await generateJobName(page, "登記あり構築モデル");
    await saveJobResult(page, {
      title: savedModelName,
      tableIndex: 1,
      skipVerification: true,
    });

    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    await expect(page.getByText("として保存済み")).toBeVisible({
      timeout: 10000,
    });
  });

  // ─── 推定 ───

  test("構築したモデルで空き家推定が完了すること", async () => {
    test.setTimeout(3600000);

    await navigateAndStartAction(page, {
      href: "#evaluation",
      hashIncludes: "evaluation",
      startButton: "空き家推定を始める",
      createHashIncludes: "evaluation/create",
    });

    await fillEstimationForm(page, {
      datasetName: savedDatasetName,
      modelName: savedModelName,
    });

    const { newJobId: resultJobId } = await startPipelineAndNavigateToStatus(
      page,
      {
        startButton: "分析開始",
        confirmMessage: "分析を開始しました",
        statusHashIncludes: "evaluation",
        createHashExcludes: "create",
        trackJobType: "result",
        trackLabel: "推定（構築モデル使用）",
      },
    );
    if (resultJobId === undefined) {
      throw new Error("result jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: resultJobId,
      type: "result",
      interval: 30000,
      label: "推定（構築モデル使用）",
    });

    expect(finalStatus).toBe("complete");

    // 推定結果件数検証
    await verifyEstimationResultCount(page, {
      label: "推定（構築モデル使用）",
    });
  });
});
