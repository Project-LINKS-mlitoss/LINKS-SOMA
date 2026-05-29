/**
 * アプリ情報画面テスト
 *
 * アプリ情報画面が正しく表示され、4つの情報カードが存在することを検証する
 *
 * 実行方法:
 * E2E_DEV_MODE=true npx playwright test app-info
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import { navigateTo, expectPageHeading } from "../../helpers/navigation-helper";

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

test.describe("アプリ情報", () => {
  test("アプリ情報画面が表示されること", async () => {
    await navigateTo(page, "#app-info");
    await expectPageHeading(page, "アプリケーション情報");
  });

  test("4つの情報カードが表示されること", async () => {
    await expect(page.getByText("ビルド情報")).toBeVisible();
    await expect(page.getByText("ファイルシステム")).toBeVisible();
    await expect(page.getByText("基本情報")).toBeVisible();
    await expect(page.getByText("システム情報")).toBeVisible();
  });
});
