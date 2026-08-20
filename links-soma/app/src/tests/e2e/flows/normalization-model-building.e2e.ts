/**
 * 名寄せ → モデル構築 E2Eテスト
 *
 * 全データセットで名寄せ処理を実行し、その結果を使ってモデル構築が
 * 完了することを確認する。
 *
 * 検証内容:
 * 1. 名寄せ処理: 全データセット指定で正常完了
 * 2. 名寄せ結果: 名前をつけて保存
 * 3. モデル構築: 名寄せ済みデータでPU Baggingモデル構築が正常完了
 * 4. モデル構築結果: 名前をつけて保存
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-model-building
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み（建物ポリゴンデータ含む）
 * 2. Pythonバイナリがビルド済み（cd ml && npm run build）
 *
 * 所要時間: 30-120分（名寄せ + モデル構築処理時間に依存）
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
} from "../../helpers/job-operations";
import {
  navigateAndStartAction,
  fillModelBuildingForm,
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

/** 名寄せ保存時に使う識別名（名寄せ完了後にジョブの作成日時で確定） */
let savedDatasetName = "";

/** 建物ポリゴンデータ名（フィクスチャから自動アップロード、登録済みならそちらを使用） */
const BUILDING_POLYGON_NAME = "建物ポリゴンデータ";

test.describe("名寄せ → モデル構築", () => {
  // ─── 名寄せ ───

  test("名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    await walkWizard(page, {
      buildingRegistry: "skip",
      buildingPolygon: { name: BUILDING_POLYGON_NAME },
      buildingTypeDetermination: "skip",
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
      label: "名寄せ（モデル構築用）",
    });

    expect(finalStatus).toBe("complete");

    // 結合率検証: 住基(juki) + ジオコーディング(geo) + 空き家調査結果(vacant_house) = 3件想定（#1775）
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 3,
      label: "名寄せ（モデル構築用）",
    });
  });

  test("名寄せ結果を名前をつけて保存できること", async () => {
    test.setTimeout(60000);

    savedDatasetName = await generateJobName(page, "モデル構築");
    await saveJobResult(page, { title: savedDatasetName });
  });

  // ─── モデル構築 ───

  test("モデル構築が完了すること", async () => {
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
      trackLabel: "モデル構築",
    });
    if (mlJobId === undefined) {
      throw new Error("ml jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: mlJobId,
      type: "ml",
      tableIndex: 1,
      interval: 30000,
      label: "モデル構築",
    });

    expect(finalStatus).toBe("complete");
  });

  test("モデル構築結果を名前をつけて保存できること", async () => {
    test.setTimeout(60000);

    await saveJobResult(page, { tableIndex: 1, skipVerification: true });

    // 保存後、modelFilesの再取得のためリロード
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    await expect(page.getByText("として保存済み")).toBeVisible({
      timeout: 10000,
    });
  });
});
