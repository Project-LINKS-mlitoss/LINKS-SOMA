/**
 * 【操作スクリプト】段階別処理時間表示 + 証跡DL（実行ログ同梱）
 *
 * 名寄せ → モデル構築 → 推定 を一気通貫実行し、各処理結果画面の
 * 「処理時間」内訳（段階別）を開いてスクリーンショットを撮り、
 * 証跡DLに同梱される実行ログを取得して出力する。
 *
 * 出力先: app/stage-timing-verify-output/
 *   - {処理}-画面.png      … 処理結果画面（処理時間の段階別内訳を展開済み）
 *   - {処理}-証跡DL.txt    … 証跡DLボタンで保存されるファイル（download 取得できた場合）
 *   - {処理}-同梱ログ.txt  … 証跡DL末尾に同梱されるジョブ単位ログ（selectJobLog IPC）
 *
 * 完了後もアプリは開いたまま（手動確認用）。test.afterAll は意図的に省略。
 *
 * 実行: cd app && npm run script -- verify-stage-timing
 * 構成: 建物ポリゴンなし（軽量）/ ジオコーディング・登記・空き家調査あり
 */

import * as fs from "fs";
import * as path from "path";
import { test, expect, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import {
  startNormalizationWizard,
  walkWizard,
} from "../helpers/wizard-operations";
import {
  waitForJobCompletionById,
  saveJobResult,
  generateJobName,
} from "../helpers/job-operations";
import {
  navigateAndStartAction,
  fillModelBuildingForm,
  fillEstimationForm,
  startPipelineAndNavigateToStatus,
} from "../helpers/pipeline-operations";

let page: Page;
const OUT_DIR = path.join(process.cwd(), "stage-timing-verify-output");

const log = (m: string): void => {
  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log(m);
};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  ({ page } = await setupApp());
});

// NOTE: 完了後もアプリを開いたままにする（手動確認用）。test.afterAll は意図的に省略

/** 処理結果画面で段階別内訳を開いてスクショ + 証跡DL内容を出力する */
async function captureProcessScreen(
  jobId: number,
  type: string,
  label: string,
): Promise<void> {
  await page.evaluate(
    ([id, t]) => {
      window.location.hash = `#/job/detail/${id}/${t}`;
    },
    [jobId, type] as const,
  );
  await page.waitForLoadState("load");
  await page.waitForTimeout(2500);

  // 「処理時間」の内訳トグルを開いて段階別を表示
  const toggle = page.getByRole("button", { name: "内訳" });
  if ((await toggle.count()) > 0) {
    await toggle.first().click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({
    path: path.join(OUT_DIR, `${label}-画面.png`),
    fullPage: true,
  });

  // 証跡DL（Blob ダウンロード）。Electron で download イベント不捕捉の場合に備え try
  try {
    const dlPromise = page.waitForEvent("download", { timeout: 8000 });
    await page.getByRole("button", { name: "検証情報をダウンロード" }).click();
    const dl = await dlPromise;
    await dl.saveAs(path.join(OUT_DIR, `${label}-証跡DL.txt`));
    log(`💾 [${label}] 証跡DLファイル取得`);
  } catch {
    log(`⚠️ [${label}] download イベント不捕捉（内容は同梱ログで確認）`);
  }

  // 証跡DL末尾に同梱されるジョブ単位ログを IPC で取得して保存
  const logText = await page.evaluate(
    (id: number) => window.ipcRenderer.invoke("selectJobLog", { jobId: id }),
    jobId,
  );
  fs.writeFileSync(
    path.join(OUT_DIR, `${label}-同梱ログ.txt`),
    String(logText ?? "(ログ未取得)"),
    "utf-8",
  );
  log(`📸 [${label}] スクショ + 同梱ログ出力完了`);
}

test("名寄せ→モデル構築→推定を実行し各画面と証跡を生成する", async () => {
  test.setTimeout(3600000);

  // ─── 名寄せ ───
  log("🚀 名寄せ開始");
  await startNormalizationWizard(page);
  await walkWizard(page, {
    geocoding: "select",
    buildingRegistry: "select",
    buildingPolygon: "skip",
    buildingTypeDetermination: "select",
    vacantHouse: "select",
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
  if (preprocessJobId === undefined) throw new Error("preprocess jobId 未確定");
  expect(
    await waitForJobCompletionById(page, {
      jobId: preprocessJobId,
      type: "preprocess",
      label: "名寄せ",
    }),
  ).toBe("complete");
  await captureProcessScreen(preprocessJobId, "preprocess", "1_名寄せ");
  const savedDatasetName = await generateJobName(page, "段階別処理時間検証");
  await saveJobResult(page, { title: savedDatasetName });

  // ─── モデル構築 ───
  log("🚀 モデル構築開始");
  await navigateAndStartAction(page, {
    href: "#model",
    hashIncludes: "model",
    startButton: "モデル構築を始める",
    createHashIncludes: "model/create",
  });
  await fillModelBuildingForm(page, { datasetName: savedDatasetName });
  const { newJobId: mlJobId } = await startPipelineAndNavigateToStatus(page, {
    startButton: "モデル構築開始",
    confirmMessage: "モデル構築処理を開始しました",
    statusHashIncludes: "model",
    createHashExcludes: "create",
    trackJobType: "ml",
    trackLabel: "モデル構築",
  });
  if (mlJobId === undefined) throw new Error("ml jobId 未確定");
  expect(
    await waitForJobCompletionById(page, {
      jobId: mlJobId,
      type: "ml",
      tableIndex: 1,
      interval: 30000,
      label: "モデル構築",
    }),
  ).toBe("complete");
  await captureProcessScreen(mlJobId, "ml", "2_モデル構築");
  const savedModelName = await generateJobName(
    page,
    "段階別処理時間検証モデル",
  );
  await saveJobResult(page, {
    title: savedModelName,
    tableIndex: 1,
    skipVerification: true,
  });
  await page.reload();
  await page.waitForLoadState("load");
  await page.waitForTimeout(2000);

  // ─── 推定 ───
  log("🚀 推定開始");
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
      trackLabel: "推定",
    },
  );
  if (resultJobId === undefined) throw new Error("result jobId 未確定");
  expect(
    await waitForJobCompletionById(page, {
      jobId: resultJobId,
      type: "result",
      interval: 30000,
      label: "推定",
    }),
  ).toBe("complete");
  await captureProcessScreen(resultJobId, "result", "3_推定");

  log(
    "✅ 完了: app/stage-timing-verify-output/ に各画面のスクショと証跡を出力しました",
  );
});
