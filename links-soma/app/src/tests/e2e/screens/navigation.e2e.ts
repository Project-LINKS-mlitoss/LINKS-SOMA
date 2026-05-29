/**
 * サイドバー全メニュー遷移テスト
 *
 * 全7メニューに遷移し、画面が正しく表示されることを検証する
 *
 * 実行方法:
 * E2E_DEV_MODE=true npx playwright test navigation
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import {
  MENU_ITEMS,
  navigateTo,
  expectPageHeading,
} from "../../helpers/navigation-helper";

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

test.describe("サイドバーナビゲーション", () => {
  test("アプリが正常に起動すること", async () => {
    const title = await page.title();
    expect(title).toBe("LINKS SOMA　空き家推定システム");
  });

  test("全メニューに遷移できること", async () => {
    for (const menu of MENU_ITEMS) {
      await navigateTo(page, menu.href);
      await expectPageHeading(page, menu.heading);
    }
  });
});
