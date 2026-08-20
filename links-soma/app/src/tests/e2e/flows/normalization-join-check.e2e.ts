/**
 * 住所の表記ゆれチェックダイアログ表示テスト
 *
 * 名寄せウィザードの確認画面から住所の表記ゆれチェックダイアログを開き、
 * UI要素が正しく表示されることを検証する
 *
 * 実行方法:
 * E2E_DEV_MODE=true npx playwright test flow-normalization-join-check
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import {
  startNormalizationWizard,
  walkWizard,
} from "../../helpers/wizard-operations";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });
test.setTimeout(120000);

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe("住所の表記ゆれチェックダイアログ", () => {
  test("確認画面まで遷移する", async () => {
    test.setTimeout(180000);

    await startNormalizationWizard(page);
    // 空き家調査結果・建物関連データも選択し、表記ゆれチェック対象に含める（#1775 PR2）
    await walkWizard(page, {
      vacantHouse: "select",
      optionalDataSource: "select",
    });

    // 確認画面に到達
    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "住所の表記ゆれチェック" }),
    ).toBeVisible();
  });

  test("住所の表記ゆれチェックダイアログが正しく表示される", async () => {
    // 「住所の表記ゆれチェック」ボタンをクリック
    await page.getByRole("button", { name: "住所の表記ゆれチェック" }).click();
    await page.waitForSelector('[role="dialog"]');

    // ダイアログタイトルと説明文を確認
    await expect(
      page.getByRole("heading", { name: "住所の表記ゆれチェック" }),
    ).toBeVisible();
    await expect(
      page.getByText("水道データに存在しない住所を抽出します"),
    ).toBeVisible();

    // チェックボックスが表示されていることを確認（設定済みデータセット）
    const dialog = page.locator('[role="dialog"]');
    await expect(
      dialog.getByText("住民基本台帳", { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByText("登記情報", { exact: true })).toBeVisible();
    await expect(
      dialog.getByText("ジオコーディング", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("処理対象選定用データ", { exact: true }),
    ).toBeVisible();
    // #1775 PR2 で追加した2データもチェック対象として表示される
    await expect(
      dialog.getByText("空き家調査結果", { exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByText("建物関連データ", { exact: true }),
    ).toBeVisible();

    // 「チェック実行」ボタンが有効であることを確認
    const executeButton = page.getByRole("button", { name: "チェック実行" });
    await expect(executeButton).toBeVisible();
    await expect(executeButton).toBeEnabled();

    // 「キャンセル」ボタンが表示されていることを確認
    await expect(
      page.getByRole("button", { name: "キャンセル" }),
    ).toBeVisible();

    // キャンセルしてダイアログを閉じる
    await page.getByRole("button", { name: "キャンセル" }).click();
    await page.waitForSelector('[role="dialog"]', { state: "hidden" });
  });

  test("チェック実行→完了まで処理が進み、結果が表示される", async () => {
    test.setTimeout(300000); // 最大5分（IF005処理時間: 1〜5分）

    // ダイアログを再度開く
    await page.getByRole("button", { name: "住所の表記ゆれチェック" }).click();
    await page.waitForSelector('[role="dialog"]');

    // チェック実行
    await page.getByRole("button", { name: "チェック実行" }).click();

    // ポーリング中の進捗表示を確認
    await expect(
      page.getByText("住所の表記ゆれチェックを実行しています"),
    ).toBeVisible({ timeout: 10000 });

    // 全件完了まで待機（「閉じる」ボタンが表示されたら完了）
    await expect(page.getByRole("button", { name: "閉じる" })).toBeVisible({
      timeout: 300000,
    });

    // 結果画面の構造を検証
    const dialog = page.locator('[role="dialog"]');

    // データ種別ごとの結果が表示されている
    await expect(
      dialog.getByText("住民基本台帳", { exact: true }),
    ).toBeVisible();

    // 注釈が表示されている
    await expect(
      dialog.getByText("住所の表記ゆれを確認するための参考情報です"),
    ).toBeVisible();

    // 「再実行」ボタンが表示されている
    await expect(page.getByRole("button", { name: "再実行" })).toBeVisible();
  });

  test("結果にゆれ候補がある場合、展開して詳細を確認できる", async () => {
    const dialog = page.locator('[role="dialog"]');

    // 表記ゆれの可能性がある住所セクションが展開されているか確認
    // （最初の候補ありアイテムは自動展開される）
    // テーブルヘッダーは展開セクション内にのみ存在する
    const tableHeader = dialog.locator("th", {
      hasText: "水道データに存在しない住所",
    });
    const hasExpandedResults = await tableHeader
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasExpandedResults) {
      // テーブルヘッダーが表示されている
      await expect(tableHeader).toBeVisible();
      await expect(
        dialog.locator("th", { hasText: "水道データの類似住所" }),
      ).toBeVisible();

      // CSVダウンロードボタンが表示されている
      await expect(
        dialog.getByRole("button", { name: "CSVダウンロード" }),
      ).toBeVisible();
    }
    // ゆれ候補がない場合もテストはpassする（データ依存のため）

    // ダイアログを閉じる
    await page.getByRole("button", { name: "閉じる" }).click();
    await page.waitForSelector('[role="dialog"]', { state: "hidden" });
  });
});
