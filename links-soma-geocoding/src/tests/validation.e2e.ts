import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import * as path from "path";
import { launchAndGetPage } from "./helpers/electron-launcher";

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const TEST_CSV = path.join(FIXTURES_DIR, "test-data.csv");

test.describe("バリデーション（ボタン活性/非活性）", () => {
  // ⚠ シリアル実行: テストは上から順に UI 状態を引き継ぐ（CSV アップロード → カラム選択 → トークン入力）
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("CSV未選択時: テスト実行ボタンが無効", async () => {
    const testRunButton = page.getByRole("button", { name: "テスト実行" });
    await expect(testRunButton).toBeDisabled();
  });

  test("CSVアップロード後、カラム未選択: ボタンが無効", async () => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CSV);
    await expect(page.getByText("test-data.csv")).toBeVisible();

    const testRunButton = page.getByRole("button", { name: "テスト実行" });
    await expect(testRunButton).toBeDisabled();
  });

  test("CSVアップロード + カラム選択 + トークン未入力(AWS): ボタンが無効", async () => {
    // 前提確認: CSVがアップロード済み
    await expect(page.getByText("test-data.csv")).toBeVisible();

    const dropdown = page.locator("button[role='combobox']").first();
    await dropdown.click();
    await page.getByRole("option", { name: "住所" }).click();

    // AWS はトークンが必要だがまだ未入力
    const testRunButton = page.getByRole("button", { name: "テスト実行" });
    await expect(testRunButton).toBeDisabled();
  });

  test("AWS: CSV + カラム + トークン入力で実行ボタンが有効", async () => {
    await page.getByPlaceholder("APIキーを入力").fill("test-token-123");

    const testRunButton = page.getByRole("button", { name: "テスト実行" });
    await expect(testRunButton).toBeEnabled();
  });

  test("NTT: appid未入力でボタンが無効、入力でボタンが有効", async () => {
    // AWS トークンをクリアしてから NTT に切替
    await page.getByPlaceholder("APIキーを入力").fill("");
    await page.getByLabel("NTTジオコーディングAPI").click();

    // appid未入力 → 無効
    const testRunButton = page.getByRole("button", { name: "テスト実行" });
    await expect(testRunButton).toBeDisabled();

    // appid入力 → 有効
    await page.getByPlaceholder("APIのappidを入力").fill("test-appid-123");
    await expect(testRunButton).toBeEnabled();
  });

  test("ABR: トークン不要、CSV + カラム選択のみでボタンが有効", async () => {
    await page.getByLabel("ABRジオコーディング").click();

    const testRunButton = page.getByRole("button", { name: "テスト実行" });
    await expect(testRunButton).toBeEnabled();
  });
});
