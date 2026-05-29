/**
 * モデル構築画面テスト
 *
 * モデル構築画面の表示・ボタン・処理一覧・作成画面への遷移を検証する
 *
 * 実行方法:
 * E2E_DEV_MODE=true npx playwright test model
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

test.describe("モデル構築", () => {
  test("モデル構築画面が表示されること", async () => {
    await navigateTo(page, "#model");
    await expectPageHeading(page, "モデル構築");
  });

  test("モデルアップロードボタンが表示されること", async () => {
    await expect(
      page.getByRole("button", { name: "学習済モデルをアップロード" }),
    ).toBeVisible();
  });

  test("「モデル構築を始める」ボタンが表示されること", async () => {
    await expect(
      page.getByRole("button", { name: "モデル構築を始める" }),
    ).toBeVisible();
  });

  test("処理一覧セクションが表示されること", async () => {
    // 処理一覧の見出しが表示される（サイドバーのリンクと区別するためh4を指定）
    await expect(
      page.getByRole("heading", { name: "処理一覧" }),
    ).toBeVisible();

    // DBにジョブが存在する場合はテーブル、なければ空メッセージ
    const emptyMessage = page.getByText("現在表示できる処理はありません");
    const table = page.locator("table");
    await expect(emptyMessage.or(table).first()).toBeVisible();
  });

  test("作成画面に遷移できること", async () => {
    await page.getByRole("button", { name: "モデル構築を始める" }).click();
    await page.waitForTimeout(1000);

    // 作成画面のURL確認
    expect(page.url()).toContain("/model/create");

    // フォーム要素が表示される（インポートボタン等）
    await expect(
      page.getByRole("button", { name: "インポート" }).first(),
    ).toBeVisible();
  });

  test("作成画面のフォーム要素が表示されること", async () => {
    // ① データセット選択セクション
    await expect(
      page.getByText("名寄せ済みデータセット一覧から選択"),
    ).toBeVisible();

    // ② 説明変数選択セクション
    await expect(page.getByText("説明変数に使うカラムの選択")).toBeVisible();

    // ③ パラメーター設定セクション
    await expect(
      page.getByRole("button", { name: "高度な設定を変更" }),
    ).toBeVisible();

    // モデル構築開始ボタン
    await expect(
      page.getByRole("button", { name: "モデル構築開始" }),
    ).toBeVisible();
  });
});
