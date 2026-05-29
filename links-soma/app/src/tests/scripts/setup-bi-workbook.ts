/**
 * 【操作スクリプト】ワークブック・ビュー作成
 *
 * UI経由でワークブック「E2Eテスト用」を作成し、3つのビューを追加・設定する
 *
 * 実行方法:
 * cd app && npm run script -- setup-bi-workbook
 *
 * 前提条件:
 * 1. 名寄せ処理が完了済み（script-run-normalization.ts を先に実行）
 * 2. 空き家推定が完了済み（script-run-estimation.ts を先に実行）
 */

import { test, expect, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import { navigateTo } from "../helpers/navigation-helper";

/** BI操作テスト用ワークブック名 */
const WORKBOOK_NAME = "E2Eテスト用";

/** ビュー定義 */
const VIEW_DEFINITIONS = [
  {
    title: "テスト表ビュー",
    style: "表",
    unit: "建物",
    /** dialog型カラム選択で使用するcheckbox id */
    dialogColumns: ["area_group", "predicted_probability"],
  },
  {
    title: "テスト地図ビュー",
    style: "地図",
    unit: "建物",
    dialogColumns: ["area_group", "predicted_probability"],
  },
  {
    title: "テスト棒グラフ",
    style: "棒グラフ",
    unit: null, // 棒グラフは地域に自動固定
    /** select型カラム選択 */
    selectColumns: {
      X軸: "area_group",
      Y軸: "predicted_probability",
    },
  },
] as const;

let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

// NOTE: 完了後もアプリを開いたままにする（手動確認用）
// test.afterAll は意図的に省略

test("ワークブック「E2Eテスト用」を作成してビューを設定する", async () => {
  test.setTimeout(300000); // 5分タイムアウト

  // === 冪等性チェック: 既存ワークブック確認 ===
  const workbookExists = await page.evaluate(async () => {
    const workbooks = await window.ipcRenderer.invoke("selectWorkbooks");
    return workbooks.some(
      (wb: { title: string | null }) => wb.title === "E2Eテスト用",
    );
  });

  if (workbookExists) {
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(
      "✅ ワークブック「E2Eテスト用」は既に存在します。スキップします。",
    );
    return;
  }

  // === Step 1: ワークブック一覧に遷移 ===
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("📌 Step 1: ワークブック一覧に遷移します");
  await navigateTo(page, "#analysis/workbook");
  await page.waitForTimeout(1000);

  // === Step 2: 新規ワークブック作成 ===
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("📌 Step 2: 新規ワークブックを作成します");
  await page.getByRole("button", { name: "新規ワークブック作成" }).click();
  await page.waitForSelector('[role="dialog"]');

  // ダイアログ内の入力欄に名前を入力
  const dialogInput = page
    .locator('[role="dialog"]')
    .locator('input[type="text"]');
  await dialogInput.fill(WORKBOOK_NAME);

  // 保存ボタンをクリック
  await page
    .locator('[role="dialog"]')
    .getByRole("button", { name: "保存" })
    .click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden" });

  // 編集画面への遷移を待機
  await page.waitForFunction(
    () => window.location.hash.includes("/edit"),
    undefined,
    { timeout: 10000 },
  );
  await page.waitForTimeout(2000);

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("✅ ワークブック作成完了。編集画面に遷移しました。");

  // === Step 3-5: 各ビューを追加・設定 ===
  for (let i = 0; i < VIEW_DEFINITIONS.length; i++) {
    const viewDef = VIEW_DEFINITIONS[i];
    const stepNum = i + 3;

    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(
      `📌 Step ${stepNum}: ビュー「${viewDef.title}」を追加・設定します`,
    );

    // 「ビューを追加」をクリック
    await page.getByRole("button", { name: "ビューを追加" }).click();
    await page.waitForTimeout(2000);

    // サイドバーフォームが表示されるのを待機
    await expect(page.getByText("ビューの設定")).toBeVisible({
      timeout: 10000,
    });

    // --- フォーム設定 ---

    // データセットを選択（最新の推定結果 = 先頭のoption）
    const datasetSelect = page.getByLabel("データセットを選択");
    const firstOption = datasetSelect.locator("option").first();
    const firstValue = await firstOption.getAttribute("value");
    if (firstValue) {
      await datasetSelect.selectOption(firstValue);
      await page.waitForTimeout(300);
    }

    // タイトル入力
    const titleInput = page.getByLabel("ビューのタイトル");
    await titleInput.clear();
    await titleInput.fill(viewDef.title);

    // 種類を選択
    await page.getByLabel("種類").selectOption(viewDef.style);
    await page.waitForTimeout(500);

    // カラム設定（ビュースタイルに応じて分岐）
    if ("dialogColumns" in viewDef) {
      // table / map-with-table: ダイアログ型カラム選択
      // 「設定」fieldset内の「変更」ボタンでカラム選択ダイアログを開く
      // （フィルターセクションにも「変更」ボタンがあるためスコープを絞る）
      const settingsFieldset = page.getByRole("group", {
        name: "設定",
        exact: true,
      });
      await settingsFieldset.getByRole("button", { name: "変更" }).click();
      await page.waitForSelector('[role="dialog"]');

      // まず「すべてクリア」で選択をリセット
      const clearButton = page
        .locator('[role="dialog"]')
        .getByRole("button", { name: "すべてクリア" });
      if (await clearButton.isVisible().catch(() => false)) {
        await clearButton.click();
        await page.waitForTimeout(300);
      }

      // 必要なカラムのチェックボックスをオンにする
      for (const columnId of viewDef.dialogColumns) {
        const checkbox = page.locator(`[role="dialog"] #${columnId}`);
        await checkbox.check();
      }

      // ダイアログの「保存」ボタンをクリック
      await page
        .locator('[role="dialog"]')
        .getByRole("button", { name: "保存" })
        .click();
      await page.waitForSelector('[role="dialog"]', { state: "hidden" });
      await page.waitForTimeout(300);
    } else if ("selectColumns" in viewDef) {
      // bar / line / pie: select型カラム選択
      for (const [label, value] of Object.entries(viewDef.selectColumns)) {
        await page.getByLabel(label, { exact: true }).selectOption(value);
        await page.waitForTimeout(300);
      }
    }

    // 集計単位を設定（棒グラフは自動で地域固定なのでスキップ）
    if (viewDef.unit !== null) {
      await page.getByLabel("集計単位").selectOption(viewDef.unit);
      await page.waitForTimeout(300);
    }

    // 「入力内容を保存する」をクリック
    await page.getByRole("button", { name: "入力内容を保存する" }).click();
    await expect(page.getByText("保存が完了しました")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(1000);

    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(`✅ ビュー「${viewDef.title}」の設定が完了しました`);
  }

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log(
    "✅ 全ビューの設定が完了しました。BI操作テスト（npm run e2e -- bi-operations）を実行できます。",
  );
});
