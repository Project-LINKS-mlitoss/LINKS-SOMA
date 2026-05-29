/**
 * 推定対象選定用データ（buildingTypeDetermination）ありの名寄せ・推定E2Eテスト
 *
 * flow-normalization-estimation-full.e2e.ts との違い:
 * - fullテストは buildingTypeDetermination=skip
 * - 本テストは buildingTypeDetermination=select
 * - これにより IF001 の E015（建物種別判定・住所マッチング）パスを検証する
 *
 * 検証内容:
 * 1. 名寄せ処理: 推定対象選定用データを含む名寄せが正常完了
 * 2. 空き家推定: 推定対象選定用データを含む名寄せ結果でIF003が正常動作
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-estimation-with-building-type
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み（推定対象選定用データ.csv、建物ポリゴンデータ含む）
 * 2. Pythonバイナリがビルド済み（cd ml && npm run build）
 *
 * 所要時間: 20-120分（名寄せ + 推定処理時間に依存）
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

/** 保存時に使う識別名 */
let savedDatasetName = "";

/** 建物ポリゴンデータ名（フィクスチャから自動アップロード、登録済みならそちらを使用） */
const BUILDING_POLYGON_NAME = "建物ポリゴンデータ";

test.describe("推定対象選定用データあり名寄せ・推定処理", () => {
  test("推定対象選定用データを含む名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    // buildingTypeDetermination=select で推定対象選定用データを含める（fullテストとの差分）
    await walkWizard(page, {
      buildingRegistry: "skip",
      buildingPolygon: { name: BUILDING_POLYGON_NAME },
      buildingTypeDetermination: "select",
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
      label: "名寄せ（推定対象選定用データあり）",
    });

    expect(finalStatus).toBe("complete");

    // 結合率検証: 住基(juki) + ジオコーディング(geo) = 2件想定（buildingRegistryはskip）
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 2,
      label: "名寄せ（推定対象選定用データあり）",
    });
  });

  test("名寄せ結果を名前をつけて保存できること", async () => {
    test.setTimeout(60000);

    savedDatasetName = await generateJobName(page, "建物種別あり");
    await saveJobResult(page, { title: savedDatasetName });
  });

  test("推定対象選定用データあり名寄せ結果で空き家推定が完了すること", async () => {
    test.setTimeout(3600000);

    await navigateAndStartAction(page, {
      href: "#evaluation",
      hashIncludes: "evaluation",
      startButton: "空き家推定を始める",
      createHashIncludes: "evaluation/create",
    });

    // モデルは名前指定なし（先頭のモデルを使用）
    await fillEstimationForm(page, { datasetName: savedDatasetName });

    const { newJobId: resultJobId } = await startPipelineAndNavigateToStatus(
      page,
      {
        startButton: "分析開始",
        confirmMessage: "分析を開始しました",
        statusHashIncludes: "evaluation",
        createHashExcludes: "create",
        trackJobType: "result",
        trackLabel: "推定（推定対象選定用データあり）",
      },
    );
    if (resultJobId === undefined) {
      throw new Error("result jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: resultJobId,
      type: "result",
      interval: 30000,
      label: "推定（推定対象選定用データあり）",
    });

    expect(finalStatus).toBe("complete");

    // 推定結果件数検証
    await verifyEstimationResultCount(page, {
      label: "推定（推定対象選定用データあり）",
    });
  });
});
