/**
 * ダウンロードダイアログ 入れ子ダイアログの選択状態保持（回帰テスト）
 *
 * #1878 / PR #1885。ダウンロードダイアログ内の地域/カラム/詳細条件ダイアログで
 * チェックを入れた直後に親フォームの再レンダーで選択が巻き戻る不具合の回帰防止。
 * props→state 同期 useEffect を値ベースにしたことを検証する。
 *
 * 既存 demo ワークブックの表ビューに対し非破壊で操作する（保存・DL・削除はしない）。
 *
 * 実行: cd app && npm run e2e -- download-dialog
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
  type Locator,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import { navigateTo } from "../../helpers/navigation-helper";

let electronApp: ElectronApplication;
let page: Page;
let hasDemo = true;

test.describe.configure({ mode: "serial" });
test.setTimeout(120000);

/** demo ワークブックの表ビューカードのタイトル（出力カラム節を持つ table スタイル） */
const TABLE_VIEW_TITLE = "地域別一覧";

/**
 * demo ワークブックの表ビューのダウンロードダイアログを開く。
 * ビューカード（Fluent Card）をタイトルでスコープしてからアクションメニューを押す。
 * 位置（nth）依存はビュー順序変更で別ビューを誤操作するため避ける。
 */
async function openDownloadDialogForTableView(): Promise<Locator> {
  const tableCard = page
    .locator(".fui-Card")
    .filter({ hasText: TABLE_VIEW_TITLE });
  const actionMenu = tableCard.getByRole("button", {
    name: "アクションメニュー",
  });
  await expect(actionMenu).toBeVisible({ timeout: 30000 });
  await actionMenu.click();
  await page.waitForTimeout(300);
  await page.getByText("GISデータをダウンロード").click();
  await page.waitForSelector('[role="dialog"]');

  const downloadDialog = page.getByRole("dialog", {
    name: "形式を選んでダウンロード",
  });
  await expect(downloadDialog).toBeVisible();
  return downloadDialog;
}

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());

  const demoExists = await page.evaluate(async () => {
    const workbooks = await window.ipcRenderer.invoke("selectWorkbooks");
    return workbooks.some(
      (wb: { title: string | null }) => wb.title === "demo",
    );
  });
  if (!demoExists) {
    hasDemo = false;
    return;
  }

  await navigateTo(page, "#analysis/workbook");
  await page.waitForTimeout(1000);
  await page.getByText("demo", { exact: true }).first().click();
  await page.waitForTimeout(2000);
});

test.afterAll(async () => {
  await electronApp.close();
});

test("地域ダイアログでチェックが保持されること", async () => {
  test.skip(!hasDemo, "demo ワークブックが存在しません");
  const downloadDialog = await openDownloadDialogForTableView();

  await downloadDialog
    .getByRole("group", { name: "フィルター", exact: true })
    .getByRole("button", { name: "変更" })
    .click();
  const areaDialog = page.getByRole("dialog", { name: "地域を選択" });
  await expect(areaDialog).toBeVisible();

  // 先頭チェックボックスをトグルし、その状態が親再レンダーで巻き戻らないこと。
  // 全選択済み/未選択どちらの初期状態でも成立するようトグル後の反対状態を検証する
  const firstArea = areaDialog.getByRole("checkbox").first();
  const before = await firstArea.isChecked();
  await firstArea.click();
  await page.waitForTimeout(700);
  await expect(firstArea).toBeChecked({ checked: !before });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await downloadDialog.getByRole("button", { name: "close" }).click();
  await page.waitForTimeout(500);
});

test("カラムダイアログでチェックが保持されること", async () => {
  test.skip(!hasDemo, "demo ワークブックが存在しません");
  const downloadDialog = await openDownloadDialogForTableView();

  await downloadDialog
    .getByRole("group", { name: "出力カラム", exact: true })
    .getByRole("button", { name: "変更" })
    .click();
  const columnDialog = page.getByRole("dialog", { name: "カラムを選択" });
  await expect(columnDialog).toBeVisible();

  // 未チェックの項目を 1 つ ON にする
  const checkboxes = columnDialog.getByRole("checkbox");
  const count = await checkboxes.count();
  let target: Locator | null = null;
  for (let i = 0; i < count; i++) {
    const cb = checkboxes.nth(i);
    if (!(await cb.isChecked())) {
      target = cb;
      break;
    }
  }
  if (!target) throw new Error("未チェックのカラムが見つかりません");
  await target.click();
  await page.waitForTimeout(700);
  await expect(target).toBeChecked();

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await downloadDialog.getByRole("button", { name: "close" }).click();
  await page.waitForTimeout(500);
});

test("詳細条件の最深部カラム選択でチェックが保持されること", async () => {
  test.skip(!hasDemo, "demo ワークブックが存在しません");
  const downloadDialog = await openDownloadDialogForTableView();

  // 詳細条件を追加 → 次の条件でフィルター
  await downloadDialog
    .getByRole("button", { name: /詳細条件を(追加|編集)/ })
    .click();
  const condDialog = page.getByRole("dialog", {
    name: "次の条件でフィルター",
  });
  await expect(condDialog).toBeVisible();

  // フィルターを追加 → カラムを選択（最深部）
  await condDialog
    .getByRole("button", { name: "フィルターを追加" })
    .first()
    .click();
  const colSelectDialog = page.getByRole("dialog", { name: "カラムを選択" });
  await expect(colSelectDialog).toBeVisible();

  const firstCol = colSelectDialog.getByRole("checkbox").first();
  const before = await firstCol.isChecked();
  await firstCol.click();
  await page.waitForTimeout(700);
  await expect(firstCol).toBeChecked({ checked: !before });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
});
