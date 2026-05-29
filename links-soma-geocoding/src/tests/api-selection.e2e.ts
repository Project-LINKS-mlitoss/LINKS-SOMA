import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import { launchAndGetPage } from "./helpers/electron-launcher";

test.describe("API選択によるUI切替", () => {
  test.describe.configure({ mode: "serial" });
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("初期状態: AWSが選択されている", async () => {
    const awsRadio = page.getByLabel("AWSジオコーディングAPI");
    await expect(awsRadio).toBeChecked();
  });

  test("AWS選択時: APIトークン入力欄が表示される", async () => {
    await expect(page.getByText("APIトークン")).toBeVisible();
    await expect(page.getByPlaceholder("APIキーを入力")).toBeVisible();
  });

  test("NTT選択時: 「APIのappid」ラベルが表示される", async () => {
    await page.getByLabel("NTTジオコーディングAPI").click();

    await expect(page.getByText("APIのappid")).toBeVisible();
    await expect(page.getByPlaceholder("APIのappidを入力")).toBeVisible();
  });

  test("ABR選択時: トークン入力が非表示になる", async () => {
    await page.getByLabel("ABRジオコーディング").click();

    await expect(page.getByPlaceholder("APIキーを入力")).not.toBeVisible();
    await expect(page.getByPlaceholder("APIのappidを入力")).not.toBeVisible();
  });

  test("ABR選択時: ABRデータダウンロードセクションが表示される", async () => {
    await expect(page.getByText("ABRデータダウンロード")).toBeVisible();
  });

  test("AWSに戻すとトークン入力欄が再表示される", async () => {
    await page.getByLabel("AWSジオコーディングAPI").click();

    await expect(page.getByText("APIトークン")).toBeVisible();
    await expect(page.getByPlaceholder("APIキーを入力")).toBeVisible();
  });
});
