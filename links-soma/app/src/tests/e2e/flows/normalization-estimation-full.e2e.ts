/**
 * 全データセット指定の名寄せ・推定E2Eテスト
 *
 * ジオコーディング済データ + 建物ポリゴンデータを含む全データセットで
 * 名寄せ処理を実行し、さらにその結果で空き家推定が完了することを確認する。
 *
 * 検証内容:
 * 1. 名寄せ処理: 全データセット指定でE016（空間結合）が正常完了
 * 2. モデル構築: 名寄せ済みデータでPU Baggingモデル構築が正常完了
 * 3. 空き家推定: IF002構築モデルでIF003/E032が正常動作
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-estimation-full
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み（建物ポリゴンデータ含む）
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
  fillEstimationForm,
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

/** 保存時に使う識別名（推定テストで同じ名前を検索して選択する。名寄せ完了後にジョブの作成日時で確定） */
let savedDatasetName = "";

/** モデル構築結果の保存名（推定テストのモデル選択で使用） */
let savedModelName = "";

/** 建物ポリゴンデータ名（フィクスチャから自動アップロード、登録済みならそちらを使用） */
const BUILDING_POLYGON_NAME = "建物ポリゴンデータ";

test.describe("全データセット名寄せ・推定処理", () => {
  test("全データセット指定で名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    // === ウィザードを進める ===
    await startNormalizationWizard(page);

    await walkWizard(page, {
      buildingRegistry: "skip",
      buildingPolygon: { name: BUILDING_POLYGON_NAME },
      buildingTypeDetermination: "skip",
      vacantHouse: "select",
    });

    // 確認画面に到達
    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

    // === 名寄せ処理を実行（draft URL hash から jobId を確定する） ===
    // preprocess は wizard intro で createDraftJob により draft が事前作成され、
    // execE001 は jobId 付き update パスを通る。snapshot 差分では新規 insert が
    // 観測できないため、URL hash から draft jobId を抽出する
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

    // === ジョブ完了まで ID ベースで待機（詳細画面へ遷移 → IPC 直読み） ===
    const finalStatus = await waitForJobCompletionById(page, {
      jobId: preprocessJobId,
      type: "preprocess",
      label: "名寄せ（フルデータ）",
    });

    expect(finalStatus).toBe("complete");

    // 結合率検証: 住基(juki) + ジオコーディング(geo) + 空き家調査結果(vacant_house) = 3件想定（#1775）
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 3,
      label: "名寄せ（フルデータ）",
    });
  });

  test("名寄せ結果を名前をつけて保存できること", async () => {
    test.setTimeout(60000);

    savedDatasetName = await generateJobName(page, "フルデータ");
    await saveJobResult(page, { title: savedDatasetName });
  });

  // ─── モデル構築 ───

  test("モデル構築が完了すること", async () => {
    test.setTimeout(3600000);

    // モデル構築画面に遷移して開始
    await navigateAndStartAction(page, {
      href: "#model",
      hashIncludes: "model",
      startButton: "モデル構築を始める",
      createHashIncludes: "model/create",
    });

    // フォーム入力
    await fillModelBuildingForm(page, { datasetName: savedDatasetName });

    // モデル構築開始（snapshot 差分で新規 ml jobId を確定する）
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

    // ジョブ完了まで ID ベースで待機（モデル構築画面は 2 番目のテーブル）
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

    savedModelName = await generateJobName(page, "モデル", 1);
    await saveJobResult(page, { title: savedModelName, tableIndex: 1, skipVerification: true });

    // 保存後、modelFilesの再取得のためリロード
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    await expect(page.getByText("として保存済み")).toBeVisible({
      timeout: 10000,
    });
  });

  // ─── 推定 ───

  test("フルデータ名寄せ結果で空き家推定が完了すること", async () => {
    test.setTimeout(3600000);

    // 空き家推定画面に遷移して開始
    await navigateAndStartAction(page, {
      href: "#evaluation",
      hashIncludes: "evaluation",
      startButton: "空き家推定を始める",
      createHashIncludes: "evaluation/create",
    });

    // フォーム入力
    await fillEstimationForm(page, {
      datasetName: savedDatasetName,
      modelName: savedModelName,
    });

    // 推定開始（snapshot 差分で新規 result jobId を確定する）
    const { newJobId: resultJobId } = await startPipelineAndNavigateToStatus(
      page,
      {
        startButton: "推定開始",
        confirmMessage: "分析を開始しました",
        statusHashIncludes: "evaluation",
        createHashExcludes: "create",
        trackJobType: "result",
        trackLabel: "推定（フルデータ）",
      },
    );
    if (resultJobId === undefined) {
      throw new Error("result jobId が確定していません");
    }

    // ジョブ完了まで ID ベースで待機
    const finalStatus = await waitForJobCompletionById(page, {
      jobId: resultJobId,
      type: "result",
      interval: 30000,
      label: "推定（フルデータ）",
    });

    expect(finalStatus).toBe("complete");

    // 推定結果件数検証
    await verifyEstimationResultCount(page, { label: "推定（フルデータ）" });
  });
});
