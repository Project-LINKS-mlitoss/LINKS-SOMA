/**
 * 名寄せ必須選択ゲート E2Eテスト（PV-17・止める方針）
 *
 * 必須入力の有無を送信時に zod で検証し、未充足ならジョブを開始せずブロックする。
 * 境界の両側（未充足=ブロック / 充足=開始）を検証する。
 *
 * 検証内容:
 * - 異常系: 必須データセット未選択で「開始する」→ 送信前にブロック。検証表示が出て
 *   ジョブは開始されない（押下時フィードバック）。
 * - 正常系: 必須を満たして「開始する」→ ブロックされずジョブが開始する（完了は待たない）。
 *
 * 旧仕様（ジョブを開始させ Python が ERROR_00051 で落とす）からの意図的な変更。
 * フロントの必須選択ゲートで送信前に止める（docs/spec/pre-validation.md）。
 * Python 側の ERROR_00051 はバックエンド防御として pytest が別途担保する。
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-required-gate
 *
 * 所要時間: 1分以内（パイプライン完了は待たないため ML バイナリ不要）
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

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe("名寄せ必須選択ゲート（PV-17）", () => {
  test("必須データセット未選択で開始すると送信前にブロックされること", async () => {
    test.setTimeout(120000);

    await startNormalizationWizard(page);

    // イントロ → 次へ
    await page.getByRole("button", { name: "次へ" }).click();
    await page.waitForTimeout(500);

    // 基本設定: 市区町村名を入力（市区町村名は別の必須項目。データセット側の
    // 未充足だけを検証対象にするため、ここは満たしておく）
    await page.getByPlaceholder("市区町村名を入力").fill("テスト市");
    await page.getByRole("button", { name: "次へ" }).click();
    await page.waitForTimeout(500);

    // 各データセットステップを未選択のまま「次へ」で進む（任意はスキップ）
    for (let i = 0; i < 11; i++) {
      const startButton = page.getByRole("button", { name: "開始する" });
      if (await startButton.isVisible({ timeout: 500 }).catch(() => false)) {
        break;
      }

      const skipCheckbox = page.getByLabel("このステップをスキップする");
      if (await skipCheckbox.isVisible({ timeout: 300 }).catch(() => false)) {
        if (!(await skipCheckbox.isChecked())) {
          await skipCheckbox.check();
        }
      }

      await page.getByRole("button", { name: "次へ" }).click();
      await page.waitForTimeout(500);
    }

    const startButton = page.getByRole("button", { name: "開始する" });
    await expect(startButton).toBeVisible();

    // 押下前: 検証表示は出ていない（押下時フィードバック方式）
    await expect(page.getByText("必須項目が未設定です")).toBeHidden();

    // 「開始する」を押す → 押下後に検証表示が出る
    await startButton.click();
    await expect(page.getByText("必須項目が未設定です")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("未設定（必須）").first()).toBeVisible();

    // ジョブは開始されない（トーストが出ない）。確認画面に留まる
    await expect(
      page.getByText("データ名寄せ処理を開始しました"),
    ).toBeHidden();
    await expect(startButton).toBeVisible();
  });

  test("必須を満たせば開始でジョブが開始すること（完了は待たない）", async () => {
    test.setTimeout(180000);

    await startNormalizationWizard(page);
    // 既定: vacancy_estimation・市区町村名+必須3データセットを充足
    await walkWizard(page);

    const startButton = page.getByRole("button", { name: "開始する" });
    await expect(startButton).toBeVisible();
    await startButton.click();

    // 必須充足のためブロックされず、開始トーストが出る
    await expect(
      page.getByText("データ名寄せ処理を開始しました"),
    ).toBeVisible({ timeout: 30000 });
  });
});
