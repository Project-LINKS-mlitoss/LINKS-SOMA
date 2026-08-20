/**
 * 建物登記データ（touki）ありの名寄せ・推定E2Eテスト
 *
 * flow-normalization-estimation-full.e2e.ts との違い:
 * - fullテストは buildingRegistry=skip
 * - 本テストは buildingRegistry=select
 * - これにより IF001 の touki結合パス（E013/E014のtouki処理）を検証する
 *
 * 検証内容:
 * 1. 名寄せ処理: 登記データを含む名寄せが正常完了
 * 2. 空き家推定: 登記データを含む名寄せ結果でIF003が正常動作
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-estimation-with-touki
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み（登記.csv、建物ポリゴンデータ含む）
 * 2. Pythonバイナリがビルド済み（cd ml && npm run build）
 *
 * 所要時間: 20-120分（名寄せ + 推定処理時間に依存）
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
  verifyEstimationResultCount,
  fetchNormalizedDatasetRecords,
} from "../../helpers/job-operations";
import {
  navigateAndStartAction,
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

/** 保存時に使う識別名 */
let savedDatasetName = "";

/** 建物ポリゴンデータ名 */
const BUILDING_POLYGON_NAME = "建物ポリゴンデータ";

test.describe("登記データあり名寄せ・推定処理", () => {
  test("登記データを含む名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    // buildingRegistry=select で登記データを含める（fullテストとの差分）
    await walkWizard(page, {
      buildingRegistry: "select",
      buildingPolygon: { name: BUILDING_POLYGON_NAME },
    });

    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

    const { newJobId: preprocessJobId } =
      await startPipelineAndNavigateToStatus(page, {
        startButton: "開始する",
        confirmMessage: "データ名寄せ処理を開始しました",
        statusHashIncludes: "normalization",
        draftUrlPathSegment: "normalization",
      });
    if (preprocessJobId === undefined) {
      throw new Error("preprocess jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: preprocessJobId,
      type: "preprocess",
      label: "名寄せ（登記データあり）",
    });

    expect(finalStatus).toBe("complete");

    // 結合率検証: 住基(juki) + 登記(touki) + ジオコーディング(geo) = 3件想定
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 3,
      label: "名寄せ（登記データあり）",
    });
  });

  test("名寄せ結果を名前をつけて保存できること", async () => {
    test.setTimeout(60000);

    savedDatasetName = await generateJobName(page, "登記あり");
    await saveJobResult(page, { title: savedDatasetName });
  });

  test("登記の経過年数3指標（案E)が名寄せ出力に正しく出ること", async () => {
    test.setTimeout(120000);

    const { headers, records } = await fetchNormalizedDatasetRecords(
      page,
      savedDatasetName,
    );

    // 列の存在（案E: issue #1777）
    for (const col of ["築年数", "相続後経過年数", "増築後経過年数"]) {
      expect(headers, `名寄せ出力に「${col}」列があること`).toContain(col);
    }

    // 登記マッチ行では築年数が数値で入る（fixtures/登記.csv は新築イベント多数）
    const withAge = records.filter((r) => r["築年数"] !== "");
    expect(
      withAge.length,
      "築年数が入る行が1件以上（登記結合が値まで反映されていること）",
    ).toBeGreaterThan(0);

    // 増築を持つのは fixtures 上 1 住所（一ツ橋二丁目5-3: 新築1962/相続1990/増築2010）。
    // 事由が新しいほど経過年数は小さい → 築年数 > 相続後 > 増築後 > 0 が成り立つはず。
    const withExtension = records.filter((r) => r["増築後経過年数"] !== "");
    expect(
      withExtension.length,
      "増築後経過年数が入る行が存在すること（増築イベントの検出がE2Eで機能）",
    ).toBeGreaterThan(0);

    for (const r of withExtension) {
      const age = Number(r["築年数"]);
      const inheritance = Number(r["相続後経過年数"]);
      const extension = Number(r["増築後経過年数"]);
      expect(
        Number.isFinite(age) &&
          Number.isFinite(inheritance) &&
          Number.isFinite(extension),
        `3指標が数値であること: ${JSON.stringify({ age, inheritance, extension })}`,
      ).toBe(true);
      expect(
        age,
        "築年数 > 相続後経過年数（最古1962 > 相続1990）",
      ).toBeGreaterThan(inheritance);
      expect(
        inheritance,
        "相続後経過年数 > 増築後経過年数（相続1990 > 増築2010）",
      ).toBeGreaterThan(extension);
      expect(extension, "増築後経過年数 > 0").toBeGreaterThan(0);
    }
  });

  test("登記データあり名寄せ結果で空き家推定が完了すること", async () => {
    test.setTimeout(3600000);

    await navigateAndStartAction(page, {
      href: "#evaluation",
      hashIncludes: "evaluation",
      startButton: "空き家推定を始める",
      createHashIncludes: "evaluation/create",
    });

    await fillEstimationForm(page, { datasetName: savedDatasetName });

    const { newJobId: resultJobId } = await startPipelineAndNavigateToStatus(
      page,
      {
        startButton: "推定開始",
        confirmMessage: "分析を開始しました",
        statusHashIncludes: "evaluation",
        createHashExcludes: "create",
        trackJobType: "result",
        trackLabel: "推定（登記データあり）",
      },
    );
    if (resultJobId === undefined) {
      throw new Error("result jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: resultJobId,
      type: "result",
      interval: 30000,
      label: "推定（登記データあり）",
    });

    expect(finalStatus).toBe("complete");

    // 推定結果件数検証
    await verifyEstimationResultCount(page, {
      label: "推定（登記データあり）",
    });
  });
});
