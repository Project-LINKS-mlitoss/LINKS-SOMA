/**
 * ガイド 再実行後トレース E2E（#1908 フォローアップ / 名寄せ）
 *
 * クライアント指摘: 「再実行で対応した後もガイドの中身が変わらない。再実行を促し、
 * 再実行後の処理をトレースできるようにしてほしい」。
 *
 * 既存の tutorial-guide-error.e2e.ts は「エラー時に再実行案内が出る」までを検証するが、
 * 再実行した後にガイドが新しいジョブを追従するかは検証していない。本テストはその隙間を埋める。
 *
 * 再現する不具合（名寄せ工程）:
 *   名寄せの「再実行へ」は status="error" のジョブから作成画面を開くが、error は下書きでない
 *   ため initialJobId=undefined となり、execE001 が新しいジョブを作る。しかし tutorial_state の
 *   draft_job_id は古い error ジョブを指したまま更新されない（wizard-container の setDraftJobId は
 *   jobId!=null ガードで発火しない）。結果、ガイドは古い error を読み続け、再実行後の処理を
 *   トレースできない。
 *
 * 検証方針（状態ベース最小再現）:
 *   error ジョブ作成 → ガイド紐付け → 「エラーを確認する」→「再実行へ」→「開始する」で新ジョブを作り、
 *   tutorial_state.draft_job_id が新ジョブを指すこと（＝再実行をトレースできること）を期待する。
 *   現行コードでは draft_job_id が古い error ジョブのままなので、本アサートは失敗する（＝不具合の再現）。
 *   修正後はガイドが新ジョブに追従して成功する。
 *
 * エラー生成手順は tutorial-guide-error.e2e.ts（E-101 経路）を踏襲する。
 *
 * 実行方法: cd app && npm run e2e -- tutorial-guide-rerun-trace
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

/** tutorial_state を読み出し draft_job_id を返す（ガイドが今どのジョブを追跡しているか）。 */
const readGuideDraftJobId = (p: Page): Promise<number | null> =>
  p.evaluate(async () => {
    const row = (await window.ipcRenderer.invoke("selectTutorialState")) as {
      draft_job_id: number | null;
    } | null;
    return row?.draft_job_id ?? null;
  });

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

/** 名寄せ（下書きフロー）を開始して新規 jobId を返す（draft 機構から Start 前に jobId を確定）。 */
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

/**
 * 名寄せの「再実行」を開始して新規 jobId を返す。
 *
 * 再実行は下書きでなく error ジョブからの新規実行のため execE001 が新しいジョブを INSERT する
 * （URL には古い error jobId が残るので draftUrlPathSegment は使えない）。Start 前後の
 * preprocess ジョブ集合の差分で、実際に作られた新ジョブ id を確定する。
 */
async function startRerunNormalization(p: Page): Promise<number> {
  const { newJobId } = await startPipelineAndNavigateToStatus(p, {
    startButton: "開始する",
    confirmMessage: "データ名寄せ処理を開始しました",
    statusHashIncludes: "normalization",
    trackJobType: "preprocess",
    trackLabel: "名寄せ再実行",
  });
  if (newJobId === undefined)
    throw new Error("再実行 preprocess jobId が確定していません");
  return newJobId;
}

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
  // 前セッションが残した tutorial_state を除去して「未開始」から始める。
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

test.describe("ガイド 再実行後トレース（#1908 フォローアップ）", () => {
  test("名寄せの再実行後、ガイドは新しいジョブを追従する（再実行をトレースできる）", async () => {
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

    const errorJobId = await startNormalization(page);
    const status = await waitForJobCompletionById(page, {
      jobId: errorJobId,
      type: "preprocess",
      label: "名寄せ（E-101・再実行トレース）",
      stallTimeout: 3 * 60 * 1000,
    });
    expect(status).toBe("error");

    // 2) その error ジョブをガイドの現工程（名寄せ draft）に紐づけてリロード。
    await setGuideState(page, errorJobId);
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForSelector("#root > *", { timeout: 60000 });

    // 前提確認: この時点でガイドは error ジョブを追跡している。
    expect(await readGuideDraftJobId(page)).toBe(errorJobId);

    // 3) 進行カードの「エラーを確認する」→ ジョブ詳細（再実行導線がある画面）へ。
    await page
      .getByRole("button", { name: /ガイド進行中/ })
      .click({ timeout: 15000 });
    await page
      .getByRole("button", { name: "エラーを確認する" })
      .click({ timeout: 15000 });

    // 4) ジョブ詳細の「再実行へ」→ 名寄せ作成画面（確認ステップ、?step=confirm）へ。
    //    確認ステップに着地するので「開始する」ボタンの出現を待つ。
    await page
      .getByRole("button", { name: "再実行へ" })
      .click({ timeout: 15000 });
    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible({
      timeout: 15000,
    });

    // 5) 「開始する」で再実行 → 新しいジョブが作られる。
    const rerunJobId = await startRerunNormalization(page);

    // 再実行は新ジョブを作る（下書きでないため同一 id 更新でなく新規作成）。
    expect(rerunJobId).not.toBe(errorJobId);

    // 6) 期待: ガイドは再実行後の新ジョブを追従する（＝再実行後の処理をトレースできる）。
    //    現行コードでは draft_job_id が古い errorJobId のままなので、ここで失敗する（＝不具合の再現）。
    const trackedJobId = await readGuideDraftJobId(page);
    expect(
      trackedJobId,
      "再実行後、ガイドは新ジョブ(rerunJobId)を追従すべきだが、古いerrorJobIdのままになっている",
    ).toBe(rerunJobId);
  });
});
