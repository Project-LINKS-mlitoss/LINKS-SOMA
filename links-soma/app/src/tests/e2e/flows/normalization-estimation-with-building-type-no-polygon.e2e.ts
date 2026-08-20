/**
 * 処理対象選定用データあり + 建物ポリゴンなしの名寄せ・推定 E2Eテスト
 *
 * test-matrix.md N13 対応。
 * - DT213 (geocoding): select
 * - DT119 (building_type_determination): CSV select
 * - DT501 (building_polygon): skip
 *
 * 他 E2E との関係:
 * - N5 (`normalization-estimation-with-building-type`): polygon=select の差分
 * - N4 (`normalization-estimation-without-polygon`): DT119=skip の差分
 * - 本テスト: polygon=skip × DT119=CSV select の未カバー組み合わせ
 *
 * IF001.py コード根拠:
 * - L472-474: has_geocoding かつ polygon 未指定 → E016 が「ジオコーディング座標から
 *   ポイントを生成」モードで動作 (tatemono_path=None)
 * - L712-726: DT119 CSV は merge_building_type_determination (address 結合) で
 *   polygon 非依存
 * - L262/295/361: preprocess_type="e014" 記録は juki/touki/geocoding のみ
 *   → expectedJoinSteps = 1 (juki) + 0 (touki skip) + 1 (geocoding) = 2
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-estimation-with-building-type-no-polygon
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み
 * 2. Pythonバイナリがビルド済み（cd ml && npm run build）
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
  verifyNormalizationJoiningRates,
  verifyEstimationResultCount,
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

/** 保存時に使う固定名（建物種別あり・ポリゴンなしテスト用） */
const SAVED_DATASET_NAME = "E2Eテスト_建物種別ありポリゴンなし";

test.describe("処理対象選定用データあり・ポリゴンなし名寄せ・推定処理", () => {
  test("処理対象選定用データあり・ポリゴンなしで名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    // buildingPolygon=skip + buildingTypeDetermination=select が本テストの差分
    await walkWizard(page, {
      buildingRegistry: "skip",
      buildingPolygon: "skip",
      buildingTypeDetermination: "select",
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
      label: "名寄せ（建物種別あり・ポリゴンなし）",
    });

    expect(finalStatus).toBe("complete");

    // expectedJoinSteps = 1 (juki) + 0 (touki skip) + 1 (geocoding) = 2
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 2,
      label: "名寄せ（建物種別あり・ポリゴンなし）",
    });
  });

  test("名寄せ結果を名前をつけて保存できること", async () => {
    test.setTimeout(60000);

    await saveJobResult(page, { title: SAVED_DATASET_NAME });
  });

  test("建物種別あり・ポリゴンなし名寄せ結果で空き家推定が完了すること", async () => {
    test.setTimeout(3600000);

    await navigateAndStartAction(page, {
      href: "#evaluation",
      hashIncludes: "evaluation",
      startButton: "空き家推定を始める",
      createHashIncludes: "evaluation/create",
    });

    await fillEstimationForm(page, { datasetName: SAVED_DATASET_NAME });

    const { newJobId: resultJobId } = await startPipelineAndNavigateToStatus(
      page,
      {
        startButton: "推定開始",
        confirmMessage: "分析を開始しました",
        statusHashIncludes: "evaluation",
        createHashExcludes: "create",
        trackJobType: "result",
        trackLabel: "推定（建物種別あり・ポリゴンなし）",
      },
    );
    if (resultJobId === undefined) {
      throw new Error("result jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: resultJobId,
      type: "result",
      interval: 30000,
      label: "推定（建物種別あり・ポリゴンなし）",
    });

    expect(finalStatus).toBe("complete");

    // 推定結果件数検証: complete でも 0 件出力されていないか
    await verifyEstimationResultCount(page, {
      label: "推定（建物種別あり・ポリゴンなし）",
    });
  });
});
