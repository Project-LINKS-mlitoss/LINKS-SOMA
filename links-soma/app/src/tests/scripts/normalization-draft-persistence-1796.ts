/**
 * 【操作スクリプト】issue #1796 名寄せウィザード下書き永続化の再現観測
 *
 * 報告パターン2「下書き途中で別画面にサイドバーから直接移動して復帰」を再現し、
 * 各遷移ポイントで DB (jobs テーブル) の draft 行を IPC 経由で観測する。
 *
 * 観測ポイント:
 *   A. intro → 次へ 直後（下書き作成直後）
 *   B. step1 入力後（form.subscribe 自動保存期待）
 *   C. サイドバー離脱直後
 *   D. 名寄せ画面に復帰後（useFetchDraftJob 再取得）
 *
 * 実行方法:
 *   cd app && npm run script -- normalization-draft-persistence-1796
 *
 * 前提: dev server が起動済み (`npm run dev`)
 */

import { test, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import { navigateTo } from "../helpers/navigation-helper";
import {
  startNormalizationWizard,
  clickNext,
} from "../helpers/wizard-operations";

let page: Page;

test.describe.configure({ mode: "serial" });
test.setTimeout(120000);

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

// NOTE: afterAll 省略 — 完了後もアプリを開いたまま手動確認できるように

/**
 * renderer 側で selectDraftJob IPC を呼び、現在の draft 状態を取得
 */
async function snapshotDraft(
  page: Page,
  label: string,
): Promise<Record<string, unknown> | null> {
  const job = await page.evaluate(async () => {
    return (
      window as unknown as {
        ipcRenderer: { invoke: (channel: string) => Promise<unknown> };
      }
    ).ipcRenderer.invoke("selectDraftJob");
  });

  const summary = job
    ? {
        id: (job as { id: number }).id,
        status: (job as { status: string }).status,
        parameters: (job as { parameters: unknown }).parameters,
      }
    : null;

  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`\n[SNAPSHOT ${label}] ${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}

/**
 * 既存 draft を掃除
 */
async function cleanDraft(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const ipc = (
      window as unknown as {
        ipcRenderer: {
          invoke: (ch: string, args?: unknown) => Promise<unknown>;
        };
      }
    ).ipcRenderer;
    const existing = (await ipc.invoke("selectDraftJob")) as {
      id: number;
    } | null;
    if (existing) {
      await ipc.invoke("deleteJob", { id: existing.id });
    }
  });
}

/**
 * intro→step1 に到達するまで
 */
async function enterStep1(page: Page): Promise<void> {
  await startNormalizationWizard(page);
  await clickNext(page);
  await page.locator('input[type="date"]').waitFor({ state: "visible" });
}

/**
 * step1 入力後、指定した待機時間でサイドバー離脱→復帰してスナップショット列を取る
 */
async function runScenario(
  page: Page,
  scenarioName: string,
  inputWaitMs: number,
  municipality: string,
): Promise<void> {
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(
    `\n────── シナリオ: ${scenarioName} (wait=${inputWaitMs}ms) ──────`,
  );

  await cleanDraft(page);
  await enterStep1(page);

  const snapA = await snapshotDraft(page, `${scenarioName} A: intro→次へ直後`);

  await page.locator('input[type="date"]').fill("2024-01-01");
  await page.getByPlaceholder("市区町村名を入力").fill(municipality);

  if (inputWaitMs > 0) {
    await page.waitForTimeout(inputWaitMs);
  }

  const snapB = await snapshotDraft(
    page,
    `${scenarioName} B: 入力後 wait=${inputWaitMs}ms`,
  );

  await navigateTo(page, "#job");
  const snapC = await snapshotDraft(
    page,
    `${scenarioName} C: サイドバー離脱直後`,
  );

  await navigateTo(page, "#normalization");
  await page.waitForTimeout(800);
  const snapD = await snapshotDraft(page, `${scenarioName} D: 復帰後`);

  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`\n=== ${scenarioName} 観測サマリ ===`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`A: municipality=${extractMunicipality(snapA)}`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`B: municipality=${extractMunicipality(snapB)}`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`C: municipality=${extractMunicipality(snapC)}`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`D: municipality=${extractMunicipality(snapD)}`);
}

test("#1796 パターン2: 待機時間を変えて競合を観測", async () => {
  // 競合観測: 待機時間を段階的に短くして form.subscribe の保存完了前離脱を試す
  await runScenario(page, "S1-wait1500ms", 1500, "テスト市S1");
  await runScenario(page, "S2-wait200ms", 200, "テスト市S2");
  await runScenario(page, "S3-wait50ms", 50, "テスト市S3");
  await runScenario(page, "S4-wait0ms", 0, "テスト市S4");

  // eslint-disable-next-line no-console -- 観測ログ
  console.log("\n📌 パターン2 観測完了");
});

/**
 * 「名寄せ処理を始める」クリック直後の UI/URL 状態を観測
 */
async function observeStartClick(page: Page, label: string): Promise<void> {
  const beforeHash = await page.evaluate(() => window.location.hash);

  // 始めるボタンを押す
  await page.getByRole("button", { name: /名寄せ処理を始める/i }).click();
  // 短時間待機 (dialog 出現 or navigate 発火のどちらかを観測)
  await page.waitForTimeout(1500);

  const afterHash = await page.evaluate(() => window.location.hash);
  const dialogVisible = await page
    .getByRole("heading", { name: "下書きがあります" })
    .isVisible()
    .catch(() => false);

  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`\n[CLICK OBSERVE ${label}]`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`  before hash: ${beforeHash}`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`  after hash:  ${afterHash}`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`  dialog visible: ${dialogVisible}`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`  expected: dialog=true (DB has draft)`);
}

/**
 * 復帰後の処理一覧テーブルに draft 行が出ているかを観測
 */
async function observeTableHasDraft(
  page: Page,
  label: string,
): Promise<boolean> {
  // テーブル内から「下書き」テキスト or draft id を含む行を検索
  // TableRowJobs のレンダリング詳細に依存しないよう、status バッジテキストを探す
  const draftRow = page.locator("table tbody tr", { hasText: "下書き" });
  const count = await draftRow.count().catch(() => 0);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`[TABLE OBSERVE ${label}] draft rows visible: ${count}`);
  return count > 0;
}

/**
 * 待機時間を変えながら「復帰→「始める」クリック」の UI 反応を観測
 */
async function runReturnDelayScenario(
  page: Page,
  delayMs: number,
): Promise<void> {
  const label = `delay${delayMs}ms`;
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`\n────── 復帰待機 ${delayMs}ms シナリオ ──────`);

  await cleanDraft(page);
  await enterStep1(page);
  await page.locator('input[type="date"]').fill("2024-01-01");
  await page.getByPlaceholder("市区町村名を入力").fill(`持続${delayMs}`);
  await page.waitForTimeout(800);
  await snapshotDraft(page, `${label} 準備: draft DB`);

  // 離脱
  await navigateTo(page, "#job");
  await page.waitForTimeout(300);

  // 復帰
  await navigateTo(page, "#normalization");

  // 指定時間待機 (SWR dedupingInterval 境界の検証)
  if (delayMs > 0) {
    await page.waitForTimeout(delayMs);
  }

  // テーブルに draft が出ているか
  await observeTableHasDraft(page, label);

  // 「始める」クリック → ダイアログ可視性
  await observeStartClick(page, label);
}

/**
 * パターン1: dedupingInterval 境界での UI 振る舞いを観測
 * dev=5000ms / prod=10000ms。3 段階の遅延でダイアログ/テーブル可視性を測る
 *
 * NOTE: 確認目的達成後 skip。シナリオ間で dialog 残留が起きて以降のテストを
 * 巻き込むため、手動で再確認したいときだけ有効化する
 */
test.skip("#1796 dedupingInterval 境界の UI 観測", async () => {
  await runReturnDelayScenario(page, 0);
  await runReturnDelayScenario(page, 3000); // dev: 内側 / prod: 内側
  await runReturnDelayScenario(page, 7000); // dev: 外側 / prod: 内側 ★ 仮説境界
  await runReturnDelayScenario(page, 12000); // dev: 外側 / prod: 外側
});

/**
 * H2 検証: useFetchJob (useSWRImmutable) で form 値が復帰時に stale cache になるか
 * wizard で入力 → サイドバー離脱 → 続ける経由で復帰 → step1 の input 値を読み取る
 */
test("#1796 H2: useFetchJob stale cache 検証", async () => {
  await cleanDraft(page);

  // intro → 次へ で draft 作成
  await startNormalizationWizard(page);
  await clickNext(page);
  await page.locator('input[type="date"]').waitFor({ state: "visible" });

  // URL から jobId を取得
  const urlAfterCreate = page.url();
  const match = urlAfterCreate.match(/create\/(\d+)/);
  if (!match) throw new Error(`jobId を URL から取得できず: ${urlAfterCreate}`);
  const jobId = match[1];
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`[H2] draft jobId=${jobId}`);

  // step1 入力
  const testDate = "2024-06-15";
  const testMunicipality = "H2検証市";
  await page.locator('input[type="date"]').fill(testDate);
  await page.getByPlaceholder("市区町村名を入力").fill(testMunicipality);
  await page.waitForTimeout(1000);

  // DB 状態
  const dbBefore = await snapshotDraft(page, "H2-1: 入力直後 DB");
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`[H2-1] DB municipality: ${extractMunicipality(dbBefore)}`);

  // サイドバーで離脱 (wizard unmount)
  await navigateTo(page, "#job");
  await page.waitForTimeout(500);

  // /create/:id?step=1 に直接 navigate してウィザードを再 mount
  // (続ける経路は confirm step に飛ぶため step1 の input 要素が見えない)
  await page.evaluate((jid) => {
    window.location.hash = `#/normalization/create/${jid}?step=1`;
  }, jobId);
  await page.waitForTimeout(2000);

  // step1 input 要素が出るのを待つ
  await page
    .locator('input[type="date"]')
    .waitFor({ state: "visible", timeout: 10000 });

  // form 入力欄の値を読み取る
  const formDate = await page.locator('input[type="date"]').inputValue();
  const formMunicipality = await page
    .getByPlaceholder("市区町村名を入力")
    .inputValue();

  // DB 状態 (復帰後)
  const dbAfter = await snapshotDraft(page, "H2-2: 復帰後 DB");

  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`\n[H2 結果]`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`  期待値: date=${testDate} municipality=${testMunicipality}`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`  form:   date=${formDate} municipality=${formMunicipality}`);
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`  DB:     municipality=${extractMunicipality(dbAfter)}`);

  const formMatch =
    formDate === testDate && formMunicipality === testMunicipality;
  const dbMatch = extractMunicipality(dbAfter) === testMunicipality;
  // eslint-disable-next-line no-console -- 観測ログ
  console.log(`  form=DB 一致: form=${formMatch} db=${dbMatch}`);

  if (!formMatch && dbMatch) {
    // eslint-disable-next-line no-console -- 観測ログ
    console.log(
      `  ⚠ H2 再現: form 値が空/古い。DB には最新値あり (stale cache)`,
    );
  } else if (formMatch && dbMatch) {
    // eslint-disable-next-line no-console -- 観測ログ
    console.log(`  ✓ H2 否定: form 値と DB が一致、stale cache 無し`);
  } else if (!dbMatch) {
    // eslint-disable-next-line no-console -- 観測ログ
    console.log(`  ⚠ 別の問題: DB に値が届いていない`);
  }
});

function extractMunicipality(snap: Record<string, unknown> | null): string {
  if (!snap) return "(draft なし)";
  const params = snap.parameters as
    | { settings?: { municipality?: string } }
    | undefined;
  return params?.settings?.municipality ?? "(未設定)";
}
