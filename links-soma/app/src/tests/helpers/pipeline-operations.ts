/**
 * パイプライン操作ヘルパー
 *
 * モデル構築・空き家推定のフォーム入力操作を提供する。
 * ダイアログからのデータ選択、カラム設定など、複数テストで共通する操作を共通化する。
 */

import { expect, type Page } from "@playwright/test";
import {
  snapshotJobIds,
  captureNewJobId,
  getDraftJobIdFromUrl,
  type JobType,
} from "./job-operations";

// ============================================================
// データ選択ダイアログ操作
// ============================================================

/**
 * ダイアログ内のテーブルからデータ行を選択する
 *
 * 「選択」「インポート」等のボタンでダイアログを開き、
 * テーブルから条件に一致する行を選択して確定する。
 *
 * @param searchText - 行を絞り込むテキスト。省略時は先頭行を選択
 * @param confirmButton - 確定ボタンのテキスト
 */
export async function selectFromDialog(
  page: Page,
  options: {
    /** ダイアログを開くボタンのロケーター */
    triggerButton: ReturnType<Page["locator"]>;
    /** 行を絞り込むテキスト。省略時は先頭行を選択 */
    searchText?: string | RegExp;
    /** 確定ボタンのテキスト。デフォルト: "データを決定" */
    confirmButton?: string;
    /** 行が見つからない場合のエラーメッセージ */
    notFoundMessage?: string;
  },
): Promise<void> {
  const confirmButton = options.confirmButton ?? "データを決定";

  await options.triggerButton.click();
  await page.waitForSelector('[role="dialog"]');

  const dialogRows = page.locator('[role="dialog"] table tbody tr');

  let targetRow;
  if (options.searchText) {
    targetRow = dialogRows.filter({ hasText: options.searchText });
    if (options.notFoundMessage) {
      expect(
        await targetRow.count(),
        options.notFoundMessage,
      ).toBeGreaterThan(0);
    }
  } else {
    targetRow = dialogRows.first();
  }

  await targetRow.first().click();
  await page.getByRole("button", { name: confirmButton }).click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden" });
  await page.waitForTimeout(500);
}

// ============================================================
// 画面遷移
// ============================================================

/**
 * 指定画面に遷移してアクションを開始する
 *
 * ナビゲーションリンクをクリック → 画面遷移を待機 → 開始ボタンをクリック → 作成画面への遷移を待機
 */
export async function navigateAndStartAction(
  page: Page,
  options: {
    /** ナビゲーションリンクのhref（例: "#evaluation"） */
    href: string;
    /** ハッシュの一致条件 */
    hashIncludes: string;
    /** 開始ボタンのテキスト（例: "空き家推定を始める"） */
    startButton: string;
    /** 作成画面のハッシュ条件（例: "evaluation/create"） */
    createHashIncludes: string;
  },
): Promise<void> {
  await page.locator(`a[href="${options.href}"]`).click();
  await page.waitForFunction(
    (hash) => window.location.hash.includes(hash),
    options.hashIncludes,
    { timeout: 10000 },
  );
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: options.startButton }).click();
  await page.waitForFunction(
    (hash) => window.location.hash.includes(hash),
    options.createHashIncludes,
    { timeout: 10000 },
  );
  await page.waitForTimeout(1000);
}

// ============================================================
// 空き家推定フォーム
// ============================================================

/**
 * 空き家推定フォームを入力する
 *
 * ① 分析対象データを選択
 * ② モデルファイルを選択
 * ③ 地域集計用データを選択 + カラム設定（KEY_CODE / S_NAME）
 *
 * @param datasetName - 名寄せ処理済みデータの名前。省略時は先頭行を選択
 * @param modelName - モデルファイルの名前。省略時は先頭行を選択
 */
export async function fillEstimationForm(
  page: Page,
  options: {
    /** 分析対象データの名前。省略時は先頭行を選択 */
    datasetName?: string | RegExp;
    /** モデルファイルの名前。省略時は先頭行を選択（注意: 汎用モデルが先頭に来る場合がある。自前モデルを使う場合は明示指定を推奨） */
    modelName?: string | RegExp;
  } = {},
): Promise<void> {
  // ① 分析対象データを選択
  await selectFromDialog(page, {
    triggerButton: page.getByRole("button", { name: "選択" }).first(),
    searchText: options.datasetName,
    confirmButton: "データを決定",
    notFoundMessage: options.datasetName
      ? `名寄せ処理済みデータ「${String(options.datasetName)}」が選択ダイアログに表示されること`
      : undefined,
  });

  // ② モデルファイルを選択（①で選択済みのため残りの「選択」ボタンの先頭を使用）
  await selectFromDialog(page, {
    triggerButton: page.getByRole("button", { name: "選択" }).first(),
    searchText: options.modelName,
    confirmButton: "データを決定",
    notFoundMessage: options.modelName
      ? `モデル「${String(options.modelName)}」が選択ダイアログに表示されること`
      : undefined,
  });

  // ③ 地域集計用データを選択（国勢調査シェープファイル）
  await selectFromDialog(page, {
    triggerButton: page.getByRole("button", { name: "選択" }).first(),
    searchText: /国勢調査/,
    confirmButton: "データを決定",
    notFoundMessage: "国勢調査シェープファイルが選択ダイアログに表示されること",
  });
  // 地域集計用データ選択後は少し長めに待機（カラムドロップダウンの描画待ち）
  await page.waitForTimeout(500);

  // カラム設定
  await configureAreaColumns(page);
}

/**
 * 地域集計用データのカラムドロップダウンを設定する
 *
 * area_group_id → KEY_CODE、area_group_name → S_NAME
 */
export async function configureAreaColumns(
  page: Page,
  options: {
    /** area_group_id に設定するカラム名。デフォルト: "KEY_CODE" */
    areaIdColumn?: string;
    /** area_group_name に設定するカラム名。デフォルト: "S_NAME" */
    areaNameColumn?: string;
  } = {},
): Promise<void> {
  const areaIdColumn = options.areaIdColumn ?? "KEY_CODE";
  const areaNameColumn = options.areaNameColumn ?? "S_NAME";

  const areaIdDropdown = page.locator("#area-id-dropdown");
  await expect(areaIdDropdown).toBeVisible({ timeout: 10000 });
  await areaIdDropdown.click();
  await page.getByRole("option", { name: areaIdColumn }).click();
  await page.waitForTimeout(300);

  const areaNameDropdown = page.locator("#area-name-dropdown");
  await areaNameDropdown.click();
  await page.getByRole("option", { name: areaNameColumn }).click();
  await page.waitForTimeout(300);
}

// ============================================================
// モデル構築フォーム
// ============================================================

/**
 * モデル構築フォームを入力する
 *
 * ① 名寄せ済みデータセットをインポート
 * ② 説明変数カラム設定（オプション）
 *
 * @param datasetName - インポートする名寄せ済みデータの名前。省略時は先頭行を選択
 * @param configureColumns - カラム設定のカスタム関数。省略時はデフォルト値を使用
 */
export async function fillModelBuildingForm(
  page: Page,
  options: {
    /** インポートする名寄せ済みデータの名前。省略時は先頭行を選択 */
    datasetName?: string | RegExp;
    /** 説明変数カラム設定のカスタム関数。省略時はデフォルト値を使用 */
    configureColumns?: (page: Page) => Promise<void>;
  } = {},
): Promise<void> {
  // ① 名寄せ済みデータセットをインポート
  await selectFromDialog(page, {
    triggerButton: page.getByRole("button", { name: "インポート" }).first(),
    searchText: options.datasetName,
    confirmButton: "選択",
    notFoundMessage: options.datasetName
      ? `名寄せ処理済みデータ「${String(options.datasetName)}」がインポートダイアログに表示されること`
      : undefined,
  });

  // ② 説明変数カラム設定（カスタム関数が指定されていれば実行）
  if (options.configureColumns) {
    await options.configureColumns(page);
  }
}

// ============================================================
// パイプライン開始・完了フロー
// ============================================================

/**
 * パイプライン処理を開始してステータス確認画面に遷移する
 *
 * 「開始」ボタンクリック → 開始メッセージ確認 → 「処理のステータスを確認」で一覧に遷移
 *
 * `trackJobType` を指定すると、Start ボタン押下前後で `selectJobs({type})` の
 * スナップショット差分を取り、新規作成された jobId を `{ newJobId }` として返す。
 * 返値の jobId を `waitForJobCompletionById` に渡すことで、位置ベース同定の脆弱性を
 * 避けた ID ベースの完了待機が可能になる。
 */
export async function startPipelineAndNavigateToStatus(
  page: Page,
  options: {
    /** 開始ボタンのテキスト（例: "分析開始", "モデル構築開始"） */
    startButton: string;
    /** 開始後に表示される確認メッセージ */
    confirmMessage: string;
    /** ステータス確認画面のハッシュ条件 */
    statusHashIncludes: string;
    /** create画面のハッシュ（除外条件として使用） */
    createHashExcludes?: string;
    /**
     * 新規作成される jobId を snapshot 差分で追跡する場合に指定するジョブ type。
     * 指定時、返値の `newJobId` に確定した ID が入る。
     */
    trackJobType?: JobType;
    /** エラーメッセージ用の識別ラベル（`trackJobType` と併用） */
    trackLabel?: string;
    /**
     * draft 機構を使う画面（名寄せウィザード等）で、Start 押下**前**に
     * URL hash から draft jobId を抽出する場合に指定する path セグメント。
     * 例: "normalization" → `#/normalization/create/{id}` から id を抽出。
     *
     * `trackJobType` と併用不可（draft パスでは execE001 が update のため
     * snapshot 差分では新規 insert が観測できない）。
     */
    draftUrlPathSegment?: string;
  },
): Promise<{ newJobId?: number }> {
  if (options.trackJobType && options.draftUrlPathSegment) {
    throw new Error(
      "startPipelineAndNavigateToStatus: trackJobType と draftUrlPathSegment は併用できません",
    );
  }

  // draft 機構の場合は Start 押下前に URL から jobId を確定する
  const draftJobId = options.draftUrlPathSegment
    ? await getDraftJobIdFromUrl(page, options.draftUrlPathSegment)
    : undefined;

  // Start ボタン押下前のジョブ ID 集合をスナップショット（snapshot 差分追跡時のみ）
  const beforeIds = options.trackJobType
    ? await snapshotJobIds(page, options.trackJobType)
    : null;

  await page.getByRole("button", { name: options.startButton }).click();

  await expect(page.getByText(options.confirmMessage)).toBeVisible({
    timeout: 30000,
  });

  await page.getByRole("button", { name: "処理のステータスを確認" }).click();

  if (options.createHashExcludes) {
    await page.waitForFunction(
      ([hash, excludeHash]) =>
        window.location.hash.includes(hash) &&
        !window.location.hash.includes(excludeHash),
      [options.statusHashIncludes, options.createHashExcludes] as const,
      { timeout: 10000 },
    );
  } else {
    await page.waitForFunction(
      (hash) => window.location.hash.includes(hash),
      options.statusHashIncludes,
      { timeout: 10000 },
    );
  }

  // ステータス一覧画面に着地した時点で、差分から新規 jobId を 1 件に確定する
  let newJobId: number | undefined;
  if (options.trackJobType && beforeIds) {
    newJobId = await captureNewJobId(
      page,
      options.trackJobType,
      beforeIds,
      options.trackLabel ?? options.statusHashIncludes,
    );
  } else if (draftJobId !== undefined) {
    newJobId = draftJobId;
  }

  return { newJobId };
}
