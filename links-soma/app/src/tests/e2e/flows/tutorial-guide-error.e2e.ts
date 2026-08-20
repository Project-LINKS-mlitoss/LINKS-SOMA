/**
 * ガイド エラー時コーチング E2E（MU2 / #1908・実処理エラーをUIまで貫通）
 *
 * 壊れた入力（住所列を欠く水道開閉栓状況）で名寄せを実行して status="error" の
 * preprocess ジョブを UI 操作で作り、そのジョブをガイドの現工程（名寄せ draft）に紐づける。
 * 進行カードのコーチングが「確認して終わり」でなく「再実行して継続できる」案内に
 * なっていること（normError）を end-to-end で検証する。
 *
 * エラー生成手順は normalization-error-display.e2e.ts の E-101 経路を踏襲する。
 * 水道データは表示名選択でなくパス指定アップロードで投入する（壊れフィクスチャ名との
 * 部分一致で別データを掴む事故を避けるため）。
 *
 * 実行方法: cd app && npm run e2e -- tutorial-guide-error
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
const FIXTURE_STATUS_NO_ADDRESS = path.join(
  FIXTURES_DIR,
  "err_status_noaddr.csv",
);
const FIXTURE_USAGE_CLEAN = path.join(FIXTURES_DIR, "err_usage_clean.csv");

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });

/** ガイド進行状態を SQLite (tutorial_state) に直接書き込む（draft 参照も含む）。 */
const setGuideState = (p: Page, draftJobId: number | null): Promise<unknown> =>
  p.evaluate(
    (id) =>
      window.ipcRenderer.invoke("updateTutorialState", {
        phase: "running",
        stage: "normalization",
        modelMode: "build",
        draftJobId: id,
        modelJobId: null,
        evaluationJobId: null,
        resumeState: null,
      }),
    draftJobId,
  );

/** データセット選択ダイアログから指定パスの CSV をアップロードして選択する。 */
async function uploadCustomDataset(p: Page, filePath: string): Promise<void> {
  await p.getByText("データセットを選択").click();
  await p.waitForSelector('[role="dialog"]');
  await p.getByRole("tab", { name: "新規アップロード" }).click();
  await p.waitForTimeout(300);
  await p.locator('[role="dialog"] input[type="file"]').setInputFiles(filePath);
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: "選択" }).last().click();
  await p.waitForSelector('[role="dialog"]', { state: "hidden" });
}

/** イントロ → 基本設定（基準日・市区町村名）を済ませてデータセットステップ先頭に着く。 */
async function walkToDatasetSteps(p: Page): Promise<void> {
  await clickNext(p); // イントロ → 基本設定
  await p.locator('input[type="date"]').fill("2024-01-01");
  await p.getByPlaceholder("市区町村名を入力").fill("テスト市");
  await clickNext(p);
}

/** 残りの任意ステップをスキップして「開始する」まで進む。 */
async function skipOptionalsToStart(p: Page): Promise<void> {
  for (let i = 0; i < 11; i++) {
    const startButton = p.getByRole("button", { name: "開始する" });
    if (await startButton.isVisible({ timeout: 500 }).catch(() => false)) {
      return;
    }
    const skipCheckbox = p.getByLabel("このステップをスキップする");
    if (await skipCheckbox.isVisible({ timeout: 300 }).catch(() => false)) {
      if (!(await skipCheckbox.isChecked())) {
        await skipCheckbox.check();
      }
    }
    await clickNext(p);
  }
}

/** 名寄せを開始して新規 jobId を返す（draft 機構から Start 前に jobId を確定）。 */
async function startNormalization(p: Page): Promise<number> {
  const { newJobId } = await startPipelineAndNavigateToStatus(p, {
    startButton: "開始する",
    confirmMessage: "データ名寄せ処理を開始しました",
    statusHashIncludes: "normalization",
    draftUrlPathSegment: "normalization",
  });
  if (newJobId === undefined)
    throw new Error("preprocess jobId が確定していません");
  return newJobId;
}

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
  // 前セッションが残した tutorial_state（進行中ガイド・下書き参照）を除去して「未開始」から始める。
  // 残留があると startNormalizationWizard の intro 遷移が変わり、intro 確認で落ちるため。
  await page.evaluate(() =>
    window.ipcRenderer.invoke("updateTutorialState", {
      phase: "idle",
      stage: null,
      modelMode: "build",
      draftJobId: null,
      modelJobId: null,
      evaluationJobId: null,
      resumeState: null,
    }),
  );
  await page.reload();
  await page.waitForLoadState("load");
  await page.waitForSelector("#root > *", { timeout: 60000 });
});

test.afterAll(async () => {
  // 次テストの残留を避けて未開始へ戻す。
  await page
    .evaluate(() =>
      window.ipcRenderer.invoke("updateTutorialState", {
        phase: "idle",
        stage: null,
        modelMode: "build",
        draftJobId: null,
        modelJobId: null,
        evaluationJobId: null,
        resumeState: null,
      }),
    )
    .catch(() => undefined);
  await electronApp.close();
});

test.describe("ガイド エラー時コーチング（MU2）", () => {
  test("名寄せがエラーのとき、進行カードが再実行して継続できる案内を出す", async () => {
    test.setTimeout(600000);

    // 1) 住所列を欠く水道データ（E-101）で名寄せを実行し、error ジョブを UI から作る。
    await startNormalizationWizard(page);
    await walkToDatasetSteps(page);
    await uploadCustomDataset(page, FIXTURE_STATUS_NO_ADDRESS);
    await selectColumns(page, "water_status");
    await clickNext(page);
    await uploadCustomDataset(page, FIXTURE_USAGE_CLEAN);
    await selectColumns(page, "water_usage");
    await clickNext(page);
    await selectDatasetByName(page, SAMPLE_DATA_FILES.resident_registry);
    await selectColumns(page, "resident_registry");
    await clickNext(page);
    await skipOptionalsToStart(page);

    const jobId = await startNormalization(page);
    const status = await waitForJobCompletionById(page, {
      jobId,
      type: "preprocess",
      label: "名寄せ（E-101・ガイドMU2）",
      stallTimeout: 3 * 60 * 1000,
    });
    expect(status).toBe("error");

    // 2) その error ジョブをガイドの現工程（名寄せ draft）に紐づけてリロード。
    await setGuideState(page, jobId);
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForSelector("#root > *", { timeout: 60000 });

    // 3) 進行カードを開き、コーチングが「再実行して継続できる」案内であることを検証。
    await page
      .getByRole("button", { name: /ガイド進行中/ })
      .click({ timeout: 15000 });
    const popover = page
      .getByRole("button", { name: /ガイド進行中/ })
      .locator("..");
    // エラー状態のバッジと、行き止まりでなく再実行を促す本文（normError）。
    await expect(popover.getByText(/再実行へ/)).toBeVisible({ timeout: 15000 });
    await expect(popover.getByText(/もう一度実行/)).toBeVisible();
    // ジョブ詳細（＝再実行導線がある画面）へ誘導する主アクション。
    await expect(
      popover.getByRole("button", { name: "エラーを確認する" }),
    ).toBeVisible();
  });
});
