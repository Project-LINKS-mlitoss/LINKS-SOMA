/**
 * 空き家推定画面テスト（表示のみ）
 *
 * 空き家推定画面の表示と作成画面への遷移を検証する
 *
 * 実行方法:
 * E2E_DEV_MODE=true npx playwright test evaluation
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

test.describe("空き家推定", () => {
  test("空き家推定画面が表示されること", async () => {
    await navigateTo(page, "#evaluation");
    await expectPageHeading(page, "空き家推定");
  });

  test("作成画面に遷移できること", async () => {
    // 「空き家推定を始める」ボタン
    await page.getByRole("button", { name: "空き家推定を始める" }).click();
    await page.waitForTimeout(1000);

    // 作成画面のURL確認
    expect(page.url()).toContain("/evaluation/create");

    // フォーム要素が表示される（選択ボタン等）
    await expect(
      page.getByRole("button", { name: "選択" }).first(),
    ).toBeVisible();
  });

  test("必須未選択で推定開始するとインライン検証でブロックされること（PV-17）", async () => {
    // 直前テストで /evaluation/create に居る。何も選択せず推定開始を押す。
    await page.getByRole("button", { name: "推定開始" }).click();

    // 必須選択の検証メッセージが表示される（lang: evaluation/create.validation）
    await expect(
      page.getByText("利用するモデルを選択してください"),
    ).toBeVisible({ timeout: 5000 });

    // 送信されず作成画面に留まる
    expect(page.url()).toContain("/evaluation/create");
  });
});
