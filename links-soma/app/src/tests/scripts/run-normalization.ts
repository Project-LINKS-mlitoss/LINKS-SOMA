/**
 * 【操作スクリプト】名寄せ処理の実行
 *
 * 名寄せウィザードをUI経由で実行し、完了後に「名前をつけて保存」で
 * 名寄せ処理済みデータ（normalized_data_sets）を作成する
 *
 * 実行方法:
 * cd app && npm run script -- run-normalization
 *
 * 所要時間: 30-90分（名寄せ処理時間に依存）
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み（CSV、Shapefile、建物ポリゴンデータ等）
 *    ※ 建物ポリゴンデータがない場合、アプリに事前登録済みの .gpkg を検索する
 */

import { test, expect, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import {
  startNormalizationWizard,
  walkWizard,
} from "../helpers/wizard-operations";
import { saveJobResult } from "../helpers/job-operations";
import { startPipelineAndNavigateToStatus } from "../helpers/pipeline-operations";

let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

// NOTE: 完了後もアプリを開いたままにする（手動確認用）
// test.afterAll は意図的に省略

test("名寄せを実行して名前をつけて保存する", async () => {
  // 60分タイムアウト（名寄せ処理時間を考慮）
  test.setTimeout(3600000);

  // === Step 1: 名寄せウィザードを確認画面まで進める ===
  await startNormalizationWizard(page);

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log(
    "📌 建物ポリゴンデータを選択します（フィクスチャから自動アップロード、なければ登録済みデータを検索）",
  );

  await walkWizard(page, {
    referenceDate: "2024-04-01",
    municipality: "千代田区",
    buildingRegistry: "select",
    buildingPolygon: "select",
    buildingTypeDetermination: "select",
    residentialValues: ["住宅", "店舗等併用住宅"],
    vacantHouse: "select",
  });

  // 確認画面に到達
  await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

  // === Step 2: 名寄せ実行 ===
  await startPipelineAndNavigateToStatus(page, {
    startButton: "開始する",
    confirmMessage: "データ名寄せ処理を開始しました",
    statusHashIncludes: "normalization",
  });

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("⏳ 名寄せ処理を開始しました。名寄せ一覧で進捗を監視します...");

  // === Step 3: ジョブ完了までポーリング ===
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
      console.log("✅ 名寄せ処理が完了しました");
      break;
    }

    if (statusText?.includes("エラー")) {
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log("❌ 名寄せ処理がエラーで終了しました");
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log(`   行内容: ${statusText}`);
      throw new Error("名寄せ処理がエラーで終了しました");
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

  // === Step 4: 名前をつけて保存 ===
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("📌 名前をつけて保存を実行します");

  await saveJobResult(page);

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log(
    "✅ 名寄せ処理済みデータの保存が完了しました。次に空き家推定（npm run script -- run-estimation）を実行してください。",
  );
});
