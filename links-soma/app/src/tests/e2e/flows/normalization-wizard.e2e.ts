/**
 * 名寄せウィザード全ステップフロー
 *
 * 確認画面まで進める（実行はしない）
 * 完了後もアプリは開いたまま（手動確認用）
 *
 * 実行方法:
 * E2E_DEV_MODE=true npx playwright test flow-normalization-wizard
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
test.setTimeout(60000);

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe("名寄せウィザード", () => {
  test("アプリが正常に起動すること", async () => {
    const title = await page.title();
    expect(title).toBe("LINKS SOMA　空き家推定システム");
  });

  test("名寄せ作成画面に遷移できること", async () => {
    await startNormalizationWizard(page);
  });

  test("全ステップを進めて確認画面に到達すること", async () => {
    test.setTimeout(180000);

    await walkWizard(page, {
      vacantHouse: "select",
    });

    // 確認画面が表示されることを確認
    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "住所の表記ゆれチェック" }),
    ).toBeVisible();
  });
});
