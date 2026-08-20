/**
 * 空き家推定（IF003）正常系 E2E — 保存済み名寄せデータ＋モデルを再利用
 *
 * 名寄せを最初から流さず、既存の保存済み名寄せ済みデータと保存済みモデルを選んで推定を
 * 実行し、ジョブが complete・建物結果が1件以上出ることを end-to-end で確認する。
 *
 * 何を守るか（FR004-007 で E022 に入れた事後検証ガードが「正常データで誤発火しない」こと）:
 * - R-055 説明変数欠損ガード（E-20004）が、モデルと特徴量が一致する実データで発火しない
 * - 説明変数の型不一致ガード（E-201）が、数値特徴量の実データで発火しない
 * - 保存フォールバック（E-20005/20006）の主経路 utf-8-sig で結果CSVが書ける
 * これらの異常系発火自体は ml/tests の統合テストが担保する。本テストは正常系の貫通を見る。
 *
 * 前提: DB に保存済みの名寄せデータ「E2Eテスト_フルデータ」とモデル「汎用モデル」が存在する
 *      （別の保存済みデータ/モデルでも、特徴量が一致していれば DATASET_NAME/MODEL_NAME を変えて流用可）。
 *      DATASET_NAME は部分一致で照合するため、`normalization-estimation-full` が保存する
 *      「E2Eテスト_フルデータ_<日時>」が該当する。空の DB で流すときは同フローを先に通す。
 *
 * 実行方法:
 * cd app && npm run e2e -- estimation-from-saved-dataset
 *
 * 前提: 開発サーバー起動済み + ML バイナリ（ml/dist）ビルド済み。
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import {
  navigateAndStartAction,
  fillEstimationForm,
  startPipelineAndNavigateToStatus,
} from "../../helpers/pipeline-operations";
import {
  waitForJobCompletionById,
  verifyEstimationResultCount,
} from "../../helpers/job-operations";

/** 再利用する保存済み資産（特徴量が一致する組み合わせ） */
const DATASET_NAME = "E2Eテスト_フルデータ";
const MODEL_NAME = "汎用モデル";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

test.describe("空き家推定 正常系（保存済みデータ再利用・FR004-007）", () => {
  test("保存済み名寄せデータとモデルで推定が完了し建物結果が出る", async () => {
    test.setTimeout(3600000);

    await navigateAndStartAction(page, {
      href: "#evaluation",
      hashIncludes: "evaluation",
      startButton: "空き家推定を始める",
      createHashIncludes: "evaluation/create",
    });

    await fillEstimationForm(page, {
      datasetName: DATASET_NAME,
      modelName: MODEL_NAME,
    });

    const { newJobId } = await startPipelineAndNavigateToStatus(page, {
      startButton: "推定開始",
      confirmMessage: "分析を開始しました",
      statusHashIncludes: "evaluation",
      createHashExcludes: "create",
      trackJobType: "result",
      trackLabel: "推定（保存済み再利用）",
    });
    if (newJobId === undefined) {
      throw new Error("推定 jobId が確定していません");
    }

    const status = await waitForJobCompletionById(page, {
      jobId: newJobId,
      type: "result",
      interval: 30000,
      label: "推定（保存済み再利用）",
    });
    expect(status).toBe("complete");

    // complete 表示でも 0 件出力でないこと（E022 が結果CSVを書き DB へ投入できたこと）
    await verifyEstimationResultCount(page, {
      minCount: 1,
      label: "推定（保存済み再利用）",
    });
  });
});
