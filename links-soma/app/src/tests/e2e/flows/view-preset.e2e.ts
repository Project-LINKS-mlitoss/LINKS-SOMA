/**
 * ビュープリセット適用フローE2E（FR021 要件 #1-3、Tier 2: 要データ）。
 *
 * シード済みワークブック「E2Eテスト用」の編集画面で「ビューを追加」→プリセット選択→
 * データ選択（2ステップ）を実行し、result_views が増えることを確認する。
 * 検証後は挿入分を削除して冪等に戻す。
 *
 * 前提: run-normalization → run-estimation → setup-bi-workbook 実行済み。
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";

const WORKBOOK_NAME = "E2Eテスト用";

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

test("プリセットからビュー群を追加すると result_views が増える", async () => {
  // シード済みワークブック + シート + 既存ビュー一覧を取得（無ければスキップ）。
  const ctx = await page.evaluate(async (name) => {
    const wbs = (await window.ipcRenderer.invoke("selectWorkbooks")) as {
      id: number;
      title: string | null;
    }[];
    const wb = wbs.find((w) => w.title === name);
    if (!wb) return null;
    const sheets = (await window.ipcRenderer.invoke("selectResultSheets", {
      workbookId: wb.id,
    })) as { id: number }[];
    const sheet = sheets[0];
    if (!sheet) return null;
    const before = (await window.ipcRenderer.invoke("selectResultViews", {
      sheetId: sheet.id,
    })) as { id: number }[];
    return {
      workbookId: wb.id,
      sheetId: sheet.id,
      beforeIds: before.map((v) => v.id),
    };
  }, WORKBOOK_NAME);

  if (!ctx) {
    test.skip(true, "シード済みワークブック「E2Eテスト用」が存在しません");
    return;
  }

  // 編集画面へ直接遷移（sheetId 必須）。
  await page.evaluate(({ workbookId, sheetId }) => {
    window.location.hash = `#/analysis/workbook/${workbookId}/edit?sheetId=${sheetId}`;
  }, ctx);
  await page.waitForFunction(
    ({ workbookId }) =>
      window.location.hash.includes(`workbook/${workbookId}/edit`),
    ctx,
    { timeout: 10000 },
  );

  // 「ビューを追加」ダイアログを開く（Step1: 何を追加するか）。
  await page.getByRole("button", { name: "ビューを追加" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("ビューを追加", { exact: true })).toBeVisible({
    timeout: 10000,
  });

  // Step1 はカードグリッド（role=radio）。先頭は「空から作る」、その次が先頭プリセット。
  await dialog.getByRole("radio").nth(1).click();
  await dialog.getByRole("button", { name: "次へ" }).click();

  // Step2: 既存踏襲の Select でデータを選んで適用（先頭は初期選択済み）。
  await expect(dialog.getByText("データを選択")).toBeVisible({
    timeout: 10000,
  });
  await dialog.locator("select").selectOption({ index: 0 });
  // 選んだデータ ID を捕捉（要件 R2: ビュー群が「選んだ」推定結果データに束ねられること）。
  const selectedDataId = Number(await dialog.locator("select").inputValue());
  await dialog.getByRole("button", { name: "追加する" }).click();

  // ダイアログが閉じ、ビューが増えている。
  await expect(dialog).toBeHidden({ timeout: 10000 });
  const after = await page.evaluate(async (sheetId) => {
    const views = (await window.ipcRenderer.invoke("selectResultViews", {
      sheetId,
    })) as { id: number; data_set_result_id: number | null }[];
    return views.map((v) => ({
      id: v.id,
      dataSetResultId: v.data_set_result_id,
    }));
  }, ctx.sheetId);
  const afterIds = after.map((v) => v.id);
  expect(afterIds.length).toBeGreaterThan(ctx.beforeIds.length);

  // 追加された各ビューが「選択したデータ」に束ねられている（count増加だけでなく束ね先を検証）。
  const newViews = after.filter((v) => !ctx.beforeIds.includes(v.id));
  expect(newViews.length).toBeGreaterThan(0);
  for (const view of newViews) {
    expect(view.dataSetResultId).toBe(selectedDataId);
  }

  // クリーンアップ: 挿入分を削除してシードを元に戻す（冪等化）。
  const newIds = newViews.map((v) => v.id);
  await page.evaluate(
    async ({ ids, sheetId }) => {
      for (const id of ids) {
        await window.ipcRenderer.invoke("deleteResultView", {
          resultViewId: id,
          sheetId,
        });
      }
    },
    { ids: newIds, sheetId: ctx.sheetId },
  );
});
