/**
 * 【操作スクリプト】変化率ヒートマップの表示確認
 *
 * 複数年度の推定結果に対して建物単位の地図ビューを作り、色分け指標を
 * 「空き家推定確率」「変化率（前年度比）」「変化率（最古年度比）」へ順に
 * 切り替えてスクリーンショットを保存する。#1985 の目視確認用。
 *
 * 実行方法:
 * cd app && npm run script -- verify-change-rate-heatmap
 *
 * 前提条件:
 * 1. 複数年度の推定結果が存在すること（prepare-multi-year-result を先に実行）
 * 2. ml/dist が変化率算出を含む版であること（`cd ml && npm run build -- IF003`）。
 *    古いバイナリでは変化率が全行 NULL になり、地図が全てグレーになる
 * 3. app/public/basemap.pmtiles が配置済みであること（未配置だと地図が白くなる）
 *
 * 出力: app/test-results/change-rate-heatmap/*.png
 */

import path from "path";
import { test, expect, type Page } from "@playwright/test";
import { setupApp } from "../helpers/app-setup";
import { navigateTo } from "../helpers/navigation-helper";

const WORKBOOK_NAME = "変化率ヒートマップ確認";
const VIEW_TITLE = "変化率マップ";
const SHOT_DIR = path.join("test-results", "change-rate-heatmap");

/** 建物ポリゴンが描画されるズーム（13）まで寄せるためのダブルクリック回数 */
const ZOOM_IN_STEPS = 3;

/** 色分けドロップダウンの選択肢。地図上部の「色分けの基準」欄に出る */
const COLOR_OPTIONS = [
  { label: "空き家推定確率", shot: "01-probability.png" },
  { label: "空き家推定確率の変化率（前年度比）", shot: "02-from-previous.png" },
  { label: "空き家推定確率の変化率（最古年度比）", shot: "03-from-oldest.png" },
] as const;

let page: Page;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  ({ page } = await setupApp());
});

// NOTE: 完了後もアプリを開いたままにする（手動確認用）。test.afterAll は意図的に省略。

test("変化率ヒートマップの色分けを切り替えて撮影する", async () => {
  test.setTimeout(600000);

  // === Step 1: ワークブックを用意する ===
  const workbookExists = await page.evaluate(async (title: string) => {
    const workbooks = await window.ipcRenderer.invoke("selectWorkbooks");
    return workbooks.some((wb: { title: string | null }) => wb.title === title);
  }, WORKBOOK_NAME);

  await navigateTo(page, "#analysis/workbook");
  await page.waitForTimeout(1000);

  if (!workbookExists) {
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(`📌 ワークブック「${WORKBOOK_NAME}」を作成します`);
    await page.getByRole("button", { name: "新規ワークブック作成" }).click();
    await page.waitForSelector('[role="dialog"]');
    await page
      .locator('[role="dialog"]')
      .locator('input[type="text"]')
      .fill(WORKBOOK_NAME);
    await page
      .locator('[role="dialog"]')
      .getByRole("button", { name: "保存" })
      .click();
    await page.waitForSelector('[role="dialog"]', { state: "hidden" });
    await page.waitForFunction(
      () => window.location.hash.includes("/edit"),
      undefined,
      { timeout: 10000 },
    );
    await page.waitForTimeout(2000);

    // === Step 2: 建物単位の地図ビューを追加する ===
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(`📌 ビュー「${VIEW_TITLE}」を追加します`);
    // 「ビューを追加」は2ステップダイアログ（#1909）。「空から作る」→推定結果を選ぶ、で
    // 空ビューが1つ作られ、続くサイドバーフォームで種類と集計単位を決める。
    await page.getByRole("button", { name: "ビューを追加" }).click();
    await page.waitForSelector('[role="dialog"]');
    const addDialog = page.locator('[role="dialog"]');

    await addDialog.getByText("空から作る", { exact: true }).click();
    await addDialog.getByRole("button", { name: "次へ" }).click();
    await page.waitForTimeout(500);

    // 複数年度の推定結果を選ぶ。prepare-multi-year-result が作った最新結果が先頭に来る。
    // Select は推定結果の取得完了後に描画されるため、option の出現を待ってから読む。
    const datasetSelect = addDialog.getByLabel("データセットを選択");
    await expect(datasetSelect.locator("option").first()).toBeAttached({
      timeout: 30000,
    });
    const firstValue = await datasetSelect
      .locator("option")
      .first()
      .getAttribute("value");
    if (firstValue) {
      await datasetSelect.selectOption(firstValue);
      await page.waitForTimeout(300);
    }

    await addDialog.getByRole("button", { name: "追加する" }).click();
    await page.waitForSelector('[role="dialog"]', { state: "hidden" });
    await page.waitForTimeout(2000);

    await expect(page.getByText("ビューの設定")).toBeVisible({
      timeout: 10000,
    });

    const titleInput = page.getByLabel("ビューのタイトル");
    await titleInput.clear();
    await titleInput.fill(VIEW_TITLE);

    await page.getByLabel("種類").selectOption("地図");
    await page.waitForTimeout(500);
    await page.getByLabel("集計単位").selectOption("建物");
    await page.waitForTimeout(300);

    await page.getByRole("button", { name: "入力内容を保存する" }).click();
    await expect(page.getByText("保存が完了しました")).toBeVisible({
      timeout: 10000,
    });
    await page.waitForTimeout(1000);
  } else {
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(
      `✅ ワークブック「${WORKBOOK_NAME}」は既に存在します。表示のみ行います。`,
    );
    await page.getByText(WORKBOOK_NAME).first().click();
    await page.waitForTimeout(3000);

    // ビュー作成前に中断すると、ワークブックだけが残り以降の実行が作成経路を飛ばす。
    // 空のワークブックを開き続けても原因が読めないため、ここで検出して手当てを促す。
    const hasView = await page
      .getByText(VIEW_TITLE)
      .first()
      .isVisible()
      .catch(() => false);
    if (!hasView) {
      throw new Error(
        `ワークブック「${WORKBOOK_NAME}」にビュー「${VIEW_TITLE}」がありません。前回の実行がビュー作成前に中断した可能性があります。ワークブックを削除してから再実行してください。`,
      );
    }
  }

  // === Step 3: 地図の描画を待って色分けを切り替える ===
  // ポリゴン描画はズーム閾値（building=13）以上でのみ行われる。
  // 初期表示で警告が出る場合はデータ中心へ寄せるボタンで解消する。
  await page.waitForTimeout(5000);

  const zoomWarning = page.getByText("ズームインすると建物が表示されます");
  if (await zoomWarning.isVisible().catch(() => false)) {
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log("📌 ズームが浅いため、データ中心へ移動します");
    const centerButton = page.getByRole("button", { name: /中心|データ/ });
    if (
      await centerButton
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await centerButton.first().click();
      await page.waitForTimeout(3000);
    }
  }

  // 初期状態を1枚残す（色分けコントロールの有無・地図の描画状態の切り分け用）
  await page.screenshot({ path: path.join(SHOT_DIR, "00-initial.png") });

  const colorDropdown = page.getByLabel("色分けの基準");
  const hasColorControl = await colorDropdown.isVisible().catch(() => false);

  if (!hasColorControl) {
    throw new Error(
      "色分けの選択肢が表示されていません。推定結果が単一年度か、変化率が全行 NULL の可能性があります（ml/dist の再ビルドを確認してください）",
    );
  }

  // ポリゴン描画はズーム13以上。既定ズームでは建物が点にしか見えないため、
  // 地図中央をダブルクリックして寄せる（MapLibre の既定ズーム操作）。
  const mapCanvas = page.locator("canvas").first();
  const canvasBox = await mapCanvas.boundingBox();
  if (canvasBox) {
    const centerX = canvasBox.x + canvasBox.width / 2;
    const centerY = canvasBox.y + canvasBox.height / 2;
    for (let i = 0; i < ZOOM_IN_STEPS; i++) {
      await page.mouse.dblclick(centerX, centerY);
      await page.waitForTimeout(1200);
    }
    await page.waitForTimeout(3000);
  }

  for (const [index, option] of COLOR_OPTIONS.entries()) {
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(`📌 色分けを「${option.label}」に切り替えます`);
    await colorDropdown.click();
    // Fluent UI の Dropdown は listbox を遅延生成するため、開ききるまで待つ
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 10000 });
    // 選択肢のラベルは前方一致で重なる（「空き家推定確率」と「…の変化率（前年度比）」）ため、
    // 名前ではなく ColorColumnControl の定義順（確率→前年度比→最古年度比）で選ぶ
    await listbox.getByRole("option").nth(index).click();
    // レイヤー再構築とタイル再描画の完了を待つ
    await page.waitForTimeout(4000);

    await page.screenshot({ path: path.join(SHOT_DIR, option.shot) });
    // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
    console.log(`✅ ${option.shot} を保存しました`);
  }

  // eslint-disable-next-line no-console -- 操作スクリプトの進捗表示
  console.log(`✅ 撮影が完了しました。出力先: app/${SHOT_DIR}`);
});
