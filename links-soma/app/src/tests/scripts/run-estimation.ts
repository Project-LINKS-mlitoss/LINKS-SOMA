/**
 * 【操作スクリプト】空き家推定の実行
 *
 * 名寄せ処理済みデータとモデルファイルを使って空き家推定を実行し、
 * 推定結果データ（data_set_results）を生成する
 *
 * 実行方法:
 * cd app && npm run script -- run-estimation
 *
 * 所要時間: 5-60分（データ量・マシン性能に依存）
 *
 * 前提条件:
 * 1. 名寄せ処理が完了済み（run-normalization を先に実行）
 * 2. モデルファイルが存在すること（アプリ初期化で自動作成される）
 */

import { test, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import {
  navigateAndStartAction,
  fillEstimationForm,
  startPipelineAndNavigateToStatus,
} from "../helpers/pipeline-operations";

let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

// NOTE: 完了後もアプリを開いたままにする（手動確認用）
// test.afterAll は意図的に省略

test("空き家推定を実行して推定結果データを作成する", async () => {
  // 60分タイムアウト（推定処理時間を考慮）
  test.setTimeout(3600000);

  // === Step 1: 空き家推定画面に遷移 ===
  await navigateAndStartAction(page, {
    href: "#evaluation",
    hashIncludes: "evaluation",
    startButton: "空き家推定を始める",
    createHashIncludes: "evaluation/create",
  });

  // === Step 2: フォーム入力 ===
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("📌 推定フォームを入力します（先頭のデータ・モデルを使用）");

  await fillEstimationForm(page);

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("✅ 地域集計用データ設定完了（KEY_CODE / S_NAME）");

  // === Step 3: 分析開始 ===
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("🚀 分析を開始します");

  await startPipelineAndNavigateToStatus(page, {
    startButton: "分析開始",
    confirmMessage: "分析を開始しました",
    statusHashIncludes: "evaluation",
    createHashExcludes: "create",
  });

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("⏳ 推定処理を開始しました。一覧で進捗を監視します...");

  // === Step 4: ジョブ完了までポーリング ===
  const maxWait = 3600000;
  const interval = 30000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await page.waitForTimeout(interval);
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    const firstRow = page.locator("table tbody tr").first();
    const statusText = await firstRow.textContent().catch(() => "");

    if (statusText?.includes("完了")) {
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log("✅ 空き家推定処理が完了しました");
      break;
    }

    if (statusText?.includes("エラー")) {
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log("❌ 空き家推定処理がエラーで終了しました");
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log(`   行内容: ${statusText}`);
      throw new Error("空き家推定処理がエラーで終了しました");
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

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log(
    "✅ 推定結果データの準備が完了しました。BI操作テスト（npm run e2e -- bi-operations）を実行できます。",
  );
});
