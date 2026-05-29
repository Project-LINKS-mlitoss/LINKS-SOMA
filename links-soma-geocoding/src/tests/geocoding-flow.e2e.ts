import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import * as path from "path";
import { launchAndGetPage } from "./helpers/electron-launcher";
import { mockAwsApi, mockNttApi, mockAbrApi, MOCK_COORDINATES, EXPECTED_COUNTS } from "./helpers/mock-api";

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const TEST_CSV = path.join(FIXTURES_DIR, "test-data.csv");

/**
 * CSV をアップロードし、住所カラムを選択する共通セットアップ。
 */
async function uploadCsvAndSelectColumn(page: Page) {
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(TEST_CSV);
  await expect(page.getByText("test-data.csv")).toBeVisible();

  const dropdown = page.locator("button[role='combobox']").first();
  await dropdown.click();
  await page.getByRole("option", { name: "住所" }).click();
}

test.describe("AWS ジオコーディング実行フロー（モックAPI）", () => {
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("テスト実行 → 座標が結果に表示される", async () => {
    await mockAwsApi(page);
    await uploadCsvAndSelectColumn(page);
    await page.getByPlaceholder("APIキーを入力").fill("test-token");

    await page.getByRole("button", { name: "テスト実行" }).click();

    // テスト実行は1行目のみ → 座標値を検証
    await expect(page.getByText(String(MOCK_COORDINATES.lat)).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(String(MOCK_COORDINATES.lon)).first()).toBeVisible();
  });

  test("本番実行 → 成功数・失敗数が正しい", async () => {
    await page.getByRole("tab", { name: "本番実行" }).click();
    await page.getByRole("button", { name: "実行", exact: true }).click();

    await expect(page.getByText(`総数: ${EXPECTED_COUNTS.total}`)).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(`成功数: ${EXPECTED_COUNTS.success}`)).toBeVisible();
    await expect(page.getByText(`失敗数: ${EXPECTED_COUNTS.fail}`)).toBeVisible();
  });

  test("本番実行後にダウンロードボタンが有効化される", async () => {
    const downloadButton = page.getByRole("button", { name: "ダウンロード" });
    await expect(downloadButton).toBeEnabled();
  });
});

test.describe("NTT ジオコーディング実行フロー（モックAPI）", () => {
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("テスト実行 → 座標が結果に表示される", async () => {
    await mockNttApi(page);
    await uploadCsvAndSelectColumn(page);
    await page.getByLabel("NTTジオコーディングAPI").click();
    await page.getByPlaceholder("APIのappidを入力").fill("test-appid");

    await page.getByRole("button", { name: "テスト実行" }).click();

    await expect(page.getByText(String(MOCK_COORDINATES.lat)).first()).toBeVisible({ timeout: 30000 });
  });

  test("本番実行 → 成功数・失敗数が正しい", async () => {
    await page.getByRole("tab", { name: "本番実行" }).click();
    await page.getByRole("button", { name: "実行", exact: true }).click();

    await expect(page.getByText(`総数: ${EXPECTED_COUNTS.total}`)).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(`成功数: ${EXPECTED_COUNTS.success}`)).toBeVisible();
    await expect(page.getByText(`失敗数: ${EXPECTED_COUNTS.fail}`)).toBeVisible();
  });
});

test.describe("ABR ジオコーディング実行フロー（モックAPI）", () => {
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
    // ABR モックは main process の ipcMain.handle を差し替えるため、
    // UI 操作前に electronApp.evaluate で設定する
    await mockAbrApi(electronApp);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("テスト実行 → 座標が結果に表示される", async () => {
    await uploadCsvAndSelectColumn(page);
    await page.getByLabel("ABRジオコーディング").click();

    await page.getByRole("button", { name: "テスト実行" }).click();

    await expect(page.getByText(String(MOCK_COORDINATES.lat)).first()).toBeVisible({ timeout: 30000 });
  });

  test("本番実行 → 成功数・失敗数が正しい", async () => {
    await page.getByRole("tab", { name: "本番実行" }).click();
    await page.getByRole("button", { name: "実行", exact: true }).click();

    await expect(page.getByText(`総数: ${EXPECTED_COUNTS.total}`)).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(`成功数: ${EXPECTED_COUNTS.success}`)).toBeVisible();
    await expect(page.getByText(`失敗数: ${EXPECTED_COUNTS.fail}`)).toBeVisible();
  });
});
