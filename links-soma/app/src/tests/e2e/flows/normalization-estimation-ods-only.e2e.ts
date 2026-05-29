/**
 * 説明変数追加用データのみ付与した最小構成の名寄せ・推定 E2Eテスト
 *
 * test-matrix.md N18 対応。
 * 必須データ (水道閉開栓・水道使用量・住基・国勢調査) + optional_data_source のみ。
 * 他 optional (geocoding / building_registry / building_polygon /
 * building_type_determination / vacant_house) はすべて skip。
 *
 * 既存 E2E との関係:
 * - `normalization-ods-acceptance` は full 構成 (juki + touki + geo + polygon + ODS)。
 *   本テストは ODS の最小構成 (他全 optional skip) を初めてカバーする
 * - N19 (`normalization-estimation-vacant-house-only`) と対比:
 *   両方 expectedJoinSteps=1 だが N19=labels 経路、本テスト=ods 経路
 *
 * ODS の経路 (コード根拠):
 * - IF001.py:378-388: runtime_cfg["optional_data_source"] があれば
 *   merge_optional_data_source(df, ods_cfg, data_dir) を呼ぶ
 * - optional_data_source.py:21-56: 単純な df.merge(how="left") で
 *   _ods 接尾辞付きカラムを追加するだけ。create_or_update_job_task を呼ばない
 *   → expectedJoinSteps = 1 (juki) + 0 (touki skip) + 0 (geocoding skip) = 1
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-estimation-ods-only
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

/** 保存時に使う固定名（ODS のみ最小構成テスト用） */
const SAVED_DATASET_NAME = "E2Eテスト_ODSのみ最小構成";

test.describe("ODS のみ付与最小構成名寄せ・推定処理", () => {
  test("ODS のみ付与最小構成で名寄せ処理が完了すること", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    // optionalDataSource=select、他 optional は全 skip が本テストの差分
    await walkWizard(page, {
      geocoding: "skip",
      buildingRegistry: "skip",
      buildingPolygon: "skip",
      buildingTypeDetermination: "skip",
      vacantHouse: "skip",
      optionalDataSource: "select",
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
      label: "名寄せ（ODS のみ付与最小構成）",
    });

    expect(finalStatus).toBe("complete");

    // expectedJoinSteps = 1 (juki) のみ
    // (touki/geocoding=skip、ODS は merge_optional_data_source で e014 task を作らない)
    await verifyNormalizationJoiningRates(page, {
      expectedJoinSteps: 1,
      label: "名寄せ（ODS のみ付与最小構成）",
    });
  });

  test("名寄せ結果を名前をつけて保存できること", async () => {
    test.setTimeout(60000);

    await saveJobResult(page, { title: SAVED_DATASET_NAME });
  });

  test("ODS のみ付与最小構成名寄せ結果で空き家推定が完了すること", async () => {
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
        startButton: "分析開始",
        confirmMessage: "分析を開始しました",
        statusHashIncludes: "evaluation",
        createHashExcludes: "create",
        trackJobType: "result",
        trackLabel: "推定（ODS のみ付与最小構成）",
      },
    );
    if (resultJobId === undefined) {
      throw new Error("result jobId が確定していません");
    }

    const finalStatus = await waitForJobCompletionById(page, {
      jobId: resultJobId,
      type: "result",
      interval: 30000,
      label: "推定（ODS のみ付与最小構成）",
    });

    expect(finalStatus).toBe("complete");

    // 推定結果件数検証: complete でも 0 件出力されていないか
    await verifyEstimationResultCount(page, {
      label: "推定（ODS のみ付与最小構成）",
    });
  });
});
