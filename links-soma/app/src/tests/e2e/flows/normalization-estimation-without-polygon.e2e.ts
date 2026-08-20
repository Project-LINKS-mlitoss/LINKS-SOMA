/**
 * 建物ポリゴンデータなしの名寄せ・推定E2Eテスト
 *
 * 建物ポリゴンデータをスキップした状態で名寄せ処理を実行し、
 * 処理が正常に完了すること、さらにその結果で空き家推定も成功することを確認する。
 *
 * 検証内容:
 * 1. 名寄せ処理: 建物ポリゴンなしでもE016がフォールバックパスで正常完了
 * 2. 空き家推定: ポリゴンなしの名寄せ結果でもIF003/E032が正常動作
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-estimation-without-polygon
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み
 * 2. Pythonバイナリがビルド済み（cd ml && npm run build）
 * 3. 推定テストにはモデルファイルが必要（アプリ初期化で自動作成）
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

/** 保存時に使う固定名（ポリゴンなしテスト用） */
const SAVED_DATASET_NAME = "E2Eテスト_ポリゴンなし";

test.describe("建物ポリゴンなし名寄せ・推定処理", () => {
  test("建物ポリゴンなしで名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    // buildingPolygon=skip: 建物ポリゴンをスキップ（fullテストとの差分）
    await walkWizard(page, {
      buildingRegistry: "skip",
      buildingPolygon: "skip",
      buildingTypeDetermination: "skip",
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
      label: "名寄せ（ポリゴンなし）",
    });

    // 名寄せ処理が正常に完了すること（建物ポリゴンなしでもエラーにならない）
    expect(finalStatus).toBe("complete");

    // 結合率検証: 住基(juki) + ジオコーディング(geo) = 2件想定
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 2,
      label: "名寄せ（ポリゴンなし）",
    });
  });

  test("名寄せ結果を名前をつけて保存できること", async () => {
    test.setTimeout(60000);

    await saveJobResult(page, { title: SAVED_DATASET_NAME });
  });

  test("ポリゴンなし名寄せ結果で空き家推定が完了すること", async () => {
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
        startButton: "推定開始",
        confirmMessage: "分析を開始しました",
        statusHashIncludes: "evaluation",
        createHashExcludes: "create",
        trackJobType: "result",
        trackLabel: "推定（ポリゴンなし）",
      },
    );
    if (resultJobId === undefined) {
      throw new Error("result jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: resultJobId,
      type: "result",
      interval: 30000,
      label: "推定（ポリゴンなし）",
    });

    expect(finalStatus).toBe("complete");

    // 推定結果件数検証
    await verifyEstimationResultCount(page, { label: "推定（ポリゴンなし）" });
  });
});
