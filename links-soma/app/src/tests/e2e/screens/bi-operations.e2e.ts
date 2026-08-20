/**
 * BI操作テスト（Tier 2: 要データ）
 *
 * 推定結果データが存在する状態でのBI操作をテストする
 *
 * 実行方法:
 * cd app && npm run e2e -- bi-operations
 *
 * 前提: 空き家推定が完了済みであること
 *   1. npm run script -- run-normalization — 名寄せ処理の実行 + 名前をつけて保存
 *   2. npm run script -- run-estimation    — 空き家推定の実行（推定結果データが作成される）
 *   3. npm run script -- setup-bi-workbook — ワークブック・ビュー作成
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import { navigateTo } from "../../helpers/navigation-helper";

/** BI操作テスト用ワークブック名 */
const WORKBOOK_NAME = "E2Eテスト用";

let electronApp: ElectronApplication;
let page: Page;
let hasData = true;

test.describe.configure({ mode: "serial" });
test.setTimeout(120000);

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());

  // ワークブック「E2Eテスト用」の存在確認
  const workbookExists = await page.evaluate(async () => {
    const workbooks = await window.ipcRenderer.invoke("selectWorkbooks");
    return workbooks.some(
      (wb: { title: string | null }) => wb.title === "E2Eテスト用",
    );
  });

  if (!workbookExists) {
    hasData = false;
    // eslint-disable-next-line no-console -- E2Eテストの進捗表示
    console.log(
      "⚠️ テスト用ワークブックが見つかりません。先に以下を実行してください:\n" +
        "  1. npm run script -- run-normalization\n" +
        "  2. npm run script -- run-estimation\n" +
        "  3. npm run script -- setup-bi-workbook",
    );
    return;
  }

  // ワークブック詳細画面に遷移
  await navigateTo(page, "#analysis/workbook");
  await page.waitForTimeout(1000);
  await page.getByText(WORKBOOK_NAME).click();
  await page.waitForTimeout(2000);
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe("BI操作", () => {
  test.describe("ビューレンダリング", () => {
    test("ワークブック詳細画面が表示されること", async () => {
      test.skip(!hasData, "名寄せ結果データが存在しません");
      expect(page.url()).toContain("/analysis/workbook/");
    });

    test("テーブルビューが表示されること", async () => {
      test.skip(!hasData, "名寄せ結果データが存在しません");

      // Fluent UIのTableはCSS displayを変更するため、<th>の暗黙的ARIAロールが無効化される
      // getByRole("columnheader")ではなくlocator("th")で直接マッチさせる
      const tableHeader = page.locator("th").first();
      await expect(tableHeader).toBeVisible({ timeout: 30000 });

      const rows = page.locator("table tbody tr");
      expect(await rows.count()).toBeGreaterThan(0);
    });

    test("地図ビューが表示されること", async () => {
      test.skip(!hasData, "名寄せ結果データが存在しません");

      const mapContainer = page.locator(".maplibregl-map").first();
      await expect(mapContainer).toBeVisible({ timeout: 30000 });
    });

    test("チャートが表示されること", async () => {
      test.skip(!hasData, "名寄せ結果データが存在しません");

      const charts = page.locator("svg.recharts-surface").first();
      await expect(charts).toBeVisible({ timeout: 30000 });
    });
  });

  test.describe("ビュー編集", () => {
    test("編集画面でビュー設定パネルが表示されること", async () => {
      test.skip(!hasData, "名寄せ結果データが存在しません");

      const editLink = page.locator('a[href*="/edit"]');
      await expect(editLink).toBeVisible();
      await editLink.click();
      await page.waitForTimeout(1000);

      await expect(page.getByText("ビューの設定")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "ビューを追加" }),
      ).toBeVisible();
    });
  });

  test.describe("ダウンロード", () => {
    test("ダウンロードダイアログが表示されること", async () => {
      test.skip(!hasData, "名寄せ結果データが存在しません");

      const actionMenu = page
        .getByRole("button", { name: "アクションメニュー" })
        .first();
      await expect(actionMenu).toBeVisible();
      await actionMenu.click();
      await page.waitForTimeout(300);

      const downloadItem = page.getByText("GISデータをダウンロード");
      await expect(downloadItem).toBeVisible();
      await downloadItem.click();
      await page.waitForSelector('[role="dialog"]');

      await expect(page.getByText("形式を選んでダウンロード")).toBeVisible();

      // キャンセルで閉じる
      await page.getByRole("button", { name: "close" }).click();
      await page.waitForSelector('[role="dialog"]', { state: "hidden" });
    });

    test("フィルター条件を操作してダウンロードを開始できること", async () => {
      test.skip(!hasData, "名寄せ結果データが存在しません");

      // ダウンロードダイアログを開く
      const actionMenu = page
        .getByRole("button", { name: "アクションメニュー" })
        .first();
      await actionMenu.click();
      await page.waitForTimeout(300);
      await page.getByText("GISデータをダウンロード").click();
      await page.waitForSelector('[role="dialog"]');

      // ダイアログ名（aria-labelledby＝タイトル）でスコープする。
      // hasText だとフィルター節の未選択ラベル「地域を選択してください」と衝突する
      const downloadDialog = page.getByRole("dialog", {
        name: "形式を選んでダウンロード",
      });
      await expect(downloadDialog).toBeVisible();

      // 地域フィルターを操作（地域選択ダイアログで先頭の地域をトグル）。
      // 表・地図ビューでは出力カラム節にも「変更」ボタンがあるため、
      // フィルター節（group）にスコープを絞る
      await downloadDialog
        .getByRole("group", { name: "フィルター", exact: true })
        .getByRole("button", { name: "変更" })
        .click();
      const areaDialog = page.getByRole("dialog", { name: "地域を選択" });
      await expect(areaDialog).toBeVisible();

      // 先頭の地域をトグルし、親再レンダーで巻き戻らないこと（state 同期不具合の回帰確認）。
      // 初期状態（全選択/未選択）に依存しないようトグル後の反対状態を検証する
      const firstArea = areaDialog.getByRole("checkbox").first();
      const before = await firstArea.isChecked();
      await firstArea.click();
      await page.waitForTimeout(500);
      await expect(firstArea).toBeChecked({ checked: !before });

      await areaDialog.getByRole("button", { name: "保存" }).click();
      await expect(areaDialog).toBeHidden();

      // ダウンロード開始 → 準備開始メッセージが表示されること
      await downloadDialog
        .getByRole("button", { name: "ダウンロード準備を開始する" })
        .click();
      await expect(
        page.getByText("ダウンロード準備を開始しました"),
      ).toBeVisible({ timeout: 15000 });

      // ダウンロード開始後もダイアログは開いたまま。閉じずに終わると後続テストが
      // モーダルの裏のビューを操作できないため、ここで閉じる
      await page.keyboard.press("Escape");
      await expect(downloadDialog).toBeHidden();
    });
  });

  test.describe("ビュー削除", () => {
    test("ビューを削除できること", async () => {
      test.skip(!hasData, "名寄せ結果データが存在しません");

      const actionMenu = page
        .getByRole("button", { name: "アクションメニュー" })
        .first();
      await expect(actionMenu).toBeVisible();
      await actionMenu.click();
      await page.waitForTimeout(300);

      const deleteItem = page.getByText("ビューを削除");
      await expect(deleteItem).toBeVisible();
      await deleteItem.click();
      await page.waitForSelector('[role="dialog"]');

      await expect(page.getByText("ビューを削除しますか？")).toBeVisible();

      await page
        .locator('[role="dialog"]')
        .getByRole("button", { name: "削除" })
        .click();
      await page.waitForSelector('[role="dialog"]', { state: "hidden" });
      await page.waitForTimeout(1000);
    });
  });
});
