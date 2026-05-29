/**
 * データセット管理画面テスト（CRUD）
 *
 * データセット画面の表示、タブ切替、CSVアップロード、削除を検証する
 *
 * 実行方法:
 * E2E_DEV_MODE=true npx playwright test dataset
 */

import * as path from "path";
import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import { navigateTo, expectPageHeading } from "../../helpers/navigation-helper";

const FIXTURES_DIR = path.join(__dirname, "../../fixtures");
const TEST_CSV = path.join(FIXTURES_DIR, "水道開閉栓状況.csv");

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

test.describe("データセット管理", () => {
  test("データセット画面が表示されること", async () => {
    await navigateTo(page, "#dataset");
    await expectPageHeading(page, "データセット管理");
  });

  test("3つのタブが切り替えられること", async () => {
    // インプットデータタブ
    await page.getByRole("tab", { name: "インプットデータ" }).click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("tab=raw");

    // 名寄せ処理済データタブ
    await page.getByRole("tab", { name: "名寄せ処理済データ" }).click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("tab=normalization");

    // 空き家推定結果データタブ
    await page.getByRole("tab", { name: "空き家推定結果データ" }).click();
    await page.waitForTimeout(500);
    expect(page.url()).toContain("tab=result");
  });

  test("CSVファイルをアップロードできること", async () => {
    // インプットデータタブに切替
    await page.getByRole("tab", { name: "インプットデータ" }).click();
    await page.waitForTimeout(500);

    // アップロード前の行数を記録
    const rowsBefore = await page.locator("table tbody tr").count();

    // 隠しinput[type="file"]にファイルをセット
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CSV);
    await page.waitForTimeout(2000);

    // テーブルの行数が増加していること（前回テストのデータが残っている場合に対応）
    const rowsAfter = await page.locator("table tbody tr").count();
    expect(rowsAfter).toBeGreaterThan(rowsBefore);
  });

  test("アップロードしたデータセットを削除できること", async () => {
    // 行の詳細メニューをクリック
    const menuButton = page
      .getByRole("button", { name: "詳細メニュー" })
      .first();
    await menuButton.click();
    await page.waitForTimeout(300);

    // 「削除」メニューアイテムをクリック
    await page.getByRole("menuitem", { name: "削除" }).click();
    await page.waitForSelector('[role="dialog"]');

    // 削除確認ダイアログ
    await expect(page.getByText("を削除しますか？")).toBeVisible();

    // 「削除」ボタンをクリック
    await page
      .locator('[role="dialog"]')
      .getByRole("button", { name: "削除" })
      .click();
    await page.waitForSelector('[role="dialog"]', { state: "hidden" });
    await page.waitForTimeout(1000);
  });
});
