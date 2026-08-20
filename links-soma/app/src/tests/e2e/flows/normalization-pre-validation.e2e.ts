/**
 * 名寄せウィザードの事前バリデーション（軽量チェック）表示
 *
 * データセットステップでファイル・カラムを設定すると、フォーム下の「データチェック」
 * パネルが実検証結果（サンプリング・三値）を表示することを確認する。パイプラインは
 * 実行しない（軽量ゲートのみ）。
 *
 * 検証する観点:
 * - 一意性の非検査（PV-07）: 水道番号が重複しても項目を出さない。1メーターに開栓・閉栓の
 *   履歴行が並ぶのは正常で、本体（water.py）が無条件 dedup で畳むため警告が偽陽性になる
 * - 参照整合（PV-08・クロスファイル）: 子（水道使用量）の水道番号 Z999 が
 *   親（水道開閉栓状況）に無いことを検出。親全件×子サンプルの片側性を画面まで貫通する
 * - 表示の出し分け: 発見された問題（warn/error）だけを表で出し、ok/pending は出さない。
 *   違反の有無と truncated で warn/pending が決まることを、問題のみ表示の画面で確かめる
 *
 * 実行方法:
 * E2E_DEV_MODE=true npx playwright test normalization-pre-validation
 */

import * as path from "path";
import {
  test,
  expect,
  type ElectronApplication,
  type Locator,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import {
  startNormalizationWizard,
  selectColumns,
  selectDatasetByName,
  clickNext,
} from "../../helpers/wizard-operations";

const FIXTURE = path.join(
  __dirname,
  "../../fixtures/事前バリ_water_status_一意性重複.csv",
);
const FIXTURE_REF = path.join(
  __dirname,
  "../../fixtures/事前バリ_water_usage_参照整合.csv",
);
// ok + 注意（一意性・日付形式・欠損）を1画面に混在させる（≤1000行・全件読了）。
const FIXTURE_WARN_MIX = path.join(
  __dirname,
  "../../fixtures/事前バリ_water_status_ok警告混在.csv",
);
// 注意 + 保留（pending）を混在させる（>1000行・打ち切り）。clear↔unknown は truncated で切替。
const FIXTURE_PENDING_MIX = path.join(
  __dirname,
  "../../fixtures/事前バリ_water_status_警告保留混在.csv",
);

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });
test.setTimeout(120000);

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

/** データセット選択ダイアログから指定パスのCSVをアップロードして選択する。 */
async function uploadFixture(page: Page, filePath: string): Promise<void> {
  await page.getByText("データセットを選択").click();
  await page.waitForSelector('[role="dialog"]');
  await page.getByRole("tab", { name: "新規アップロード" }).click();
  await page.waitForTimeout(300);
  await page
    .locator('[role="dialog"] input[type="file"]')
    .setInputFiles(filePath);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "選択" }).last().click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden" });
}

/**
 * データチェックパネル（カード）。カラム名・観点・メッセージは別要素に分かれたため、
 * パネルにスコープして toContainText で行内容を検証する（側パネルの同名語を拾わない）。
 */
function panel(page: Page): Locator {
  return page.getByText("データチェック").locator("xpath=../..");
}

test.describe("事前バリデーション（軽量チェック）", () => {
  test("水道番号が重複しても重複の注意を出さない", async () => {
    await startNormalizationWizard(page);

    // イントロ → 基本設定
    await clickNext(page);
    await page.locator('input[type="date"]').fill("2024-01-01");
    await page.getByPlaceholder("市区町村名を入力").fill("テスト市");
    await clickNext(page);

    // 水道開閉栓状況: 専用フィクスチャをアップロード + カラムマッピング
    await uploadFixture(page, FIXTURE);
    await selectColumns(page, "water_status");

    // A001 が2行あるが（開栓中の行＋使用中止日ありの行）、重複の注意は出さない。
    // 他観点も違反がないため、パネルは「問題は確認されませんでした」の1行になる。
    // 否定アサートはパネル描画を待ってから行う（描画前は無条件に通り検証にならない）。
    await expect(page.getByText("データチェック")).toBeVisible();
    await expect(panel(page)).toContainText("問題は確認されませんでした");
    await expect(panel(page)).not.toContainText("重複");
    await expect(page.getByText("「A001」が複数の行にあります")).toHaveCount(0);
  });

  test("水道使用量の参照整合で親に無い水道番号を検出し注意表示する", async () => {
    await startNormalizationWizard(page);

    // イントロ → 基本設定
    await clickNext(page);
    await page.locator('input[type="date"]').fill("2024-01-01");
    await page.getByPlaceholder("市区町村名を入力").fill("テスト市");
    await clickNext(page);

    // 水道開閉栓状況（親）: 標準フィクスチャ + カラムマッピング
    await selectDatasetByName(page, "水道開閉栓状況");
    await selectColumns(page, "water_status");
    await clickNext(page);

    // 水道使用量（子）: 親に存在しない水道番号 Z999 を含む専用フィクスチャ
    await uploadFixture(page, FIXTURE_REF);
    await selectColumns(page, "water_usage");

    // データチェックパネルが参照整合の不整合（Z999）を平易ラベル「ひも付け」で表示する
    await expect(page.getByText("データチェック")).toBeVisible();
    await expect(panel(page)).toContainText("水道番号");
    await expect(panel(page)).toContainText("ひも付け");
    await expect(
      page.getByText("「Z999」に対応する行が参照先にありません"),
    ).toBeVisible();
  });

  test("注意（日付形式・欠損）を表で出し ok は出さない", async () => {
    await startNormalizationWizard(page);

    // イントロ → 基本設定
    await clickNext(page);
    await page.locator('input[type="date"]').fill("2024-01-01");
    await page.getByPlaceholder("市区町村名を入力").fill("テスト市");
    await clickNext(page);

    // 水道開閉栓状況: 日付形式=注意（不明）/ 欠損=注意（空住所）
    // 必須欠損なし（水道番号）= ok。B001 は重複するが一意性は検査しない。
    await uploadFixture(page, FIXTURE_WARN_MIX);
    await selectColumns(page, "water_status");

    await expect(page.getByText("データチェック")).toBeVisible();
    await expect(page.getByText("要確認 2 件")).toBeVisible();
    await expect(
      page.getByText("「不明」を日付として読めません"),
    ).toBeVisible();
    await expect(page.getByText("空の行があります")).toBeVisible();
    // 一意性は検査しないので重複行は出ない。
    await expect(page.getByText("「B001」が複数の行にあります")).toHaveCount(0);
    // ok（目安）は表に出さない。問題を「カラム / 種類 / 内容」で出し、但し書きは表の下に1回。
    await expect(panel(page)).toContainText("種類");
    await expect(panel(page)).toContainText("内容");
    await expect(panel(page)).toContainText(
      "全件のチェックは、名寄せ処理実行時に行われます",
    );
    await expect(panel(page)).not.toContainText("サンプル内に欠損なし");
  });

  test("打ち切り（>1000行）で注意を表で出し保留（pending）は出さない", async () => {
    await startNormalizationWizard(page);

    // イントロ → 基本設定
    await clickNext(page);
    await page.locator('input[type="date"]').fill("2024-01-01");
    await page.getByPlaceholder("市区町村名を入力").fill("テスト市");
    await clickNext(page);

    // 1200行: 先頭に不正日付「不明」を仕込み日付形式=注意。他は打ち切りで clear 確定不能 → pending。
    await uploadFixture(page, FIXTURE_PENDING_MIX);
    await selectColumns(page, "water_status");

    await expect(page.getByText("データチェック")).toBeVisible();
    await expect(page.getByText("要確認 1 件")).toBeVisible();
    await expect(
      page.getByText("「不明」を日付として読めません"),
    ).toBeVisible();
    // pending（打ち切りで確定保留）は表に出さない。問題のみ表示＋但し書き1回。
    await expect(panel(page)).toContainText(
      "全件のチェックは、名寄せ処理実行時に行われます",
    );
    // 個別の pending 行メッセージはもう出さない
    await expect(page.getByText("サンプル内に欠損なし")).toHaveCount(0);
  });
});
