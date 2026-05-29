/**
 * 【操作スクリプト】モデル構築の実行
 *
 * 名寄せ処理済みデータを使ってモデル構築を実行し、
 * モデルファイル（model_files）を生成する
 *
 * 実行方法:
 * cd app && npm run script -- run-model-building
 *
 * 所要時間: 5-60分（データ量・マシン性能に依存）
 *
 * 前提条件:
 * 1. 名寄せ処理が完了済み（run-normalization を先に実行）
 */

import { test, expect, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import { saveJobResult } from "../helpers/job-operations";
import {
  navigateAndStartAction,
  fillModelBuildingForm,
  startPipelineAndNavigateToStatus,
} from "../helpers/pipeline-operations";

let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

// NOTE: 完了後もアプリを開いたままにする（手動確認用）
// test.afterAll は意図的に省略

test("モデル構築を実行してモデルファイルを作成する", async () => {
  // 60分タイムアウト（構築処理時間を考慮）
  test.setTimeout(3600000);

  // === Step 1: モデル構築画面に遷移 ===
  await navigateAndStartAction(page, {
    href: "#model",
    hashIncludes: "model",
    startButton: "モデル構築を始める",
    createHashIncludes: "model/create",
  });

  // === Step 2: フォーム入力 ===
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("📌 名寄せ済みデータセットを選択します");

  await fillModelBuildingForm(page);

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("✅ データセット選択完了");
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("📌 説明変数はデフォルト値を使用します");
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("📌 パラメーターはデフォルト値を使用します");

  // === Step 3: モデル構築開始 ===
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("🚀 モデル構築を開始します");

  await startPipelineAndNavigateToStatus(page, {
    startButton: "モデル構築開始",
    confirmMessage: "モデル構築処理を開始しました",
    statusHashIncludes: "model",
    createHashExcludes: "create",
  });

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("⏳ モデル構築処理を開始しました。一覧で進捗を監視します...");

  // === Step 4: ジョブ完了までポーリング ===
  const maxWait = 3600000;
  const interval = 30000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await page.waitForTimeout(interval);
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    // 2番目のテーブル（処理一覧）
    const firstRow = page.locator("table").nth(1).locator("tbody tr").first();
    const statusText = await firstRow.textContent().catch(() => "");

    if (statusText?.includes("完了")) {
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log("✅ モデル構築処理が完了しました");
      break;
    }

    if (statusText?.includes("エラー")) {
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log("❌ モデル構築処理がエラーで終了しました");
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log(`   行内容: ${statusText}`);
      throw new Error("モデル構築処理がエラーで終了しました");
    }

    const progressMatch = statusText?.match(/進行中\s*(\d+)%/);
    const elapsed = Math.round((Date.now() - startTime) / 60000);
    if (progressMatch) {
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log(`⏳ ${progressMatch[0]} (${elapsed}分経過)`);
    } else {
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log(`⏳ 待機中... (${elapsed}分経過)`);
    }
  }

  // === Step 5: 名前をつけて保存 ===
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("📌 完了した処理の詳細画面に遷移します");

  await saveJobResult(page, { tableIndex: 1, skipVerification: true });

  // 保存後、modelFilesの再取得のためリロード
  await page.reload();
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);

  await expect(page.getByText("として保存済み")).toBeVisible({
    timeout: 10000,
  });

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("✅ モデルの名前をつけて保存が完了しました");
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log(
    "✅ モデル構築が完了しました。空き家推定（npm run script -- run-estimation）を実行できます。",
  );
});
