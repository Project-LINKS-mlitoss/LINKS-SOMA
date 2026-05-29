/**
 * ワークブック管理テスト（CRUD + 詳細・編集画面）
 *
 * ワークブックの作成、詳細表示、編集画面遷移、削除を検証する
 *
 * 実行方法:
 * E2E_DEV_MODE=true npx playwright test workbook
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import { navigateTo, expectPageHeading } from "../../helpers/navigation-helper";

const WORKBOOK_NAME = `E2Eテスト_${Date.now()}`;

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

test.describe("ワークブック管理", () => {
  test("分析画面が表示されること", async () => {
    await navigateTo(page, "#analysis/workbook");
    await expectPageHeading(page, "分析");
  });

  test("ワークブックを作成できること", async () => {
    // 「新規ワークブック作成」ボタン
    await page.getByRole("button", { name: "新規ワークブック作成" }).click();
    await page.waitForSelector('[role="dialog"]');

    // ダイアログでワークブック名を入力
    await expect(
      page.getByRole("heading", { name: "ワークブック名" }),
    ).toBeVisible();
    const nameInput = page
      .locator('[role="dialog"]')
      .locator('input[type="text"]');
    await nameInput.fill(WORKBOOK_NAME);

    // 「保存」ボタンをクリック
    await page
      .locator('[role="dialog"]')
      .getByRole("button", { name: "保存" })
      .click();
    await page.waitForSelector('[role="dialog"]', { state: "hidden" });

    // 保存後はedit画面に自動遷移する
    await expect(page.getByText("ビューの設定")).toBeVisible({
      timeout: 10000,
    });

    // edit画面のURLにワークブックIDが含まれる
    expect(page.url()).toContain("/analysis/workbook/");
    expect(page.url()).toContain("/edit");

    // edit画面のh2にワークブック名が表示される
    await expect(page.locator("h2", { hasText: WORKBOOK_NAME })).toBeVisible({
      timeout: 10000,
    });
  });

  test("ワークブック詳細画面が正しく表示されること", async () => {
    // edit画面のパンくずリスト「詳細」で詳細画面に遷移
    await page
      .locator('nav[aria-label="パンくずリスト"]')
      .getByRole("link", { name: "詳細" })
      .click();

    // 詳細画面のURL確認（/edit を含まない）
    await page.waitForFunction(() => !window.location.hash.includes("/edit"), {
      timeout: 10000,
    });
    expect(page.url()).toContain("/analysis/workbook/");

    // ワークブック名がh2に表示される
    await expect(page.locator("h2", { hasText: WORKBOOK_NAME })).toBeVisible();

    // 空状態メッセージ
    await expect(page.getByText("表示するビューがありません。")).toBeVisible();
  });

  test("ワークブック編集画面に遷移できること", async () => {
    // 詳細画面の編集ボタン（EditFilledアイコン付きリンク）をクリック
    const editLink = page.locator('a[href*="/edit"]');
    await editLink.click();

    // 編集画面のURL確認
    await page.waitForFunction(() => window.location.hash.includes("/edit"), {
      timeout: 10000,
    });

    // サイドバー（ビューの設定パネル）が表示される
    await expect(page.getByText("ビューの設定")).toBeVisible();
  });

  test("ワークブックを削除できること", async () => {
    // edit画面のパンくずリスト「詳細」で詳細画面に戻る
    await page
      .locator('nav[aria-label="パンくずリスト"]')
      .getByRole("link", { name: "詳細" })
      .click();

    // 詳細画面に遷移したことを確認
    await page.waitForFunction(() => !window.location.hash.includes("/edit"), {
      timeout: 10000,
    });

    // 削除ボタン: h2の親コンテナ内で最後のbutton（編集ボタンの次）
    const headingRow = page
      .locator("h2", { hasText: WORKBOOK_NAME })
      .locator("..");
    await headingRow.locator("button").last().click();
    await page.waitForSelector('[role="dialog"]');

    // 削除確認ダイアログ
    await expect(page.getByText("ワークブックを削除しますか？")).toBeVisible();

    // 「削除」ボタンをクリック
    await page
      .locator('[role="dialog"]')
      .getByRole("button", { name: "削除" })
      .click();
    await page.waitForTimeout(1000);

    // ワークブック一覧にリダイレクト
    expect(page.url()).toContain("analysis/workbook");
  });
});
