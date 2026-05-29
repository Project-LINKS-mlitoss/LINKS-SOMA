/**
 * ジオコーディング済データなしの名寄せ・推定E2Eテスト
 *
 * ジオコーディング済データ（DT213）をスキップした状態で名寄せ処理を実行し、
 * E016（空間結合）がスキップされ、テキストマッチングのみで正常完了すること、
 * さらにその結果で空き家推定も成功することを確認する。
 *
 * 検証内容:
 * 1. 名寄せ処理: ジオコーディングなしでもE016スキップで正常完了
 * 2. 空き家推定: ジオコーディングなしの名寄せ結果でもIF003/E032が正常動作
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-estimation-without-geocoding
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
  waitForJobCompletion,
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

/** 保存時に使う固定名（ジオコーディングなしテスト用） */
const SAVED_DATASET_NAME = "E2Eテスト_ジオコーディングなし";

test.describe("ジオコーディングなし名寄せ・推定処理", () => {
  test("ジオコーディングなしで名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    // geocoding=skip: ジオコーディング済データをスキップ（fullテストとの差分）
    await walkWizard(page, {
      geocoding: "skip",
      buildingRegistry: "skip",
      buildingPolygon: "skip",
      buildingTypeDetermination: "skip",
    });

    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

    // preprocess は wizard intro で createDraftJob により draft が事前作成され、
    // execE001 は jobId 付き update パスを通る。よって URL hash からの抽出で jobId を確定する
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
      label: "名寄せ（ジオコーディングなし）",
    });

    // 名寄せ処理が正常に完了すること（ジオコーディングなしでもE016スキップで完了）
    expect(finalStatus).toBe("complete");

    // 結合率検証: 住基(juki)のみ実施想定。0%なら正常系データで結合失敗
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 1,
      label: "名寄せ（ジオコーディングなし）",
    });
  });

  test("名寄せ結果を名前をつけて保存できること", async () => {
    test.setTimeout(60000);

    await saveJobResult(page, { title: SAVED_DATASET_NAME });
  });

  test("ジオコーディングなし名寄せ結果で空き家推定が完了すること", async () => {
    test.setTimeout(3600000);

    await navigateAndStartAction(page, {
      href: "#evaluation",
      hashIncludes: "evaluation",
      startButton: "空き家推定を始める",
      createHashIncludes: "evaluation/create",
    });

    await fillEstimationForm(page, { datasetName: SAVED_DATASET_NAME });

    await startPipelineAndNavigateToStatus(page, {
      startButton: "分析開始",
      confirmMessage: "分析を開始しました",
      statusHashIncludes: "evaluation",
      createHashExcludes: "create",
    });

    const finalStatus = await waitForJobCompletion(page, {
      interval: 30000,
      label: "推定（ジオコーディングなし）",
    });

    expect(finalStatus).toBe("complete");

    // 推定結果件数検証: complete でも0件出力されていないか
    await verifyEstimationResultCount(page, {
      label: "推定（ジオコーディングなし）",
    });
  });
});
