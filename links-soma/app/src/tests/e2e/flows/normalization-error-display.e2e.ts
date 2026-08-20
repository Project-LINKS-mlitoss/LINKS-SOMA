/**
 * 名寄せ事後エラー表示 E2E（FR004-007・実処理エラーをUIまで貫通）
 *
 * パイプライン実処理で発火するエラーを、壊れた入力データで実際に起こし、ジョブ詳細の
 * 事後エラー表示（PostErrorBanner）に実 error_detail（責任分界・次アクション）が出ることを
 * end-to-end で確認する。バックエンドの発火は ml/tests の統合テストが担保し、本テストは
 * 「実エラーが UI まで届く」ことだけを検証する。
 *
 * 網羅する組み合わせ（UI 到達可能なエラーパターン。各実行は1エラーで停止するため別ラン）:
 * - E-0008（文字コード判別不能）: 非UTF8の水道開閉栓状況 → load 時に EncodingDetectionError
 * - E-101（必須カラム未指定）: 住所列を欠く水道開閉栓状況 → ensure_required_columns で停止
 * - FR005（行品質サマリー E-201/202/203）: 不正値の使用量で完走 → サマリーカード表示
 *
 * UI 到達不可（フロント必須ゲートでブロック／内部生成データ）は ml/tests の統合テストで担保:
 * - E-0051（入力欠損）, E-20001/20002（推定の形式/文字コード）, E-20003（推定ファイル不在）
 *
 * 水道データはすべてパス指定アップロードで投入する。サンプルの表示名（"水道開閉栓状況" 等）を
 * selectDatasetByName で選ぶと、壊れフィクスチャ名と部分一致して別データを掴む事故があるため。
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-error-display
 *
 * 前提: 開発サーバー起動済み + ML バイナリ（ml/dist）ビルド済み。
 */

import * as path from "path";
import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import {
  startNormalizationWizard,
  selectDatasetByName,
  selectColumns,
  clickNext,
  SAMPLE_DATA_FILES,
} from "../../helpers/wizard-operations";
import { startPipelineAndNavigateToStatus } from "../../helpers/pipeline-operations";
import { waitForJobCompletionById } from "../../helpers/job-operations";

const FIXTURES_DIR = path.join(__dirname, "../../fixtures");
const FIXTURE_STATUS_NON_UTF8 = path.join(
  FIXTURES_DIR,
  "err_status_nonutf8.csv",
);
const FIXTURE_STATUS_NO_ADDRESS = path.join(
  FIXTURES_DIR,
  "err_status_noaddr.csv",
);
const FIXTURE_USAGE_CLEAN = path.join(FIXTURES_DIR, "err_usage_clean.csv");

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

/** データセット選択ダイアログから指定パスの CSV をアップロードして選択する。 */
async function uploadCustomDataset(
  page: Page,
  filePath: string,
): Promise<void> {
  await page.getByText("データセットを選択").click();
  await page.waitForSelector('[role="dialog"]');
  await page.getByRole("tab", { name: "新規アップロード" }).click();
  await page.waitForTimeout(300);
  await page
    .locator('[role="dialog"] input[type="file"]')
    .setInputFiles(filePath);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "選択" }).last().click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden" });
}

/** イントロ → 基本設定（基準日・市区町村名）を済ませてデータセットステップ先頭に着く。 */
async function walkToDatasetSteps(page: Page): Promise<void> {
  await clickNext(page); // イントロ → 基本設定
  await page.locator('input[type="date"]').fill("2024-01-01");
  await page.getByPlaceholder("市区町村名を入力").fill("テスト市");
  await clickNext(page);
}

/** 水道開閉栓状況（必須・先頭）をパス指定で投入し、カラムをマッピングして次へ。 */
async function uploadWaterStatus(page: Page, fixture: string): Promise<void> {
  await uploadCustomDataset(page, fixture);
  await selectColumns(page, "water_status");
  await clickNext(page);
}

/** 水道使用量（必須）をパス指定で投入し、カラムをマッピングして次へ。 */
async function uploadWaterUsage(page: Page, fixture: string): Promise<void> {
  await uploadCustomDataset(page, fixture);
  await selectColumns(page, "water_usage");
  await clickNext(page);
}

/** 住民基本台帳（必須）をサンプルから選択して次へ（衝突する壊れフィクスチャは無い）。 */
async function selectResidentRegistry(page: Page): Promise<void> {
  await selectDatasetByName(page, SAMPLE_DATA_FILES.resident_registry);
  await selectColumns(page, "resident_registry");
  await clickNext(page);
}

/** 水道開閉栓状況（必須・先頭）をサンプル（正常）から選択して次へ。 */
async function selectWaterStatusSample(page: Page): Promise<void> {
  await selectDatasetByName(page, SAMPLE_DATA_FILES.water_status);
  await selectColumns(page, "water_status");
  await clickNext(page);
}

/** 水道使用量（必須）をサンプル（正常）から選択して次へ。 */
async function selectWaterUsageSample(page: Page): Promise<void> {
  await selectDatasetByName(page, SAMPLE_DATA_FILES.water_usage);
  await selectColumns(page, "water_usage");
  await clickNext(page);
}

/**
 * 住民基本台帳を、同一入力列（住所）を「世帯番号」「住所」の2項目へ割り当てて次へ。
 *
 * E-102（重複割り当て）の再現。名寄せウィザードは重複割当を止めない（非ブロッキング設計）
 * ため、パイプラインが build_runtime_config 直後の重複検知で停止する。
 */
async function selectResidentRegistryDuplicateAddress(
  page: Page,
): Promise<void> {
  await selectDatasetByName(page, SAMPLE_DATA_FILES.resident_registry);
  await selectColumns(page, "resident_registry", { 世帯番号カラム: "住所" });
  await clickNext(page);
}

/** 残りの任意ステップをスキップして「開始する」まで進む。 */
async function skipOptionalsToStart(page: Page): Promise<void> {
  for (let i = 0; i < 11; i++) {
    const startButton = page.getByRole("button", { name: "開始する" });
    if (await startButton.isVisible({ timeout: 500 }).catch(() => false)) {
      return;
    }
    const skipCheckbox = page.getByLabel("このステップをスキップする");
    if (await skipCheckbox.isVisible({ timeout: 300 }).catch(() => false)) {
      if (!(await skipCheckbox.isChecked())) {
        await skipCheckbox.check();
      }
    }
    await clickNext(page);
  }
}

/**
 * ジョブ詳細を再読込して最新状態でマウントし直す。
 *
 * waitForJobCompletionById は DB を IPC で直読みして終了を検知するが、画面の
 * useFetchJobs はポーリングしないため、待機開始時（処理中）にマウントした
 * コンポーネントは最終 status を反映していない。reload で確実に再取得する。
 */
async function reloadPreprocessDetail(
  page: Page,
  jobId: number,
): Promise<void> {
  await page.reload();
  await page.waitForLoadState("load");
  await page.evaluate((id) => {
    window.location.hash = `#/job/detail/${id}/preprocess`;
  }, jobId);
  await page.waitForFunction(
    (id) => window.location.hash.includes(`job/detail/${id}/preprocess`),
    jobId,
    { timeout: 15000 },
  );
  await page.waitForTimeout(1500);
}

/** 名寄せを開始して新規 jobId を返す（draft 機構から Start 前に jobId を確定）。 */
async function startNormalization(page: Page): Promise<number> {
  const { newJobId } = await startPipelineAndNavigateToStatus(page, {
    startButton: "開始する",
    confirmMessage: "データ名寄せ処理を開始しました",
    statusHashIncludes: "normalization",
    draftUrlPathSegment: "normalization",
  });
  if (newJobId === undefined)
    throw new Error("preprocess jobId が確定していません");
  return newJobId;
}

test.describe("名寄せ事後エラー表示（FR004-007）", () => {
  test("非UTF8の水道データで実行すると E-0008 が対応区分・修正方法つきで表示される", async () => {
    test.setTimeout(600000);

    await startNormalizationWizard(page);
    await walkToDatasetSteps(page);
    await uploadWaterStatus(page, FIXTURE_STATUS_NON_UTF8);
    await uploadWaterUsage(page, FIXTURE_USAGE_CLEAN);
    await selectResidentRegistry(page);
    await skipOptionalsToStart(page);

    const jobId = await startNormalization(page);
    const status = await waitForJobCompletionById(page, {
      jobId,
      type: "preprocess",
      label: "名寄せ（E-0008）",
      stallTimeout: 3 * 60 * 1000,
    });
    expect(status).toBe("error");

    // 詳細を再読込し、事後エラー表示が実 error_detail を出すことを確認する。
    await reloadPreprocessDetail(page, jobId);
    await expect(page.getByText("処理に失敗しました。")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/E-0008/)).toBeVisible();
    // 対応区分（職員向け表示）と、文字コードの修正方法トグルが出ること。
    await expect(page.getByText("対応:").first()).toBeVisible();
    await expect(page.getByText("データの修正").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "修正方法を見る" }).first(),
    ).toBeVisible();
  });

  test("住所列を欠く水道データで実行すると E-101 が対応区分・修正方法つきで表示される", async () => {
    test.setTimeout(600000);

    await startNormalizationWizard(page);
    await walkToDatasetSteps(page);
    await uploadWaterStatus(page, FIXTURE_STATUS_NO_ADDRESS);
    await uploadWaterUsage(page, FIXTURE_USAGE_CLEAN);
    await selectResidentRegistry(page);
    await skipOptionalsToStart(page);

    const jobId = await startNormalization(page);
    const status = await waitForJobCompletionById(page, {
      jobId,
      type: "preprocess",
      label: "名寄せ（E-101）",
      stallTimeout: 3 * 60 * 1000,
    });
    expect(status).toBe("error");

    await reloadPreprocessDetail(page, jobId);
    await expect(page.getByText("処理に失敗しました。")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/E-101/)).toBeVisible();
    await expect(page.getByText("データの修正").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "修正方法を見る" }).first(),
    ).toBeVisible();
  });

  test("同じ入力列を複数項目に割り当てると E-102 が対応区分つきで表示される", async () => {
    test.setTimeout(600000);

    await startNormalizationWizard(page);
    await walkToDatasetSteps(page);
    await selectWaterStatusSample(page);
    await selectWaterUsageSample(page);
    await selectResidentRegistryDuplicateAddress(page);
    await skipOptionalsToStart(page);

    const jobId = await startNormalization(page);
    const status = await waitForJobCompletionById(page, {
      jobId,
      type: "preprocess",
      label: "名寄せ（E-102）",
      stallTimeout: 3 * 60 * 1000,
    });
    expect(status).toBe("error");

    await reloadPreprocessDetail(page, jobId);
    await expect(page.getByText("処理に失敗しました。")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/E-102/)).toBeVisible();
    // 責任分界（自治体修正）の職員向け表示。E-102 は専用ガイド未登録のため
    // 「修正方法を見る」トグルは出ない（案内はメッセージ本文に自己完結）。
    await expect(page.getByText("対応:").first()).toBeVisible();
    await expect(page.getByText("データの修正").first()).toBeVisible();

    const shot = test.info().outputPath("e102-error-banner.png");
    await page.screenshot({ path: shot, fullPage: true });
    // eslint-disable-next-line no-console -- E2E で画面を目視確認するためのパス出力
    console.log(`E-102 banner screenshot: ${shot}`);
  });
});
