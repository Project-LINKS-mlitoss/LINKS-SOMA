/**
 * 空き家推定（IF003）説明変数型不一致エラー E2E（FR004-007・E-201 を推定で再現）
 *
 * 推定は保存済みモデルの説明変数を分析対象データから解決して数値消費する。そこで
 * 「世帯コード」を説明変数に含めたモデルを正常データ（数値の世帯コード）で構築・保存し、
 * 「世帯コード」を非数値「不明」にした別データで推定すると、E022 の数値消費前ガード
 * `find_non_numeric_feature_columns` が検出し E-201（型不一致・自治体修正）で推定が
 * error になる。これを end-to-end で確認する。
 *
 * 何を守るか: FR004-007 で E022 に入れた型不一致ガードが、推定（IF003）の UI 操作で作った
 * 実データ経路でも発火し、対応区分・修正方法つきで推定詳細（result）に表示されること。
 * モデル構築側（IF002）は model-building-feature-type-error.e2e.ts が担保する。
 *
 * 実行方法:
 * cd app && npm run e2e -- estimation-feature-type-error
 *
 * 前提: 開発サーバー起動済み + ML バイナリ（ml/dist）ビルド済み + 建物ポリゴンデータ登録済み。
 * 所要時間: 約10-15分（正常名寄せ + モデル構築 + 不正名寄せ + 推定）。
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
import {
  waitForJobCompletionById,
  saveJobResult,
  generateJobName,
} from "../../helpers/job-operations";
import {
  navigateAndStartAction,
  fillModelBuildingForm,
  fillEstimationForm,
  startPipelineAndNavigateToStatus,
} from "../../helpers/pipeline-operations";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

const BUILDING_POLYGON_NAME = "建物ポリゴンデータ";
/** 非数値「不明」を持つ ODS フィクスチャの表示名（SAMPLE_DATA_FILE_NAMES に登録済み） */
const BAD_ODS_FILE = "説明変数追加用_型不正";
/** ODS 由来の説明変数（[追加] プレフィックスは ODS カラムの UI 表示） */
const ODS_COLUMN_LABEL = "[追加] 世帯コード";

/** 既定の住民基本台帳（世帯コードは数値）で名寄せ → 世帯コード_ods は数値になる。 */
async function normalizeWithCleanOds(page: Page): Promise<number> {
  await startNormalizationWizard(page);
  await walkWizard(page, {
    buildingRegistry: "skip",
    buildingPolygon: { name: BUILDING_POLYGON_NAME },
    buildingTypeDetermination: "skip",
    vacantHouse: "select",
    optionalDataSource: "select",
    // optionalDataSourceFile 省略 = 既定の住民基本台帳（数値の世帯コード）
  });
  await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();
  const { newJobId } = await startPipelineAndNavigateToStatus(page, {
    startButton: "開始する",
    confirmMessage: "データ名寄せ処理を開始しました",
    statusHashIncludes: "normalization",
    draftUrlPathSegment: "normalization",
  });
  if (newJobId === undefined) {
    throw new Error("名寄せ（正常ODS）jobId が確定していません");
  }
  return newJobId;
}

/** 非数値「不明」の ODS で名寄せ → 世帯コード_ods は非数値になる。 */
async function normalizeWithBadOds(page: Page): Promise<number> {
  await startNormalizationWizard(page);
  await walkWizard(page, {
    buildingRegistry: "skip",
    buildingPolygon: { name: BUILDING_POLYGON_NAME },
    buildingTypeDetermination: "skip",
    vacantHouse: "select",
    optionalDataSource: "select",
    optionalDataSourceFile: BAD_ODS_FILE,
  });
  await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();
  const { newJobId } = await startPipelineAndNavigateToStatus(page, {
    startButton: "開始する",
    confirmMessage: "データ名寄せ処理を開始しました",
    statusHashIncludes: "normalization",
    draftUrlPathSegment: "normalization",
  });
  if (newJobId === undefined) {
    throw new Error("名寄せ（不正ODS）jobId が確定していません");
  }
  return newJobId;
}

/** 説明変数選択ダイアログで「[追加] 世帯コード」を既定に追加して ON にする（消費対象に含める）。 */
async function addOdsColumn(page: Page): Promise<void> {
  const changeColumnsButton = page.getByRole("button", { name: "カラムを変更" });
  await expect(changeColumnsButton).toBeVisible({ timeout: 10000 });
  await changeColumnsButton.click();
  await page.waitForSelector('[role="dialog"]');
  const dialog = page.locator('[role="dialog"]');

  const odsLabel = dialog.locator("label").filter({ hasText: ODS_COLUMN_LABEL });
  expect(
    await odsLabel.count(),
    `${ODS_COLUMN_LABEL} が説明変数候補に存在すること`,
  ).toBeGreaterThan(0);
  const forAttr = await odsLabel.first().getAttribute("for");
  if (forAttr) {
    const input = dialog.locator(`input[id="${forAttr}"]`);
    if (!(await input.isChecked())) {
      await odsLabel.first().click();
    }
  }

  await dialog.getByRole("button", { name: "保存" }).click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden" });
  await page.waitForTimeout(500);
}

test.describe("空き家推定 説明変数型不一致（FR004-007・E-201）", () => {
  test("非数値ODSを説明変数に含むモデルで不正データを推定するとE-201で停止し対応区分・修正方法つきで表示される", async () => {
    test.setTimeout(3600000);

    // ── 1) 正常ODS（数値の世帯コード）で名寄せ → データセット保存 ──
    const cleanPreprocessId = await normalizeWithCleanOds(page);
    expect(
      await waitForJobCompletionById(page, {
        jobId: cleanPreprocessId,
        type: "preprocess",
        label: "名寄せ（正常ODS）",
      }),
    ).toBe("complete");
    const cleanDatasetName = await generateJobName(page, "型正常ODS_推定用");
    await saveJobResult(page, { title: cleanDatasetName });

    // ── 2) 世帯コードを説明変数に含めてモデル構築 → 完了 → モデル保存 ──
    await navigateAndStartAction(page, {
      href: "#model",
      hashIncludes: "model",
      startButton: "モデル構築を始める",
      createHashIncludes: "model/create",
    });
    await fillModelBuildingForm(page, {
      datasetName: cleanDatasetName,
      configureColumns: addOdsColumn,
    });
    const { newJobId: mlJobId } = await startPipelineAndNavigateToStatus(page, {
      startButton: "モデル構築開始",
      confirmMessage: "モデル構築処理を開始しました",
      statusHashIncludes: "model",
      createHashExcludes: "create",
      trackJobType: "ml",
      trackLabel: "モデル構築（正常ODS）",
    });
    if (mlJobId === undefined) {
      throw new Error("ml jobId が確定していません");
    }
    expect(
      await waitForJobCompletionById(page, {
        jobId: mlJobId,
        type: "ml",
        tableIndex: 1,
        interval: 15000,
        label: "モデル構築（正常ODS）",
      }),
    ).toBe("complete");
    const modelName = await generateJobName(page, "型正常ODSモデル_推定用");
    await saveJobResult(page, {
      title: modelName,
      tableIndex: 1,
      skipVerification: true,
    });

    // ── 3) 不正ODS（非数値の世帯コード）で名寄せ → データセット保存 ──
    const badPreprocessId = await normalizeWithBadOds(page);
    expect(
      await waitForJobCompletionById(page, {
        jobId: badPreprocessId,
        type: "preprocess",
        label: "名寄せ（不正ODS）",
      }),
    ).toBe("complete");
    const badDatasetName = await generateJobName(page, "型不正ODS_推定用");
    await saveJobResult(page, { title: badDatasetName });

    // ── 4) 不正データセットを上記モデルで推定 → E-201 ──
    await navigateAndStartAction(page, {
      href: "#evaluation",
      hashIncludes: "evaluation",
      startButton: "空き家推定を始める",
      createHashIncludes: "evaluation/create",
    });
    await fillEstimationForm(page, {
      datasetName: badDatasetName,
      modelName,
    });
    const { newJobId: resultJobId } = await startPipelineAndNavigateToStatus(
      page,
      {
        startButton: "推定開始",
        confirmMessage: "分析を開始しました",
        statusHashIncludes: "evaluation",
        createHashExcludes: "create",
        trackJobType: "result",
        trackLabel: "推定（型不一致）",
      },
    );
    if (resultJobId === undefined) {
      throw new Error("推定 jobId が確定していません");
    }
    expect(
      await waitForJobCompletionById(page, {
        jobId: resultJobId,
        type: "result",
        interval: 15000,
        label: "推定（型不一致）",
      }),
    ).toBe("error");

    // IPC で job_tasks を直読みし、E-201（IF003 側）が記録されたことを確認
    const errorTask = await page.evaluate(async (id: number) => {
      const tasks = (await window.ipcRenderer.invoke(
        "selectJobTasks",
        id,
      )) as Array<{
        error_code: string | null;
        result?: { error_detail?: { display_code?: string; responsibility?: string } };
      }>;
      return tasks.find(
        (t) => t.error_code === "IF003_e022_err_feature_non_numeric",
      );
    }, resultJobId);
    expect(
      errorTask,
      "E-201(IF003 説明変数型不一致)が job_tasks に記録されること",
    ).toBeTruthy();
    expect(errorTask?.result?.error_detail?.display_code).toBe("E-201");
    expect(errorTask?.result?.error_detail?.responsibility).toBe("自治体修正");

    // UI（推定 result 詳細）に E-201・対応区分・修正方法が表示されること。
    await page.reload();
    await page.waitForLoadState("load");
    await page.evaluate((id) => {
      window.location.hash = `#/job/detail/${id}/result`;
    }, resultJobId);
    await page.waitForFunction(
      (id) => window.location.hash.includes(`job/detail/${id}/result`),
      resultJobId,
      { timeout: 15000 },
    );
    await page.waitForTimeout(2000);

    await expect(page.getByText(/E-201/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("対応:").first()).toBeVisible();
    await expect(page.getByText("データの修正").first()).toBeVisible();
    const fixGuideToggle = page
      .getByRole("button", { name: "修正方法を見る" })
      .first();
    await expect(fixGuideToggle).toBeVisible();
    await fixGuideToggle.click();
    await expect(page.getByText("正しい形式:").first()).toBeVisible();
    await expect(
      page
        .getByText("説明変数の列に、数値として読めない値が含まれています。")
        .first(),
    ).toBeVisible();
  });
});
