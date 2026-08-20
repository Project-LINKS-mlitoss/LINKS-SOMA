/**
 * 複数年ビュープリセット（system:multi-year-trend）の適用・描画E2E（#1909, Tier 2: 要データ）。
 *
 * 複数の reference_date を持つ推定結果データに複数年プリセットを適用し、
 * 折れ線ビューに「年度で丸めるグループ（YYYY年 + avg）」が適用時注入され、
 * 年数ぶんの点で描画される（applyViewTemplate → fetchChartData）ことを検証する。
 *
 * 前提データ: prepare-multi-year-result 操作スクリプトで作成した「複数年の推定結果データ」
 * （名寄せ×3 → 推定1回）。存在しなければ skip する。
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";

const MULTI_YEAR_TEMPLATE_ID = "system:multi-year-trend";

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

test("複数年プリセットを適用すると折れ線が年度で丸められる", async () => {
  // 複数の reference_date を持つ推定結果データを探す（prepare-multi-year-result が作った前提データ）。
  const ctx = await page.evaluate(async () => {
    const results = (await window.ipcRenderer.invoke(
      "selectDataSetResults",
    )) as { id: number }[];
    for (const result of results) {
      const dates = (await window.ipcRenderer.invoke("selectReferenceDates", {
        dataSetResultId: result.id,
      })) as string[];
      if (new Set(dates).size >= 2) {
        return { dataSetResultId: result.id, yearCount: new Set(dates).size };
      }
    }
    return null;
  });

  if (!ctx) {
    test.skip(
      true,
      "複数年の推定結果データがありません（npm run script -- prepare-multi-year-result で用意）",
    );
    return;
  }

  // 検証用の一時ワークブック（既定シート付き）を作る。
  const workspace = await page.evaluate(async () => {
    const { id: workbookId } = (await window.ipcRenderer.invoke(
      "createWorkbooks",
      { title: "複数年プリセットE2E一時" },
    )) as { id: number };
    const sheets = (await window.ipcRenderer.invoke("selectResultSheets", {
      workbookId,
    })) as { id: number }[];
    return { workbookId, sheetId: sheets[0].id };
  });

  try {
    // 複数年プリセットを一時シートへ適用（束ねる先は複数年データ）。
    await page.evaluate(
      async ({ sheetId, dataSetResultId, templateId }) => {
        await window.ipcRenderer.invoke("applyViewTemplate", {
          sheetId,
          dataSetResultId,
          templateId,
        });
      },
      {
        sheetId: workspace.sheetId,
        dataSetResultId: ctx.dataSetResultId,
        templateId: MULTI_YEAR_TEMPLATE_ID,
      },
    );

    // 適用された折れ線ビューを読み、年グループが注入され・年数ぶんの点で描画されるか検証。
    const result = await page.evaluate(async (sheetId) => {
      const views = (await window.ipcRenderer.invoke("selectResultViews", {
        sheetId,
      })) as {
        id: number;
        style: string;
        unit: string;
        data_set_result_id: number | null;
        parameters: { key: string; type: string; value: unknown }[];
      }[];
      const lineView = views.find((v) => v.style === "line");
      if (!lineView) return null;

      const groupCount = lineView.parameters.filter(
        (p) => p.type === "group",
      ).length;
      const hasAggregation = lineView.parameters.some(
        (p) => p.type === "group_aggregation",
      );

      const chart = (await window.ipcRenderer.invoke("fetchChartData", {
        view: {
          id: lineView.id,
          dataSetResultId: lineView.data_set_result_id,
          style: "line",
          unit: "building",
          parameters: lineView.parameters,
          orderBy: { column: "reference_date", direction: "ascending" },
        },
      } as never)) as { data: { x: string | number }[] };

      return {
        groupCount,
        hasAggregation,
        pointCount: chart.data.length,
        labels: chart.data.map((d) => String(d.x)),
      };
    }, workspace.sheetId);

    // 折れ線ビューが適用されている。
    expect(result).not.toBeNull();
    // reference_date 1つにつき年グループ1つが注入されている。
    expect(result?.groupCount).toBe(ctx.yearCount);
    // 集計（avg）が付いている。
    expect(result?.hasAggregation).toBe(true);
    // 年度で丸められ、年数ぶんの点で描画される。
    expect(result?.pointCount).toBe(ctx.yearCount);
    // ラベルは「YYYY年」形式。
    for (const label of result?.labels ?? []) {
      expect(label).toMatch(/^\d{4}年$/);
    }
  } finally {
    // 一時ワークブックを削除して冪等に戻す。
    await page.evaluate(async (workbookId) => {
      await window.ipcRenderer.invoke("deleteWorkbook", { workbookId });
    }, workspace.workbookId);
  }
});
