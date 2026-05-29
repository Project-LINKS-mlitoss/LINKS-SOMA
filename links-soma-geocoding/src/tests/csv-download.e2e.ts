import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import * as path from "path";
import { launchAndGetPage } from "./helpers/electron-launcher";
import { mockAwsApi, MOCK_COORDINATES, EXPECTED_COUNTS } from "./helpers/mock-api";

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const TEST_CSV = path.join(FIXTURES_DIR, "test-data.csv");

test.describe("CSV ダウンロード", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120000);
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("本番実行完了前: ダウンロードボタンが無効", async () => {
    await page.getByRole("tab", { name: "本番実行" }).click();

    const downloadButton = page.getByRole("button", { name: "ダウンロード" });
    await expect(downloadButton).toBeDisabled();
  });

  test("本番実行後: ダウンロードボタンが有効化される", async () => {
    await mockAwsApi(page);

    // CSV アップロード + カラム選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CSV);
    await expect(page.getByText("test-data.csv")).toBeVisible();

    const dropdown = page.locator("button[role='combobox']").first();
    await dropdown.click();
    await page.getByRole("option", { name: "住所" }).click();

    // AWS トークン入力
    await page.getByPlaceholder("APIキーを入力").fill("test-token");

    // 本番実行タブに切替して実行
    await page.getByRole("tab", { name: "本番実行" }).click();
    await page.getByRole("button", { name: "実行", exact: true }).click();

    // 完了を待つ — 値まで検証する
    await expect(page.getByText(`総数: ${EXPECTED_COUNTS.total}`)).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(`成功数: ${EXPECTED_COUNTS.success}`)).toBeVisible();

    // ダウンロードボタンが有効化
    const downloadButton = page.getByRole("button", { name: "ダウンロード" });
    await expect(downloadButton).toBeEnabled();
  });

  test("結果に座標が含まれる", async () => {
    // 前提確認: 本番実行タブに結果が表示されている
    await expect(page.getByText(`総数: ${EXPECTED_COUNTS.total}`)).toBeVisible();

    // 座標値が結果に含まれている（複数行にマッチするので first()）
    await expect(page.getByText(String(MOCK_COORDINATES.lat)).first()).toBeVisible();
    await expect(page.getByText(String(MOCK_COORDINATES.lon)).first()).toBeVisible();
  });
});
