/**
 * モデル構築（IF002）説明変数型不一致エラー E2E（FR004-007・E-201 を実機で再現）
 *
 * 標準特徴量は名寄せで数値計算されるため非数値にできないが、建物関連データ（ODS）は
 * 住所結合後に値をそのまま `_ods` 特徴量として持ち込む（パススルー）。そこで「世帯コード」を
 * 非数値「不明」にした ODS フィクスチャを名寄せに通し、その `世帯コード_ods` 列を説明変数に
 * 選んでモデル構築すると、E021 の数値消費前ガード `find_non_numeric_feature_columns` が
 * 検出し E-201（型不一致・自治体修正）でジョブが error になる。これを end-to-end で確認する。
 *
 * 何を守るか: FR004-007 で入れた型不一致ガードが、UI 操作で作った実データ経路でも発火し、
 * 責任分界・次アクションつきでジョブ詳細（ml）に表示されること。発火の網羅自体は
 * ml/tests/integration（実subprocess+実DB）が担保する。
 *
 * 実行方法:
 * cd app && npm run e2e -- model-building-feature-type-error
 *
 * 前提: 開発サーバー起動済み + ML バイナリ（ml/dist）ビルド済み + 建物ポリゴンデータ登録済み。
 * 所要時間: 約5-10分（名寄せ + モデル構築）。
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
/** 非数値を仕込んだ ODS 由来の説明変数（[追加] プレフィックスは ODS カラムの UI 表示） */
const BAD_ODS_COLUMN_LABEL = "[追加] 世帯コード";

let savedDatasetName = "";

/** 説明変数選択ダイアログで「[追加] 世帯コード」（非数値の _ods 列）を選ぶ。 */
async function selectBadOdsColumn(page: Page): Promise<void> {
  const changeColumnsButton = page.getByRole("button", { name: "カラムを変更" });
  await expect(changeColumnsButton).toBeVisible({ timeout: 10000 });
  await changeColumnsButton.click();
  await page.waitForSelector('[role="dialog"]');
  const dialog = page.locator('[role="dialog"]');

  // 全チェックを一旦 OFF にしてから不正 ODS 列だけを ON にする（型不一致を確実に消費対象へ）
  const allLabels = dialog.locator("label");
  const labelCount = await allLabels.count();
  for (let i = 0; i < labelCount; i++) {
    const label = allLabels.nth(i);
    const forAttr = await label.getAttribute("for");
    if (forAttr) {
      const input = dialog.locator(`input[id="${forAttr}"]`);
      if ((await input.count()) > 0 && (await input.isChecked())) {
        await label.click();
        await page.waitForTimeout(30);
      }
    }
  }

  const odsLabel = dialog
    .locator("label")
    .filter({ hasText: BAD_ODS_COLUMN_LABEL });
  expect(
    await odsLabel.count(),
    `${BAD_ODS_COLUMN_LABEL} が説明変数候補に存在すること`,
  ).toBeGreaterThan(0);
  await odsLabel.first().click();

  await dialog.getByRole("button", { name: "保存" }).click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden" });
  await page.waitForTimeout(500);
}

test.describe("モデル構築 説明変数型不一致（FR004-007・E-201）", () => {
  test("非数値ODSを説明変数に選ぶとモデル構築がE-201で停止し責任分界つきで表示される", async () => {
    test.setTimeout(3600000);

    // ── 名寄せ: 非数値「不明」入りの ODS を流す ──
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
    const { newJobId: preprocessJobId } = await startPipelineAndNavigateToStatus(
      page,
      {
        startButton: "開始する",
        confirmMessage: "データ名寄せ処理を開始しました",
        statusHashIncludes: "normalization",
        draftUrlPathSegment: "normalization",
      },
    );
    if (preprocessJobId === undefined) {
      throw new Error("preprocess jobId が確定していません");
    }
    const preStatus = await waitForJobCompletionById(page, {
      jobId: preprocessJobId,
      type: "preprocess",
      label: "名寄せ（不正ODS）",
    });
    // ODS は任意データなので非数値があっても名寄せ自体は完走する（パススルー）
    expect(preStatus).toBe("complete");

    savedDatasetName = await generateJobName(page, "型不正ODS");
    await saveJobResult(page, { title: savedDatasetName });

    // ── モデル構築: 非数値 _ods 列を説明変数に選ぶ → E-201 ──
    await navigateAndStartAction(page, {
      href: "#model",
      hashIncludes: "model",
      startButton: "モデル構築を始める",
      createHashIncludes: "model/create",
    });
    await fillModelBuildingForm(page, {
      datasetName: savedDatasetName,
      configureColumns: selectBadOdsColumn,
    });

    const { newJobId: mlJobId } = await startPipelineAndNavigateToStatus(page, {
      startButton: "モデル構築開始",
      confirmMessage: "モデル構築処理を開始しました",
      statusHashIncludes: "model",
      createHashExcludes: "create",
      trackJobType: "ml",
      trackLabel: "モデル構築（型不一致）",
    });
    if (mlJobId === undefined) {
      throw new Error("ml jobId が確定していません");
    }

    const mlStatus = await waitForJobCompletionById(page, {
      jobId: mlJobId,
      type: "ml",
      interval: 15000,
      label: "モデル構築（型不一致）",
    });
    expect(mlStatus).toBe("error");

    // IPC で job_tasks を直読みし、E-201（型不一致・自治体修正）が記録されたことを確認
    const errorTask = await page.evaluate(async (id: number) => {
      const tasks = (await window.ipcRenderer.invoke(
        "selectJobTasks",
        id,
      )) as Array<{
        error_code: string | null;
        error_msg: string | null;
        result?: { error_detail?: { display_code?: string; responsibility?: string } };
      }>;
      return tasks.find(
        (t) => t.error_code === "IF002_e021_err_feature_non_numeric",
      );
    }, mlJobId);
    expect(
      errorTask,
      "E-201(説明変数型不一致)が job_tasks に記録されること",
    ).toBeTruthy();
    expect(errorTask?.result?.error_detail?.display_code).toBe("E-201");
    expect(errorTask?.result?.error_detail?.responsibility).toBe("自治体修正");

    // UI（ml ジョブ詳細）に E-201・責任分界・次アクションが表示されることを確認。
    // 完了待機中にマウントしたページは古い isProcessing 状態を持つため reload で再取得する。
    await page.reload();
    await page.waitForLoadState("load");
    await page.evaluate((id) => {
      window.location.hash = `#/job/detail/${id}/ml`;
    }, mlJobId);
    await page.waitForFunction(
      (id) => window.location.hash.includes(`job/detail/${id}/ml`),
      mlJobId,
      { timeout: 15000 },
    );
    await page.waitForTimeout(2000);

    await expect(page.getByText(/E-201/)).toBeVisible({ timeout: 15000 });
    // 対応区分（責任分界の職員向け表示）。色だけでなくテキストでも示す。
    await expect(page.getByText("対応:")).toBeVisible();
    await expect(page.getByText("データの修正")).toBeVisible();

    // 修正方法（fix guide）が段階開示で内蔵されること（FR006 / #1786）。
    // 展開前は本文が隠れ、トグルをクリックすると正しい形式・修正例が現れる。
    const fixGuideToggle = page.getByRole("button", { name: "修正方法を見る" });
    await expect(fixGuideToggle).toBeVisible();
    await fixGuideToggle.click();
    await expect(page.getByText("正しい形式:")).toBeVisible();
    // 何が悪いか（feature_numeric guide の what・一意な全文）
    await expect(
      page.getByText("説明変数の列に、数値として読めない値が含まれています。"),
    ).toBeVisible();
    // 修正例（修正前→修正後）が出ること
    await expect(page.getByText("修正例:")).toBeVisible();
    await expect(page.getByText("不明", { exact: true })).toBeVisible();
  });
});
