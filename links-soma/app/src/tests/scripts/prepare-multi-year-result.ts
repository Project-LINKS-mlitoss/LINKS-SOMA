/**
 * 【操作スクリプト】複数年の推定結果データの作成
 *
 * 名寄せを推定日（reference_date）を変えて3回実行し、各回を別名で保存する。
 * その3つを1回の推定でまとめて選択して実行し、複数の reference_date を持つ
 * 推定結果データ（data_set_detail_buildings に複数年の行）を生成する。
 *
 * これは複数年ビュープリセット（system:multi-year-trend）の検証E2E
 * （view-preset-multi-year.e2e.ts, Tier 2: 要データ）が参照する前提データを用意する。
 *
 * 実行方法:
 * cd app && npm run script -- prepare-multi-year-result
 *
 * 所要時間: 15-30分（名寄せ3回 + 推定1回）
 *
 * 前提条件:
 * 1. fixtures/ にサンプルデータが配置済み（run-normalization と同じ）
 * 2. モデルファイルが存在すること（アプリ初期化で自動作成される）
 *
 * 注意: 入力CSVは1組のため、年ごとの違いは reference_date 依存の派生特徴量
 * （年齢・経過年数・平栓フラグ等）に限られる。世帯・水道等の実データは同一。
 *
 * 推定日の制約: 水道使用量の遡り特徴量（suido_usage_f1〜f6）は集計窓（推定日から
 * 遡る1年）の検針だけを使う。fixture の水道データは 2022-04 開始のため、推定日が
 * 窓から外れると使用量特徴量が付かない。2024 以降を用いる。
 */

import { test, expect, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import {
  startNormalizationWizard,
  walkWizard,
} from "../helpers/wizard-operations";
import { saveJobResult } from "../helpers/job-operations";
import {
  navigateAndStartAction,
  fillEstimationFormMultiDataset,
  startPipelineAndNavigateToStatus,
} from "../helpers/pipeline-operations";

/**
 * 生成する年（reference_date は各年の 4/1）。保存名も同じラベルで付ける。
 * 下限は水道の遡り検針が揃う 2024（fixture の水道データは 2022-04〜2025-04）。
 * 上限は fixture 自身が指定する推定日の範囲 2025-04-01（`サンプルデータについて.txt`）。
 */
const YEARS = ["2024", "2025"] as const;
const datasetTitle = (year: string): string => `複数年_${year}`;

let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

// NOTE: 完了後もアプリを開いたままにする（手動確認用）。test.afterAll は意図的に省略。

/** 一覧の先頭行が「完了」になるまでポーリングする（エラー時は例外）。 */
async function pollFirstRowUntilDone(page: Page, label: string): Promise<void> {
  const maxWait = 3600000;
  const interval = 30000;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await page.waitForTimeout(interval);
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    const firstRow = page.locator("table tbody tr").first();
    const statusText = await firstRow.textContent().catch(() => "");

    if (statusText?.includes("完了")) {
      // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
      console.log(`✅ ${label} が完了しました`);
      return;
    }
    if (statusText?.includes("エラー")) {
      throw new Error(`${label} がエラーで終了しました: ${statusText}`);
    }

    const progressMatch = statusText?.match(/進行中\s*(\d+)%/);
    const elapsed = Math.round((Date.now() - startTime) / 60000);
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(
      progressMatch
        ? `⏳ ${label} ${progressMatch[0]} (${elapsed}分経過)`
        : `⏳ ${label} 待機中... (${elapsed}分経過)`,
    );
  }
  throw new Error(`${label} が ${maxWait / 60000} 分以内に完了しませんでした`);
}

test("複数年の推定結果データを作成する", async () => {
  // 名寄せ3回 + 推定1回を考慮した長めのタイムアウト。
  test.setTimeout(3600000);

  // === Step 1: 名寄せを推定日を変えて3回実行し、別名で保存 ===
  for (const year of YEARS) {
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(`📌 名寄せ（${year}-04-01）を開始します`);

    await startNormalizationWizard(page);
    await walkWizard(page, {
      referenceDate: `${year}-04-01`,
      municipality: "千代田区",
      buildingRegistry: "select",
      buildingPolygon: "select",
      buildingTypeDetermination: "select",
      residentialValues: ["住宅", "店舗等併用住宅"],
      vacantHouse: "select",
    });
    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

    await startPipelineAndNavigateToStatus(page, {
      startButton: "開始する",
      confirmMessage: "データ名寄せ処理を開始しました",
      statusHashIncludes: "normalization",
    });
    await pollFirstRowUntilDone(page, `名寄せ（${year}）`);

    await saveJobResult(page, { title: datasetTitle(year) });
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(`✅ 「${datasetTitle(year)}」として保存しました`);
  }

  // === Step 2: 3つの名寄せ済みデータをまとめて選択して推定を1回実行 ===
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log("📌 3つの名寄せ済みデータをまとめて推定します");

  await navigateAndStartAction(page, {
    href: "#evaluation",
    hashIncludes: "evaluation",
    startButton: "空き家推定を始める",
    createHashIncludes: "evaluation/create",
  });

  await fillEstimationFormMultiDataset(page, {
    datasetNames: YEARS.map(datasetTitle),
  });

  await startPipelineAndNavigateToStatus(page, {
    startButton: "推定開始",
    confirmMessage: "分析を開始しました",
    statusHashIncludes: "evaluation",
    createHashExcludes: "create",
  });
  await pollFirstRowUntilDone(page, "空き家推定");

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log(
    "✅ 複数年の推定結果データの作成が完了しました。検証E2E（npm run e2e -- view-preset-multi-year）を実行できます。",
  );
});
