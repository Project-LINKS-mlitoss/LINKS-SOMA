/**
 * 【操作スクリプト】推定対象選定用データを GeoPackage で与えた名寄せの実行
 *
 * run-normalization.ts との違いは推定対象選定用データのファイル形式だけ。
 * CSV は住所結合（E016）、GeoPackage は点を建物の重心バッファに重ねる空間
 * 結合（IF001 の建物ポリゴン経路）を通るため、家屋種別の内訳を出す経路が
 * 別になる。建物ポリゴン経路の内訳・結合率を実データで確認するために使う。
 *
 * 実行方法:
 * cd app && npm run script -- run-normalization-plateau-building-type
 *
 * 所要時間: 30-90分（GeoPackage のアップロードと空間結合を含む）
 *
 * 前提条件:
 * 1. fixtures/ に 建物ポリゴンデータ（PLATEAU）.gpkg と各サンプルCSVが配置済み
 * 2. ml のバイナリがビルド済み（cd ml && npm run build -- IF001）
 */

import { test, expect, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import {
  startNormalizationWizard,
  walkWizard,
  SAMPLE_DATA_FILES,
} from "../helpers/wizard-operations";
import { startPipelineAndNavigateToStatus } from "../helpers/pipeline-operations";

let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

// NOTE: 完了後もアプリを開いたままにする（手動確認用）

test("推定対象選定用データをGeoPackageで指定して名寄せを実行する", async () => {
  test.setTimeout(5400000);

  await startNormalizationWizard(page);

  await walkWizard(page, {
    referenceDate: "2024-04-01",
    municipality: "千代田区",
    buildingRegistry: "select",
    buildingPolygon: "select",
    buildingTypeDetermination: "select",
    buildingTypeDeterminationFileType: "geopackage",
    buildingTypeDeterminationFile: SAMPLE_DATA_FILES.building_polygon,
    residentialValues: ["住宅", "店舗等併用住宅"],
    vacantHouse: "select",
  });

  await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

  await startPipelineAndNavigateToStatus(page, {
    startButton: "開始する",
    confirmMessage: "データ名寄せ処理を開始しました",
    statusHashIncludes: "normalization",
  });

  const maxWait = 5400000;
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
      console.log("名寄せ処理が完了しました");
      return;
    }

    if (statusText?.includes("エラー")) {
      throw new Error(`名寄せ処理がエラーで終了しました: ${statusText}`);
    }

    const elapsed = Math.round((Date.now() - startTime) / 60000);
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(`待機中... (${elapsed}分経過) ${statusText ?? ""}`);
  }

  throw new Error("名寄せ処理が制限時間内に完了しませんでした");
});
