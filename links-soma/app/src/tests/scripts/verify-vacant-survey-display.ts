/**
 * 【操作スクリプト】空き家調査結果由来カラムの画面表示確認
 *
 * 名寄せで空き家調査結果を結合すると生成される5カラム
 * （is_vacant / vacant_type / vacant_source / vacant_year / address_precision_flag）が、
 * 分析画面のテーブルビューに日本語ラベル付きで描画され、値が推定結果データと一致することを確認する。
 *
 * 期待値は推定結果データ自体から算出して比較する（フィクスチャの件数に依存しない）。
 * 検証対象は「DBの値が画面に正しく出るか」であり、DBの値そのものの正しさではない。
 *
 * 地図ポップアップの表示は WebGL を要するため本スクリプトでは扱わない。
 * 表示文言（is_vacant 1→「空き家」、address_precision_flag 1→「該当」等）は
 * popup-utils.test.ts で検証する。
 *
 * 実行方法:
 * cd app && npm run script -- verify-vacant-survey-display
 *
 * 前提条件:
 * 1. 空き家調査結果を付与した名寄せが完了（npm run script -- run-normalization）
 * 2. 空き家推定が完了し推定結果データが存在する（npm run script -- run-estimation）
 */

import { test, expect, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import { navigateTo } from "../helpers/navigation-helper";

/** 検証するカラムと分析画面での表示ラベル（column-translations.json の building と一致させる） */
const SURVEY_COLUMNS = [
  { key: "is_vacant", label: "空き家" },
  { key: "vacant_type", label: "空き家区分" },
  { key: "vacant_source", label: "空き家調査元" },
  { key: "vacant_year", label: "空き家調査年度" },
  { key: "address_precision_flag", label: "調査住所精度不足フラグ" },
] as const;

/** boolean 型として表示され、1 が ○ / 0 が × になるカラム */
const BOOLEAN_COLUMNS = new Set(["is_vacant", "address_precision_flag"]);

/** 行の同定に使うカラムの表示ラベル */
const ADDRESS_LABEL = "正規化住所";

/** 検証用に作る（再実行時は上書きする）ビューのタイトル */
const VIEW_TITLE = "空き家調査結果カラム確認";

let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

test("空き家調査結果の5カラムが分析画面のテーブルに表示される", async () => {
  test.setTimeout(300000);

  const columnKeys = SURVEY_COLUMNS.map((column) => column.key);

  // === Step 1: ワークブック・シート・ビューを IPC で用意し、期待値をDBから算出する ===
  const setup = await page.evaluate(
    async ({ keys, viewTitle }) => {
      const results = await window.ipcRenderer.invoke("selectDataSetResults");
      const dataSetResultId = results[0]?.id;
      if (dataSetResultId === undefined) {
        throw new Error("推定結果データがありません");
      }

      const fallbackTitle = "空き家調査結果カラム表示確認";
      const workbooks = await window.ipcRenderer.invoke("selectWorkbooks");
      let workbookId: number | undefined = workbooks[0]?.id;
      let workbookTitle: string = workbooks[0]?.title ?? fallbackTitle;
      if (workbookId === undefined) {
        const created = await window.ipcRenderer.invoke("createWorkbooks", {
          title: fallbackTitle,
        });
        workbookId = Number(created.id);
        workbookTitle = fallbackTitle;
      }

      const sheets = await window.ipcRenderer.invoke("selectResultSheets", {
        workbookId,
      });
      const sheetId = sheets[0]?.id;
      if (sheetId === undefined) {
        throw new Error("シートが見つかりません");
      }

      // 地図ビューは実行環境の WebGL 制約で開けないため、テーブル単体のビューを作る。
      // 再実行でビューが増えないよう、同名のビューがあれば作り直さず上書きする
      const views = await window.ipcRenderer.invoke("selectResultViews", {
        sheetId,
      });
      const existing = views.find(
        (view: { title: string | null }) => view.title === viewTitle,
      );

      const viewId =
        existing?.id ??
        (
          await window.ipcRenderer.invoke("insertResultViews", {
            sheet_id: sheetId,
            data_set_result_id: dataSetResultId,
            layoutIndex: 1,
            title: "",
            parameters: [],
          })
        ).insertedId;

      await window.ipcRenderer.invoke("updateResultViews", {
        resultViewId: viewId,
        value: {
          data_set_result_id: dataSetResultId,
          title: viewTitle,
          unit: "building",
          style: "table",
          parameters: [
            {
              key: "columns",
              type: "column",
              value: ["normalized_address", ...keys].join(","),
            },
          ],
        },
      });

      // 期待値を推定結果データ全件から作る。画面とDBで行の並び順が同じとは限らないため、
      // 件数ではなく正規化住所をキーにした行単位の突合にする
      const { data, totalCount } = await window.ipcRenderer.invoke(
        "selectBuildingsWithPagination",
        { dataSetResultId, page: 1, limitPerPage: 100000 },
      );

      const rows = data as Record<string, unknown>[];
      const expectedByAddress: Record<string, Record<string, unknown>> = {};
      for (const row of rows) {
        const address = String(row.normalized_address ?? "");
        if (address === "") continue;
        const picked: Record<string, unknown> = {};
        for (const key of keys) picked[key] = row[key];
        expectedByAddress[address] = picked;
      }

      return {
        workbookTitle,
        expectedByAddress,
        rowCount: rows.length,
        totalCount: totalCount as number,
      };
    },
    { keys: columnKeys, viewTitle: VIEW_TITLE },
  );

  expect(setup.rowCount).toBe(setup.totalCount);

  // === Step 2: 分析画面を開く ===
  await navigateTo(page, "#analysis/workbook");
  const workbookLink = page.getByText(setup.workbookTitle).first();
  await expect(workbookLink).toBeVisible({ timeout: 30000 });
  await workbookLink.click();
  await page.waitForTimeout(3000);

  // === Step 3: 5カラムのヘッダーが日本語ラベルで描画されること ===
  // ヘッダーセルは th > div[role=presentation] 構造でアクセシブル名を持たないため、テキストで探す
  const headerCells = page.locator("table thead th");
  await expect(headerCells.first()).toBeVisible({ timeout: 30000 });
  const headers = (await headerCells.allInnerTexts()).map((text) =>
    text.trim(),
  );

  const addressIndex = headers.indexOf(ADDRESS_LABEL) + 1;
  expect(
    addressIndex,
    `ヘッダーに「${ADDRESS_LABEL}」がない: ${headers.join(" / ")}`,
  ).toBeGreaterThan(0);

  const columnIndexes = SURVEY_COLUMNS.map((column) => {
    const index = headers.indexOf(column.label) + 1;
    expect(
      index,
      `ヘッダーに「${column.label}」がない: ${headers.join(" / ")}`,
    ).toBeGreaterThan(0);
    return index;
  });

  // === Step 4: 各行の値が推定結果データと一致すること ===
  const cellText = async (columnIndex: number): Promise<string[]> =>
    (
      await page
        .locator(`table tbody tr td:nth-child(${columnIndex})`)
        .allInnerTexts()
    ).map((text) => text.trim());

  const addresses = await cellText(addressIndex);
  expect(addresses.length).toBeGreaterThan(0);

  const rendered = await Promise.all(columnIndexes.map(cellText));

  /** DB の値が画面にどう出るか（boolean は formatTableValue で ○ / ×） */
  const toDisplay = (key: string, value: unknown): string => {
    if (value === null || value === undefined) return "";
    if (BOOLEAN_COLUMNS.has(key)) return value === 1 ? "○" : "×";
    return String(value);
  };

  let comparedVacantRows = 0;
  for (const [rowIndex, address] of addresses.entries()) {
    const expectedRow = setup.expectedByAddress[address];
    expect(
      expectedRow,
      `推定結果に存在しない住所が描画された: ${address}`,
    ).toBeDefined();

    SURVEY_COLUMNS.forEach((column, columnPosition) => {
      expect(
        rendered[columnPosition][rowIndex],
        `${address} の「${column.label}」が推定結果と一致しない`,
      ).toBe(toDisplay(column.key, expectedRow[column.key]));
    });

    if (expectedRow.is_vacant === 1) comparedVacantRows += 1;
  }

  // 空き家調査でマッチした行を1件も含まないと、値の突合が実質的に成立しない
  expect(
    comparedVacantRows,
    "描画された行に is_vacant=1 が1件も含まれていない",
  ).toBeGreaterThan(0);

  // eslint-disable-next-line no-console -- 操作スクリプトの結果表示
  console.log(
    `✅ 描画行 ${addresses.length}（住所 ${new Set(addresses).size} 件・` +
      `うち is_vacant=1 は ${new Set(addresses.filter((_, index) => rendered[0][index] === "○")).size} 件）を` +
      `推定結果と突合。推定結果データ全体は ${setup.totalCount} 件`,
  );
});
