/**
 * ガイド 配線（intent ナビゲーション / phase 遷移）E2E（#1908 フォローアップ）
 *
 * コーチングの純粋ロジック（文言・intent 導出）と store のライフサイクル遷移は
 * ユニットで網羅済み。本テストは残る「UI 操作 → runIntent / store メソッド」の配線を
 * 状態注入だけで（実パイプライン不要で）end-to-end に担保する:
 *
 * - openEntry: 工程外で「この工程を開く」→ その工程の入口ルートへ遷移
 * - pause:     進行カード「中断」→ phase=paused（進行情報は保持）
 * - reset:     「終了」→ 確認ダイアログ「終了する」→ phase=idle（入口ボタンが戻る）
 *
 * 実行方法: cd app && npm run e2e -- tutorial-guide-navigation
 * 前提: 開発サーバー起動済み（実ジョブ不要）。
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });
test.setTimeout(60000);

/** ガイド進行状態を SQLite (tutorial_state) に直接注入する（実ジョブ参照は持たせない）。 */
const setTutorialState = (
  p: Page,
  state: {
    phase: "idle" | "running" | "paused" | "done";
    stage: "normalization" | "model" | "evaluation" | "analysis" | null;
    modelMode?: "build" | "generic";
  },
): Promise<unknown> =>
  p.evaluate(
    (s) =>
      window.ipcRenderer.invoke("updateTutorialState", {
        phase: s.phase,
        stage: s.stage,
        modelMode: s.modelMode ?? "build",
        draftJobId: null,
        modelJobId: null,
        evaluationJobId: null,
        resumeState: null,
      }),
    state,
  );

/** tutorial_state の phase を読み出す（store 遷移の永続結果を確認する）。 */
const readPhase = (p: Page): Promise<string | null> =>
  p.evaluate(async () => {
    const row = (await window.ipcRenderer.invoke("selectTutorialState")) as {
      phase: string | null;
    } | null;
    return row?.phase ?? null;
  });

/** 状態注入をリロードで反映し、進行カードのトグルを開く。 */
async function injectAndOpenPopover(
  p: Page,
  state: Parameters<typeof setTutorialState>[1],
): Promise<void> {
  await setTutorialState(p, state);
  await p.reload();
  await p.waitForLoadState("load");
  await p.waitForSelector("#root > *", { timeout: 60000 });
  await p
    .getByRole("button", { name: /ガイド進行中/ })
    .click({ timeout: 15000 });
}

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
  await setTutorialState(page, { phase: "idle", stage: null });
  await page.reload();
  await page.waitForLoadState("load");
  await page.waitForSelector("#root > *", { timeout: 60000 });
});

test.afterAll(async () => {
  await setTutorialState(page, { phase: "idle", stage: null }).catch(
    () => undefined,
  );
  await electronApp.close();
});

test.describe("ガイド 配線（intent ナビゲーション / phase 遷移）", () => {
  test("openEntry: 工程外の「この工程を開く」でその工程の入口へ遷移する", async () => {
    // モデル工程・ジョブ無し・モデル画面外 → コーチングは総括＋入口導線（openEntry）。
    await injectAndOpenPopover(page, {
      phase: "running",
      stage: "model",
      modelMode: "build",
    });
    await page
      .getByRole("button", { name: "この工程を開く" })
      .click({ timeout: 15000 });
    await page.waitForFunction(
      () => window.location.hash.includes("model/create"),
      undefined,
      { timeout: 15000 },
    );
    expect(page.url()).toContain("model/create");
  });

  test("pause: 進行カード「中断」で phase=paused になり進行情報は保持される", async () => {
    await injectAndOpenPopover(page, {
      phase: "running",
      stage: "normalization",
      modelMode: "build",
    });
    await page.getByRole("button", { name: "中断" }).click({ timeout: 15000 });
    await expect.poll(() => readPhase(page), { timeout: 15000 }).toBe("paused");
  });

  test("reset: 「終了」→ 確認ダイアログ「終了する」で phase=idle に戻り入口ボタンが復帰する", async () => {
    await injectAndOpenPopover(page, {
      phase: "running",
      stage: "normalization",
      modelMode: "build",
    });
    await page.getByRole("button", { name: "終了" }).click({ timeout: 15000 });
    await page
      .getByRole("button", { name: "終了する" })
      .click({ timeout: 15000 });
    await expect.poll(() => readPhase(page), { timeout: 15000 }).toBe("idle");
    await expect(
      page.getByRole("button", { name: "ガイド", exact: true }),
    ).toBeVisible({ timeout: 15000 });
  });
});
