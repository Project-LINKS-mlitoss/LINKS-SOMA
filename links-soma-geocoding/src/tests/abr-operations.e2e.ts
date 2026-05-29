import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";
import { launchAndGetPage } from "./helpers/electron-launcher";
import { mockAbrApi, MOCK_COORDINATES, EXPECTED_COUNTS } from "./helpers/mock-api";

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const TEST_CSV = path.join(FIXTURES_DIR, "test-data.csv");
const TEST_PREFECTURES_CSV = path.join(FIXTURES_DIR, "test-prefectures.csv");

/**
 * ABR の IPC モックをセットアップし、都道府県データを test-prefectures.csv から返す。
 * mockAbrApi のデフォルト都道府県データ（4件）より多い 9 市区町村・3 都道府県を返す。
 */
async function mockAbrApiWithFixture(electronApp: ElectronApplication) {
  // まず標準モック（geocode, batch, delete 等）を設定
  await mockAbrApi(electronApp);

  // 都道府県データをフィクスチャファイルから差し替え
  const csvContent = fs.readFileSync(TEST_PREFECTURES_CSV, "utf-8");
  await electronApp.evaluate(({ ipcMain }, csv) => {
    const csvBuffer = Buffer.from(csv, "utf-8");
    ipcMain.removeHandler("prefecture-file:read-default");
    ipcMain.handle("prefecture-file:read-default", async () => ({
      success: true,
      buffer: csvBuffer,
      fileName: "test-prefectures.csv",
    }));
  }, csvContent);
}

/**
 * abr:check-data-for-code のモックを差し替えて、特定の lgCode にデータが存在する状態にする。
 */
async function mockDataExistsForCodes(electronApp: ElectronApplication, existingCodes: string[]) {
  await electronApp.evaluate(({ ipcMain }, codes) => {
    ipcMain.removeHandler("abr:check-data-for-code");
    ipcMain.handle("abr:check-data-for-code", async (_event, lgCode: string) => {
      return codes.includes(lgCode);
    });
  }, existingCodes);
}

/**
 * ABR を選択した状態にする共通セットアップ。
 * 都道府県ドロップダウンが使えるまで待機する。
 */
async function selectAbrApi(page: Page) {
  await page.getByLabel("ABRジオコーディング").click();
  await expect(page.getByText("ABRデータダウンロード")).toBeVisible({ timeout: 10000 });
}

/**
 * CSV をアップロードし、住所カラムを選択する共通セットアップ。
 */
async function uploadCsvAndSelectColumn(page: Page) {
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(TEST_CSV);
  await expect(page.getByText("test-data.csv")).toBeVisible();

  const dropdown = page.locator("button[role='combobox']").first();
  await dropdown.click();
  await page.getByRole("option", { name: "住所" }).click();
}

// ---------------------------------------------------------------------------
// 1. 市区町村ドロップダウンの選択
// ---------------------------------------------------------------------------

test.describe("ABR 市区町村ドロップダウン", () => {
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
    await mockAbrApiWithFixture(electronApp);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("都道府県を選択すると配下の市区町村がドロップダウンに表示される", async () => {
    await selectAbrApi(page);

    // 都道府県ドロップダウンで東京都を選択
    const prefDropdown = page.getByRole("combobox", { name: "都道府県を選択" });
    await prefDropdown.click();
    await page.getByRole("option", { name: "東京都" }).click();

    // 市区町村ドロップダウンを開く
    const cityDropdown = page.getByRole("combobox", { name: "市区町村を選択" });
    await expect(cityDropdown).toBeEnabled();
    await cityDropdown.click();

    // 東京都の市区町村が表示される
    await expect(page.getByRole("option", { name: "千代田区" })).toBeVisible();
    await expect(page.getByRole("option", { name: "中央区" })).toBeVisible();
    await expect(page.getByRole("option", { name: "港区" })).toBeVisible();
    await expect(page.getByRole("option", { name: "新宿区" })).toBeVisible();
    await expect(page.getByRole("option", { name: "文京区" })).toBeVisible();

    // 大阪府の市区町村は表示されない
    await expect(page.getByRole("option", { name: "大阪市北区" })).not.toBeVisible();
  });

  test("都道府県を切り替えると市区町村がリセットされる", async () => {
    // 千代田区を選択
    await page.getByRole("option", { name: "千代田区" }).click();
    const cityDropdown = page.getByRole("combobox", { name: "市区町村を選択" });
    await expect(cityDropdown).toContainText("千代田区");

    // 都道府県を大阪府に切替
    const prefDropdown = page.getByRole("combobox", { name: "都道府県を選択" });
    await prefDropdown.click();
    await page.getByRole("option", { name: "大阪府" }).click();

    // 市区町村がリセットされている（千代田区は選択されていない）
    await expect(cityDropdown).not.toContainText("千代田区");

    // 大阪府の市区町村が表示される
    await cityDropdown.click();
    await expect(page.getByRole("option", { name: "大阪市北区" })).toBeVisible();
    await expect(page.getByRole("option", { name: "大阪市中央区" })).toBeVisible();
  });

  test("市区町村未選択で都道府県のみ選択してダウンロード → N市区町村の完了メッセージ", async () => {
    // ドロップダウンを閉じるために ESC
    await page.keyboard.press("Escape");

    // 大阪府が選択済み・市区町村未選択の状態でダウンロード
    await page.getByRole("button", { name: "ダウンロード", exact: true }).click();

    // 2市区町村の完了メッセージ
    await expect(page.getByText("ダウンロードが完了しました: 大阪府 の2市区町村")).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 2. 市区町村指定ダウンロード
// ---------------------------------------------------------------------------

test.describe("ABR 市区町村指定ダウンロード", () => {
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
    await mockAbrApiWithFixture(electronApp);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("市区町村を選択してダウンロード → 都道府県+市区町村名の完了メッセージ", async () => {
    await selectAbrApi(page);

    // 福島県を選択
    const prefDropdown = page.getByRole("combobox", { name: "都道府県を選択" });
    await prefDropdown.click();
    await page.getByRole("option", { name: "福島県" }).click();

    // 相馬市を選択
    const cityDropdown = page.getByRole("combobox", { name: "市区町村を選択" });
    await cityDropdown.click();
    await page.getByRole("option", { name: "相馬市" }).click();

    // ダウンロード
    await page.getByRole("button", { name: "ダウンロード", exact: true }).click();

    // 市区町村名入りの完了メッセージ
    await expect(page.getByText("ダウンロードが完了しました: 福島県 相馬市")).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// 3. データ既存チェック
// ---------------------------------------------------------------------------

test.describe("ABR データ存在確認", () => {
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
    await mockAbrApiWithFixture(electronApp);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("データ存在する市区町村を選択 → ダウンロードボタン無効 + 既存メッセージ表示", async () => {
    await selectAbrApi(page);

    // 千代田区 (131016) のデータが存在する状態にモック差し替え
    await mockDataExistsForCodes(electronApp, ["131016"]);

    // 東京都 → 千代田区 を選択
    const prefDropdown = page.getByRole("combobox", { name: "都道府県を選択" });
    await prefDropdown.click();
    await page.getByRole("option", { name: "東京都" }).click();

    const cityDropdown = page.getByRole("combobox", { name: "市区町村を選択" });
    await cityDropdown.click();
    await page.getByRole("option", { name: "千代田区" }).click();

    // 「既にダウンロード済みです」メッセージが表示される
    await expect(page.getByText("千代田区のデータは既にダウンロード済みです。")).toBeVisible({ timeout: 10000 });

    // ダウンロードボタンが無効
    const downloadButton = page.getByRole("button", { name: "ダウンロード", exact: true });
    await expect(downloadButton).toBeDisabled();
  });

  test("データ未存在の市区町村に切替 → ダウンロードボタンが有効に戻る", async () => {
    // 中央区（131024）はデータ未存在
    const cityDropdown = page.getByRole("combobox", { name: "市区町村を選択" });
    await cityDropdown.click();
    await page.getByRole("option", { name: "中央区" }).click();

    // 既存メッセージが消える
    await expect(page.getByText("千代田区のデータは既にダウンロード済みです。")).not.toBeVisible();

    // ダウンロードボタンが有効
    const downloadButton = page.getByRole("button", { name: "ダウンロード", exact: true });
    await expect(downloadButton).toBeEnabled();
  });
});

// ---------------------------------------------------------------------------
// 4. 削除ダイアログ キャンセル
// ---------------------------------------------------------------------------

test.describe("ABR 削除ダイアログ キャンセル", () => {
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
    await mockAbrApiWithFixture(electronApp);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("削除ダイアログでキャンセル → ダイアログが閉じ、都道府県選択が維持される", async () => {
    await selectAbrApi(page);

    // 東京都を選択
    const prefDropdown = page.getByRole("combobox", { name: "都道府県を選択" });
    await prefDropdown.click();
    await page.getByRole("option", { name: "東京都" }).click();

    // 削除ボタン → ダイアログ表示
    await page.getByRole("button", { name: "すべてのデータを削除" }).click();
    await expect(page.getByText("データ削除の確認")).toBeVisible();

    // キャンセル
    await page.getByRole("button", { name: "キャンセル" }).click();

    // ダイアログが閉じる
    await expect(page.getByText("データ削除の確認")).not.toBeVisible({ timeout: 10000 });

    // 都道府県の選択が維持されている
    await expect(prefDropdown).toContainText("東京都");
  });
});

// ---------------------------------------------------------------------------
// 5. 都道府県ファイル差し替え
// ---------------------------------------------------------------------------

test.describe("ABR 都道府県ファイル差し替え", () => {
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
    await mockAbrApiWithFixture(electronApp);

    // prefecture-file:save のモックを追加
    await electronApp.evaluate(({ ipcMain }) => {
      ipcMain.removeHandler("prefecture-file:save");
      ipcMain.handle("prefecture-file:save", async () => ({
        success: true,
        message: "保存しました",
      }));
    });
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("ファイルを変更すると新しい都道府県データが読み込まれる", async () => {
    await selectAbrApi(page);

    // 初期状態: test-prefectures.csv の3都道府県が読み込まれている
    await expect(page.getByText("読み込み済み: test-prefectures.csv")).toBeVisible({ timeout: 10000 });

    // 差し替え後のモック: 北海道のみのデータを返すようにする
    const replacementCsv = "011002,北海道,札幌市中央区\n012025,北海道,旭川市";
    await electronApp.evaluate(({ ipcMain }, csv) => {
      const csvBuffer = Buffer.from(csv, "utf-8");
      ipcMain.removeHandler("prefecture-file:read-default");
      ipcMain.handle("prefecture-file:read-default", async () => ({
        success: true,
        buffer: csvBuffer,
        fileName: "custom-prefectures.csv",
      }));
    }, replacementCsv);

    // 「ファイルを変更」の file input にファイルをセット
    // 実際の保存→再読込フローをトリガーするため、hidden input にファイルをセットする
    const fileInput = page.locator('input[type="file"][accept=".csv,.xls,.xlsx"]');
    await fileInput.setInputFiles(TEST_PREFECTURES_CSV);

    // 保存成功メッセージを待つ
    await expect(page.getByText(/ファイル「.*」を読み込み/)).toBeVisible({ timeout: 10000 });

    // ファイル名が更新される
    await expect(page.getByText("読み込み済み: custom-prefectures.csv")).toBeVisible();

    // 都道府県ドロップダウンを開く
    const prefDropdown = page.getByRole("combobox", { name: "都道府県を選択" });
    await prefDropdown.click();

    // 新しいデータ（北海道）が表示される
    await expect(page.getByRole("option", { name: "北海道" })).toBeVisible();

    // 古いデータ（東京都）は表示されない
    await expect(page.getByRole("option", { name: "東京都" })).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. ABR エンドツーエンド: データダウンロード → ジオコーディング実行
// ---------------------------------------------------------------------------

test.describe("ABR エンドツーエンド: データ準備 → ジオコーディング実行", () => {
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
    await mockAbrApiWithFixture(electronApp);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("CSV アップロード → ABR 選択 → データダウンロード → テスト実行 → 座標表示", async () => {
    // Step 1: CSV アップロード + カラム選択
    await uploadCsvAndSelectColumn(page);

    // Step 2: ABR を選択
    await selectAbrApi(page);

    // Step 3: 都道府県選択してデータダウンロード
    const prefDropdown = page.getByRole("combobox", { name: "都道府県を選択" });
    await prefDropdown.click();
    await page.getByRole("option", { name: "東京都" }).click();

    await page.getByRole("button", { name: "ダウンロード", exact: true }).click();
    await expect(page.getByText("ダウンロードが完了しました")).toBeVisible({ timeout: 10000 });

    // Step 4: テスト実行
    await page.getByRole("button", { name: "テスト実行" }).click();

    // Step 5: 座標が表示される
    await expect(page.getByText(String(MOCK_COORDINATES.lat)).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(String(MOCK_COORDINATES.lon)).first()).toBeVisible();
  });

  test("本番実行 → 成功数/失敗数が正しい", async () => {
    await page.getByRole("tab", { name: "本番実行" }).click();
    await page.getByRole("button", { name: "実行", exact: true }).click();

    await expect(page.getByText(`総数: ${EXPECTED_COUNTS.total}`)).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(`成功数: ${EXPECTED_COUNTS.success}`)).toBeVisible();
    await expect(page.getByText(`失敗数: ${EXPECTED_COUNTS.fail}`)).toBeVisible();
  });

  test("本番実行後にダウンロードボタンが有効", async () => {
    // ABR ダウンロードセクションにも「ダウンロード」ボタンがあるため、
    // 「本番実行結果」を含むフォーム内のボタンを特定する
    const runSection = page.locator("form", { has: page.getByText("本番実行結果") });
    const downloadButton = runSection.getByRole("button", { name: "ダウンロード" });
    await expect(downloadButton).toBeEnabled();
  });
});
