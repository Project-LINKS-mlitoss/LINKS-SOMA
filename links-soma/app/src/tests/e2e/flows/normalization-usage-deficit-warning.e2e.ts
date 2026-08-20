/**
 * 水道使用量の完全欠損 警告表示 E2E（FR004-007・E-0020）
 *
 * 名寄せは成功したまま（ジョブ失敗させず）、確認事項バナー（PostWarningBanner）に
 * E-0020 が出ることを end-to-end で確認する。完全欠損は「集計窓（推定基準日から遡る
 * 1年）に検針が1件も無い」状態。ここではサンプル使用量（2022年の検針）に対し基準日を
 * 2020-01-01 に置くことで、全検針を窓の外にして完全欠損を再現する（新規フィクスチャ不要）。
 *
 * バックエンドの発火（aggregate_usage が deficit を返し IF001 が job_task へ記録）は
 * ml/tests の統合テストが担保し、本テストは「警告が UI まで届く・かつ失敗扱いにならない」
 * ことだけを検証する。
 *
 * 実行方法:
 * cd app && npm run e2e -- normalization-usage-deficit-warning
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
  startNormalizationWizard,
  walkWizard,
} from "../../helpers/wizard-operations";
import { startPipelineAndNavigateToStatus } from "../../helpers/pipeline-operations";
import { waitForJobCompletionById } from "../../helpers/job-operations";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

/** ジョブ詳細を再読込し最新 status でマウントし直す（useFetchJobs は非ポーリングのため）。 */
async function reloadPreprocessDetail(
  page: Page,
  jobId: number,
): Promise<void> {
  await page.reload();
  await page.waitForLoadState("load");
  await page.evaluate((id) => {
    window.location.hash = `#/job/detail/${id}/preprocess`;
  }, jobId);
  await page.waitForFunction(
    (id) => window.location.hash.includes(`job/detail/${id}/preprocess`),
    jobId,
    { timeout: 15000 },
  );
  await page.waitForTimeout(1500);
}

test.describe("水道使用量の完全欠損 警告表示（FR004-007）", () => {
  test("集計窓に検針が無い使用量で名寄せすると E-0020 が確認事項として表示され、ジョブは失敗しない", async () => {
    test.setTimeout(3600000);

    await startNormalizationWizard(page);

    // 基準日を 2020-01-01 に置き、サンプル使用量（2022年）を全件、集計窓の外にする。
    // 建物ポリゴン等はスキップして完走の最小構成にする。
    await walkWizard(page, {
      referenceDate: "2020-01-01",
      buildingRegistry: "skip",
      buildingPolygon: "skip",
      buildingTypeDetermination: "skip",
    });

    await expect(page.getByRole("button", { name: "開始する" })).toBeVisible();

    const { newJobId: jobId } = await startPipelineAndNavigateToStatus(page, {
      startButton: "開始する",
      confirmMessage: "データ名寄せ処理を開始しました",
      statusHashIncludes: "normalization",
      draftUrlPathSegment: "normalization",
    });
    if (jobId === undefined) {
      throw new Error("preprocess jobId が確定していません");
    }

    const status = await waitForJobCompletionById(page, {
      jobId,
      type: "preprocess",
      label: "名寄せ（使用量完全欠損 E-0020）",
    });
    // 完全欠損でも名寄せは止めず complete で完了する（非ブロッキング）。
    expect(status).toBe("complete");

    await reloadPreprocessDetail(page, jobId);

    // 確認事項バナー（警告）はちょうど1つ。失敗バナーは出ない。
    const warningTitle = page.getByText("確認事項があります。");
    await expect(warningTitle).toBeVisible({ timeout: 15000 });
    await expect(warningTitle).toHaveCount(1);
    await expect(page.getByText("処理に失敗しました。")).toHaveCount(0);

    // バナー内に E-0020 の本文と対応区分が出る（バナーへスコープして一意に取る）。
    const banner = page.locator("div").filter({ has: warningTitle }).last();
    await expect(banner.getByText(/\[E-0020\]/)).toBeVisible();
    await expect(banner.getByText("データの修正")).toBeVisible();
  });
});
