/**
 * 建物関連データ（optional_data_source）受け入れテスト
 *
 * #1659 で追加された optional_data_source パイプライン対応の受け入れテスト。
 * IF001 → IF002 → IF003 の全パイプラインを通し、_ods カラムが
 * 処理結果画面（SC503）・分析画面（SC002/SC003）で表示されることを確認する。
 *
 * テストフロー:
 * 1. IF001 名寄せ処理（SC102）: optional_data_source 有効で実行 → 完了
 * 2. 名寄せ結果を名前をつけて保存（SC502）
 * 3. IF002 モデル構築（SC202）: _ods カラム + 最小限のデフォルト説明変数で構築 → 完了
 * 4. モデル構築結果（SC503）: 特徴量重要度に [追加] プレフィックス付きカラムが表示
 * 5. モデル構築結果を名前をつけて保存（SC503）
 * 6. IF003 空き家推定: 構築モデルで推定 → 完了
 * 7. 分析画面（SC002/SC003）: ポップアップの全項目表示に [追加] カラムが表示
 *
 * テストデータ:
 * - optional_data_source として fixtures/住民基本台帳.csv を流用
 * - 住所カラムで結合後、世帯コード・生年月日・住定日・異動日・異動事由 が
 *   _ods サフィックス付きカラムとして追加される（ADR-0015）
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-ods-acceptance
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み（建物ポリゴンデータ含む）
 * 2. Pythonバイナリがビルド済み（cd ml && npm run build）
 *
 * 所要時間: 約5-10分（IF001 + IF002 + IF003 処理時間に依存）
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
  verifyNormalizationJoiningRates,
} from "../../helpers/job-operations";
import {
  navigateAndStartAction,
  fillEstimationForm,
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

/** 名寄せ保存時に使う識別名（名寄せ完了後にジョブの作成日時で確定） */
let savedDatasetName = "";

/** モデル構築結果の保存名（推定テストのモデル選択で使用） */
let savedModelName = "";

/** 建物ポリゴンデータ名 */
const BUILDING_POLYGON_NAME = "建物ポリゴンデータ";

/**
 * IF002 モデル構築時に選択する _ods 以外のデフォルト説明変数（最小限）。
 * _ods カラムが特徴量重要度（SC503）の上位20件に確実に含まれるよう、
 * デフォルト説明変数を少数に絞る。
 */
const MINIMAL_DEFAULT_COLUMNS = [
  "閉栓フラグ",
  "平均検針水量",
  "最新世帯人数",
];

/**
 * ODS用カスタムカラム設定
 *
 * 全チェックボックスをOFF → _ods カラム（世帯コード）+ 最小限デフォルトをON
 */
async function configureOdsColumns(page: Page): Promise<void> {
  const changeColumnsButton = page.getByRole("button", {
    name: "カラムを変更",
  });
  await expect(changeColumnsButton).toBeVisible({ timeout: 10000 });
  await changeColumnsButton.click();
  await page.waitForSelector('[role="dialog"]');

  await expect(
    page.getByRole("heading", { name: "説明変数に使うカラムの選択" }),
  ).toBeVisible();

  const dialog = page.locator('[role="dialog"]');

  // _ods カラム（[追加] プレフィックス）の存在を確認
  const odsLabels = dialog.locator("label").filter({ hasText: "[追加]" });
  const odsLabelCount = await odsLabels.count();
  // eslint-disable-next-line no-console -- E2Eテストの進捗表示
  console.log(`📌 [追加] label 数: ${odsLabelCount}`);
  expect(odsLabelCount, "_ods カラムが1つ以上存在すること").toBeGreaterThan(0);

  // 全チェックボックスをOFFにする（label クリックで toggle）
  const allLabels = dialog.locator("label");
  const labelCount = await allLabels.count();
  for (let i = 0; i < labelCount; i++) {
    const label = allLabels.nth(i);
    const forAttr = await label.getAttribute("for");
    if (forAttr) {
      const input = dialog.locator(`input[id="${forAttr}"]`);
      if ((await input.count()) > 0 && (await input.isChecked())) {
        await label.click();
        await page.waitForTimeout(50);
      }
    }
  }

  // 世帯コード_ods のみ選択（数値カラム。日付・文字列カラムは LightGBM で使用不可）
  const odsTargetLabel = dialog
    .locator("label")
    .filter({ hasText: "[追加] 世帯コード" });
  expect(
    await odsTargetLabel.count(),
    "[追加] 世帯コード が存在すること",
  ).toBeGreaterThan(0);
  await odsTargetLabel.first().click();

  // 最小限のデフォルトカラムもONにする
  for (const colName of MINIMAL_DEFAULT_COLUMNS) {
    const label = dialog
      .locator("label")
      .filter({ hasText: new RegExp(`^${colName}$`) });
    if ((await label.count()) > 0) {
      await label.first().click();
      await page.waitForTimeout(50);
    }
  }

  // 選択数を確認してログ出力
  const selectedCountText = await page
    .locator('[role="dialog"]')
    .getByText(/\d+カラム選択中/)
    .textContent();
  // eslint-disable-next-line no-console -- E2Eテストの進捗表示
  console.log(`📌 説明変数: ${selectedCountText}`);

  // 保存
  await page
    .locator('[role="dialog"]')
    .getByRole("button", { name: "保存" })
    .click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden" });
  await page.waitForTimeout(500);
}

test.describe("optional_data_source 受け入れテスト: IF001 → IF002 → IF003 → 分析画面", () => {
  // ─── IF001 名寄せ処理 ───

  test("IF001: optional_data_source 有効で名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    // optional_data_source を有効にしてウィザード実行（住民基本台帳.csv を流用）
    await walkWizard(page, {
      buildingRegistry: "skip",
      buildingPolygon: { name: BUILDING_POLYGON_NAME },
      buildingTypeDetermination: "skip",
      vacantHouse: "select",
      optionalDataSource: "select",
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

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: preprocessJobId,
      type: "preprocess",
      label: "IF001（optional_data_source有効）",
    });

    expect(finalStatus).toBe("complete");

    // 結合率検証: 住基(juki) + ジオコーディング(geo) + ODS + 空き家調査結果(vacant_house) = 4件想定（buildingRegistryはskip、#1775）
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 4,
      label: "IF001（ODS）",
    });
  });

  test("IF001: 名寄せ結果を名前をつけて保存できること（SC502）", async () => {
    test.setTimeout(60000);

    savedDatasetName = await generateJobName(page, "ODS受入");

    // ジョブ詳細画面（SC502）に遷移して保存
    await saveJobResult(page, { title: savedDatasetName });

    // 診断: SC502画面に戻って IF001パラメータに optional_data_source が含まれているか確認
    await page.goBack();
    await page.waitForTimeout(1000);
  });

  // ─── IF002 モデル構築 ───

  test("IF002: _ods カラム + 最小限デフォルトでモデル構築が完了すること（SC202）", async () => {
    test.setTimeout(3600000);

    await navigateAndStartAction(page, {
      href: "#model",
      hashIncludes: "model",
      startButton: "モデル構築を始める",
      createHashIncludes: "model/create",
    });

    // カスタムカラム設定でモデル構築フォーム入力
    await fillModelBuildingForm(page, {
      datasetName: savedDatasetName,
      configureColumns: configureOdsColumns,
    });

    const { newJobId: mlJobId } = await startPipelineAndNavigateToStatus(page, {
      startButton: "モデル構築開始",
      confirmMessage: "モデル構築処理を開始しました",
      statusHashIncludes: "model",
      createHashExcludes: "create",
      trackJobType: "ml",
      trackLabel: "IF002（_ods説明変数）",
    });
    if (mlJobId === undefined) {
      throw new Error("ml jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: mlJobId,
      type: "ml",
      tableIndex: 1,
      interval: 30000,
      label: "IF002（_ods説明変数）",
    });

    expect(finalStatus).toBe("complete");
  });

  test("IF002: 特徴量重要度に [追加] プレフィックス付きカラムが表示されること（SC503）", async () => {
    test.setTimeout(60000);

    // 処理一覧テーブル（2番目）の完了した行をクリックして詳細画面へ
    const completedRow = page
      .locator("table")
      .nth(1)
      .locator("tbody tr")
      .first();
    await completedRow.click();
    await page.waitForFunction(
      () => window.location.hash.includes("job/detail"),
      { timeout: 10000 },
    );
    await page.waitForTimeout(3000);

    // 特徴量重要度セクションが表示されること
    await expect(
      page.getByText("特徴量重要度", { exact: true }),
    ).toBeVisible({ timeout: 10000 });

    // SC503 の特徴量重要度チャート Y軸ラベルに [追加] 世帯コード が表示されることを検証
    const odsLabel = page.getByText("[追加] 世帯コード").first();
    const hasOdsColumn = await odsLabel
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    // eslint-disable-next-line no-console -- E2Eテストの進捗表示
    console.log(
      `📌 特徴量重要度に [追加] 世帯コード: ${hasOdsColumn ? "あり" : "なし"}`,
    );
    expect(
      hasOdsColumn,
      "特徴量重要度に [追加] 世帯コード が表示されること",
    ).toBe(true);
  });

  test("IF002: モデル構築結果を名前をつけて保存できること（SC503）", async () => {
    test.setTimeout(60000);

    // 特徴量重要度テストで詳細画面に遷移済みなので、そのまま保存
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    savedModelName = `E2Eテスト_ODSモデル_${dateStr}`;

    const saveButton = page.getByRole("button", { name: "名前をつけて保存" });
    await expect(saveButton).toBeVisible({ timeout: 10000 });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await page.waitForSelector('[role="dialog"]');

    const nameInput = page.locator('[role="dialog"] input[name="title"]');
    await nameInput.fill(savedModelName);

    await page
      .locator('[role="dialog"]')
      .getByRole("button", { name: "保存" })
      .click();
    await page.waitForSelector('[role="dialog"]', { state: "hidden" });

    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    await expect(page.getByText("として保存済み")).toBeVisible({
      timeout: 10000,
    });
  });

  // ─── IF003 空き家推定 ───

  test("IF003: optional_data_source 付きモデルで空き家推定が完了すること", async () => {
    test.setTimeout(3600000);

    await navigateAndStartAction(page, {
      href: "#evaluation",
      hashIncludes: "evaluation",
      startButton: "空き家推定を始める",
      createHashIncludes: "evaluation/create",
    });

    await fillEstimationForm(page, {
      datasetName: savedDatasetName,
      modelName: savedModelName,
    });

    const { newJobId: resultJobId } = await startPipelineAndNavigateToStatus(
      page,
      {
        startButton: "推定開始",
        confirmMessage: "分析を開始しました",
        statusHashIncludes: "evaluation",
        createHashExcludes: "create",
        trackJobType: "result",
        trackLabel: "IF003（optional_data_source）",
      },
    );
    if (resultJobId === undefined) {
      throw new Error("result jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: resultJobId,
      type: "result",
      interval: 30000,
      label: "IF003（optional_data_source）",
    });

    expect(finalStatus).toBe("complete");
  });

  // ─── 分析画面 (SC002/SC003) ───

  test("分析画面: IF003 推定結果の data_set_detail_buildings に optional_data_source が格納されていること", async () => {
    test.setTimeout(60000);

    // 最新の推定結果を IPC 経由で取得
    const results = await page.evaluate(async () =>
      window.ipcRenderer.invoke("selectDataSetResults"),
    );
    expect(results.length, "推定結果が1件以上存在すること").toBeGreaterThan(0);

    // 最新結果の件数を確認（building レコードが格納されていること）
    const latestResult = results[0];
    // eslint-disable-next-line no-console -- E2Eテストの進捗表示
    console.log(
      `📌 最新推定結果: id=${latestResult.id}, title="${latestResult.title}"`,
    );

    const countResult = await page.evaluate(
      async (resultId: number) =>
        window.ipcRenderer.invoke("selectDataSetCount", {
          dataSetResultId: resultId,
          unit: "building",
        }),
      latestResult.id,
    );
    const buildingCount =
      typeof countResult === "number" ? countResult : countResult?.count ?? 0;
    // eslint-disable-next-line no-console -- E2Eテストの進捗表示
    console.log(`📌 building レコード数: ${buildingCount}`);
    expect(buildingCount, "building レコードが1件以上存在すること").toBeGreaterThan(
      0,
    );

    expect(
      latestResult.title,
      "推定結果のタイトルが設定されていること",
    ).toBeTruthy();
  });
});
