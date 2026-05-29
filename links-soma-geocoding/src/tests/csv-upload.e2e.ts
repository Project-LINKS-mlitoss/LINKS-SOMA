import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import * as path from "path";
import { launchAndGetPage } from "./helpers/electron-launcher";

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const TEST_CSV = path.join(FIXTURES_DIR, "test-data.csv");

test.describe("CSVアップロード + カラム選択", () => {
  // ⚠ シリアル実行: テストは上から順に UI 状態を引き継ぐ
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("初期状態: ファイル未選択のメッセージが表示される", async () => {
    await expect(page.getByText("ファイルが選択されていません")).toBeVisible();
  });

  test("CSVファイルをアップロードするとファイル名が表示される", async () => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CSV);

    await expect(page.getByText("test-data.csv")).toBeVisible();
  });

  test("CSVのカラムがドロップダウンに表示される", async () => {
    // 前提確認: CSVがアップロード済み
    await expect(page.getByText("test-data.csv")).toBeVisible();

    const dropdown = page.locator("button[role='combobox']").first();
    await dropdown.click();

    await expect(page.getByRole("option", { name: "ID" })).toBeVisible();
    await expect(page.getByRole("option", { name: "名称" })).toBeVisible();
    await expect(page.getByRole("option", { name: "住所" })).toBeVisible();
    await expect(page.getByRole("option", { name: "備考" })).toBeVisible();
  });

  test("住所カラムを選択できる", async () => {
    await page.getByRole("option", { name: "住所" }).click();

    const dropdown = page.locator("button[role='combobox']").first();
    await expect(dropdown).toContainText("住所");
  });

  test("削除ボタンでCSVを解除し、初期状態に戻る", async () => {
    await page.getByRole("button", { name: "削除" }).click();

    await expect(page.getByText("ファイルが選択されていません")).toBeVisible();
  });
});
