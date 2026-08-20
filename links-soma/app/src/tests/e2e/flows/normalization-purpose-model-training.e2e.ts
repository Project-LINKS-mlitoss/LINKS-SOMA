/**
 * 名寄せの目的「AIモデル構築」の分岐テスト
 *
 * 目的で AIモデル構築を選ぶと、空き家調査結果が必須化され必須ブロックに繰り上がる。
 * 確認画面まで遷移し、目的表示と空き家調査結果の必須化を検証する（パイプラインは実行しない）。
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-purpose-model-training
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

test.describe("AIモデル構築（目的）の名寄せ", () => {
  test("目的選択で空き家調査結果が必須化され、確認画面まで到達する", async () => {
    test.setTimeout(180000);

    await startNormalizationWizard(page);
    await walkWizard(page, {
      purpose: "model_training",
      // 任意データはスキップして最小構成で確認画面まで進む。
      geocoding: "skip",
      buildingRegistry: "skip",
      buildingTypeDetermination: "skip",
    });

    // 確認画面に到達
    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

    // 目的が AIモデル構築として表示される（基本設定の目的行）
    const purposeRow = page.getByText("目的", { exact: true });
    await expect(purposeRow.locator("..")).toContainText("AIモデル構築");

    // 空き家調査結果が必須として表示される（AIモデル構築の分岐）
    const vacantHouseLabel = page.getByText("空き家調査結果", { exact: true });
    await expect(vacantHouseLabel.locator("..")).toContainText("必須");

    // 必須項目（空き家調査結果を含む）が全て設定済みのため、未設定警告は出ない
    await expect(page.getByText("必須項目が未設定です")).toHaveCount(0);
  });
});
