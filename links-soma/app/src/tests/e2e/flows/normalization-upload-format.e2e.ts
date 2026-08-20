/**
 * 名寄せウィザード サイドパネル: 期待するアップロード形式の表示
 *
 * 形式が1つ（CSV）のステップまではサンプルデータ不要。
 * 形式が複数（ZIP / gpkg）の建物ポリゴンステップは必須3ステップの通過にデータを要する。
 *
 * 実行方法:
 * npm run e2e -- normalization-upload-format
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import {
  clickNext,
  selectColumns,
  selectDatasetByName,
  startNormalizationWizard,
  SAMPLE_DATA_FILES,
} from "../../helpers/wizard-operations";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });
test.setTimeout(60000);

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe("アップロード形式の明示", () => {
  test("最初のデータセットステップまで進む", async () => {
    await startNormalizationWizard(page);

    // イントロ（目的選択）
    await clickNext(page);

    // 基本設定（基準日 + 市区町村名）
    await page.locator('input[type="date"]').fill("2024-01-01");
    await page.getByPlaceholder("市区町村名を入力").fill("テスト市");
    await clickNext(page);
  });

  test("サイドパネルに期待するファイル形式が表示される", async () => {
    const sidePanel = page.locator("aside");

    await expect(
      sidePanel.getByText("アップロードするファイル形式"),
    ).toBeVisible();
    await expect(sidePanel.getByText("CSV", { exact: true })).toBeVisible();
  });

  test("形式が1つのステップでは選択を促す注記を出さない", async () => {
    // 水道開閉栓状況は CSV のみ。「または」による選択肢提示は現れない。
    const sidePanel = page.locator("aside");

    await expect(
      sidePanel.getByText("いずれか1つの形式でアップロードしてください。"),
    ).toBeHidden();
  });

  test("形式が複数のステップでは ZIP と gpkg を選択肢として並べる", async () => {
    test.setTimeout(180000);

    // 建物ポリゴンステップまで進む。必須3ステップはデータ選択が要る。
    for (const key of [
      "water_status",
      "water_usage",
      "resident_registry",
    ] as const) {
      await selectDatasetByName(page, SAMPLE_DATA_FILES[key]);
      await selectColumns(page, SAMPLE_DATA_FILES[key]);
      await clickNext(page);
    }
    // 任意のジオコーディング・登記情報はスキップ
    for (let i = 0; i < 2; i++) {
      await page.getByLabel("このステップをスキップする").check();
      await clickNext(page);
    }

    const sidePanel = page.locator("aside");
    await expect(
      sidePanel.getByText("建物ポリゴンデータについて"),
    ).toBeVisible();
    await expect(
      sidePanel.getByText("ZIP（Shapefile）", { exact: true }),
    ).toBeVisible();
    await expect(
      sidePanel.getByText("gpkg（ジオパッケージ）", { exact: true }),
    ).toBeVisible();
    await expect(sidePanel.getByText("または", { exact: true })).toBeVisible();
    await expect(
      sidePanel.getByText("いずれか1つの形式でアップロードしてください。"),
    ).toBeVisible();
  });
});
