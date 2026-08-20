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
import {
  startNormalizationWizard,
  clickNext,
} from "../../helpers/wizard-operations";

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

  test("「名寄せ処理から始める」ボタンが表示されること", async () => {
    await expect(
      page.getByRole("button", { name: "名寄せ処理から始める" }),
    ).toBeVisible();
  });

  test("処理一覧セクションが表示されること", async () => {
    // 処理一覧の見出しが表示される（サイドバーのリンクと区別するためh4を指定）
    await expect(page.getByRole("heading", { name: "処理一覧" })).toBeVisible();

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
      page.getByText("名寄せ処理済データから選択"),
    ).toBeVisible();

    // ② 説明変数選択セクション
    await expect(page.getByText("説明変数に使うカラムの選択")).toBeVisible();

    // ハイパーパラメータは固定値のため、変更UIを持たない
    await expect(
      page.getByRole("button", { name: "高度な設定を変更" }),
    ).toHaveCount(0);

    // モデル構築開始ボタン
    await expect(
      page.getByRole("button", { name: "モデル構築開始" }),
    ).toBeVisible();
  });

  test("必須未選択でモデル構築開始するとインライン検証でブロックされること（PV-17）", async () => {
    // 直前テストで /model/create に居る。何も選択せずモデル構築開始を押す。
    await page.getByRole("button", { name: "モデル構築開始" }).click();

    // 必須選択の検証メッセージが表示される（lang: model/create.validation）
    await expect(
      page.getByText("名寄せ処理済データを選択してください"),
    ).toBeVisible({ timeout: 5000 });

    // 送信されず作成画面に留まる
    expect(page.url()).toContain("/model/create");
  });

  test("「名寄せ処理から始める」でAIモデル構築選択済みの名寄せ画面へ遷移すること", async () => {
    await navigateTo(page, "#model");
    await page.getByRole("button", { name: "名寄せ処理から始める" }).click();

    // 下書きがある場合は確認ダイアログ（新規開始専用）。新規作成で進む。
    const draftDialog = page.getByRole("heading", { name: "下書きがあります" });
    if (await draftDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.getByRole("button", { name: "新規作成" }).click();
    }
    await page.waitForTimeout(1000);

    // 名寄せ作成画面へ、目的=model_training を引き継いで遷移
    expect(page.url()).toContain("/normalization/create");
    expect(page.url()).toContain("purpose=model_training");

    // intro の「AIモデル構築用の名寄せ処理」カードが選択済み
    const customCard = page
      .getByRole("radio")
      .filter({ hasText: "AIモデル構築用の名寄せ処理" });
    await expect(customCard).toHaveAttribute("aria-checked", "true");
  });

  test("下書きがあると確認ダイアログを表示し、続けるは出さず新規作成/キャンセルのみ提示すること", async () => {
    // 下書きを1件用意する（intro→次へ で createDraftJob が走る）。
    await startNormalizationWizard(page);
    await clickNext(page);

    // モデル構築画面の導線から開始
    await navigateTo(page, "#model");
    await page.getByRole("button", { name: "名寄せ処理から始める" }).click();

    // 確認ダイアログ（新規開始専用）。続ける（再開）は出さない。
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "下書きがあります" }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "続ける" })).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "キャンセル" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "新規作成" }),
    ).toBeVisible();

    // キャンセルで閉じ、作成画面へは進まない（名寄せ一覧に留まる）。
    await dialog.getByRole("button", { name: "キャンセル" }).click();
    await expect(dialog).toBeHidden();
    expect(page.url()).not.toContain("/normalization/create");

    // 再度導線→新規作成で下書きを削除し、AIモデル構築用の名寄せへ進む。
    await navigateTo(page, "#model");
    await page.getByRole("button", { name: "名寄せ処理から始める" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "新規作成" })
      .click();
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/normalization/create");
    expect(page.url()).toContain("purpose=model_training");
  });
});
