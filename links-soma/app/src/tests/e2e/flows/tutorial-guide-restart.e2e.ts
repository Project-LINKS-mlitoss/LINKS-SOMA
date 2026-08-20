/**
 * ガイド 再スタート時のコーチング同期 E2E（回帰 / #1908）
 *
 * 名寄せ作成画面に既にいる状態でガイドを起動すると、begin() が resumeState を
 * null 化した直後にウィザードが再マウントされず（同一ルート遷移）、ステップ同期
 * effect が再発火しない窓が開き、進行カードが intro でなくフォールバック文言
 * （normInWizard「入力を進め、確認画面で…」）を出す不具合があった。
 * 「作成画面から起動 → 進行カードが intro コーチングを出す（フォールバックでない）」
 * を end-to-end で担保する。修正は resume 同期 effect を phase/stage 変化にも
 * 反応させたこと（wizard-container.tsx）。
 *
 * 実行方法: cd app && npm run e2e -- tutorial-guide-restart
 * 前提: 開発サーバー起動済み。
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import { startNormalizationWizard } from "../../helpers/wizard-operations";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });
test.setTimeout(60000);

/** ガイド進行状態を SQLite (tutorial_state) に直接書き込む。 */
const setTutorialState = (
  p: Page,
  state: {
    phase: "idle" | "running" | "paused" | "done";
    stage: "normalization" | "model" | "evaluation" | "analysis" | null;
  },
): Promise<unknown> =>
  p.evaluate(
    (s) =>
      window.ipcRenderer.invoke("updateTutorialState", {
        phase: s.phase,
        stage: s.stage,
        modelMode: "generic",
        draftJobId: null,
        modelJobId: null,
        evaluationJobId: null,
        resumeState: null,
      }),
    state,
  );

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
  await setTutorialState(page, { phase: "idle", stage: null });
  await page.reload();
  await page.waitForLoadState("load");
  await page.waitForSelector("#root > *", { timeout: 60000 });
});

test.afterAll(async () => {
  await setTutorialState(page, { phase: "idle", stage: null });
  await electronApp.close();
});

test.describe("ガイド 再スタート時のコーチング同期（回帰）", () => {
  test("作成画面からガイドを起動しても進行カードが intro コーチングを出す", async () => {
    // 1) ガイド無しで名寄せ作成画面（intro）まで到達。ウィザードを先にマウントさせておく。
    await startNormalizationWizard(page);

    // 2) その画面のまま右上「ガイド」で起動（既定は汎用モデル＝3工程）。
    //    begin() → 同一ルート（normalization/create）へ navigate するため再マウントされず、
    //    修正前は resume 同期 effect が再発火せず resumeState が null のままだった。
    await page.getByRole("button", { name: "ガイド", exact: true }).click();
    await expect(page.getByText("ガイドを始めますか？")).toBeVisible();
    await page.getByRole("button", { name: "始める" }).click();

    // 3) 進行カード（begin で自動展開）を開き、コーチングを検証。
    const popover = page
      .getByRole("button", { name: /ガイド進行中/ })
      .locator("..");

    // 核心: intro コーチングが出ること（汎用モデルなので generic 版 intro）。
    await expect(
      popover.getByText(
        "名寄せ処理の目的と、用意するデータを確認し、「次へ」で進んでください。",
      ),
    ).toBeVisible({ timeout: 15000 });
    // 回帰の指標: 種別欠落時のフォールバック文言が出ていないこと。
    await expect(
      popover.getByText("入力を進め、確認画面で「開始する」を押してください。"),
    ).toHaveCount(0);
  });
});
