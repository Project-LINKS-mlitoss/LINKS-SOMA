/**
 * データ未選択での名寄せエラーハンドリングE2Eテスト
 *
 * ウィザードで一切のデータを選択せずに名寄せ処理を開始し、
 * ジョブがエラーで終了することを確認する。
 *
 * 検証内容:
 * 1. データ未選択のまま確認画面に到達し「開始する」をクリックできること
 * 2. ジョブが作成され、エラーステータスで終了すること
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-empty-input
 *
 * 前提条件:
 * 1. Pythonバイナリがビルド済み（cd ml && npm run build）
 *
 * 所要時間: 1-2分
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import { startNormalizationWizard } from "../../helpers/wizard-operations";
import { waitForJobCompletion } from "../../helpers/job-operations";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe("データ未選択での名寄せエラーハンドリング", () => {
  test("データ未選択で名寄せを開始するとエラーで終了すること", async () => {
    test.setTimeout(120000);

    await startNormalizationWizard(page);

    // イントロ → 次へ
    await page.getByRole("button", { name: "次へ" }).click();
    await page.waitForTimeout(500);

    // 基本設定: 市区町村名を入力（必須項目のためスキップ不可）
    await page.getByPlaceholder("市区町村名を入力").fill("テスト市");
    await page.getByRole("button", { name: "次へ" }).click();
    await page.waitForTimeout(500);

    // 各ステップでデータ未選択のまま「次へ」で進む
    for (let i = 0; i < 11; i++) {
      const startButton = page.getByRole("button", { name: "開始する" });
      if (await startButton.isVisible({ timeout: 500 }).catch(() => false)) {
        break;
      }

      // スキップチェックボックスがあればチェック
      const skipCheckbox = page.getByLabel("このステップをスキップする");
      if (await skipCheckbox.isVisible({ timeout: 300 }).catch(() => false)) {
        if (!(await skipCheckbox.isChecked())) {
          await skipCheckbox.check();
        }
      }

      await page.getByRole("button", { name: "次へ" }).click();
      await page.waitForTimeout(500);
    }

    // 確認画面で「開始する」をクリック
    const startButton = page.getByRole("button", { name: "開始する" });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // ジョブが開始される
    await expect(page.getByText("データ名寄せ処理を開始しました")).toBeVisible({
      timeout: 30000,
    });

    // 「処理のステータスを確認」で名寄せ一覧に遷移
    await page.getByRole("button", { name: "処理のステータスを確認" }).click();
    await page.waitForFunction(
      () => window.location.hash.includes("normalization"),
      { timeout: 10000 },
    );

    // ジョブがエラーで終了するまでポーリング
    const finalStatus = await waitForJobCompletion(page, {
      maxWait: 60000,
      interval: 5000,
      label: "名寄せ（データ未選択）",
    });

    // データ未選択のため、エラーで終了すること
    expect(finalStatus).toBe("error");
  });

  test("エラーメッセージが詳細画面に表示されること", async () => {
    test.setTimeout(30000);

    // エラーになったジョブの詳細画面に遷移
    const errorRow = page.locator("table tbody tr").first();
    await errorRow.click();
    await page.waitForFunction(
      () => window.location.hash.includes("job/detail"),
      { timeout: 10000 },
    );
    await page.waitForTimeout(2000);

    // ERROR_00051のメッセージがUIに表示されること
    await expect(
      page.getByText("処理に必要なファイルが選択されていません"),
    ).toBeVisible({ timeout: 10000 });
  });
});
