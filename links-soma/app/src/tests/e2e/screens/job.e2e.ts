/**
 * 処理一覧画面テスト
 *
 * 処理一覧画面の表示と空状態の確認を検証する
 *
 * 実行方法:
 * E2E_DEV_MODE=true npx playwright test job
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

test.describe("処理一覧", () => {
  test("処理一覧画面が表示されること", async () => {
    await navigateTo(page, "#job");
    await expectPageHeading(page, "処理一覧");
  });

  test("テーブルまたは空メッセージが表示されること", async () => {
    // DBにジョブが存在する場合はテーブル、なければ空メッセージ
    const emptyMessage = page.getByText("現在表示できる処理はありません");
    const table = page.locator("table");
    await expect(emptyMessage.or(table).first()).toBeVisible();
  });
});
