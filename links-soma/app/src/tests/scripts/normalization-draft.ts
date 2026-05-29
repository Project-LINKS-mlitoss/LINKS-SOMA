/**
 * 【操作スクリプト】名寄せウィザード下書き作成
 *
 * Playwrightを自動操作ツールとして使い、手動確認用の下書きデータを作成する
 * ※ リグレッションテストではなく、デバッグ・動作確認用のスクリプト
 *
 * すべてのデータセットが入力された下書きを作成する
 * 完了後もアプリは開いたまま（手動確認用）
 *
 * 実行方法:
 * cd app && npm run script -- normalization-draft
 */

import { test, expect, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import {
  startNormalizationWizard,
  walkWizard,
} from "../helpers/wizard-operations";

let page: Page;

test.describe.configure({ mode: "serial" });
test.setTimeout(120000);

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

// NOTE: flowは完了後もアプリを開いたままにする（手動確認用）
// test.afterAll は意図的に省略

test("名寄せ下書きを作成（全データセット入力済み）", async () => {
  // 名寄せ画面に遷移 → 下書きダイアログ処理 → イントロ画面到達
  await startNormalizationWizard(page);

  await walkWizard(page);

  // 確認画面に到達
  await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

  // eslint-disable-next-line no-console -- E2Eテストの進捗表示
  console.log("✅ 下書き作成完了: 全データセット入力済み");
  // eslint-disable-next-line no-console -- E2Eテストの進捗表示
  console.log("📌 アプリは開いたままです。手動で確認してください。");
});
