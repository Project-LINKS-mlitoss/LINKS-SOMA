/**
 * ジョブ操作ヘルパー
 *
 * ジョブ完了のポーリング待機、名前をつけて保存、結合率検証の操作を提供する。
 */

import { expect, type Page } from "@playwright/test";

export type JobType = "preprocess" | "ml" | "result" | "export" | "join_check";

/**
 * jobId ベースの完了待機の終了ステータス
 *
 * - complete: 正常完了（`jobs.status === "complete"`）
 * - error: エラー終了（`jobs.status === "error"`）
 * - stalled: 進捗シグネチャが stallTimeout 内で一度も変化しなかった（画面 or バックエンドのハング）
 * - drifted: URL hash が対象 jobId の詳細画面から外れた（画面遷移事故）
 * - timeout: maxWait の最終防護壁に到達（通常運用で踏むべきではない）
 */
export type JobWaitStatus =
  | "complete"
  | "error"
  | "stalled"
  | "drifted"
  | "timeout";

/**
 * 現時点のジョブID集合をスナップショットとして取得する
 *
 * `startPipelineAndNavigateToStatus` の Start ボタン押下**直前**に呼び、
 * 押下後の `captureNewJobId` と合わせて新規 jobId を差分で特定するために使う。
 */
export async function snapshotJobIds(
  page: Page,
  type: JobType,
): Promise<Set<number>> {
  const ids = await page.evaluate(async (t: JobType) => {
    const jobs = (await window.ipcRenderer.invoke("selectJobs", {
      type: t,
    })) as Array<{ id: number }>;
    return jobs.map((j) => j.id);
  }, type);
  return new Set(ids);
}

/**
 * 名寄せウィザード等の `create/{jobId}` 型 URL から draft jobId を抽出する
 *
 * # なぜ必要か
 *
 * 名寄せウィザードは intro→設定ステップの最初の「次へ」で `createDraftJob` IPC を
 * 呼んで draft 状態の preprocess ジョブを事前 insert し、URL を
 * `/normalization/create/{draftId}?step=...` に書き換える。その後「開始する」ボタンは
 * `execE001` を **jobId 付き update パス**で呼ぶため、Start 前後で snapshot 差分を取っても
 * 新規 insert が発生せず 0 件になる（= `captureNewJobId` が失敗する）。
 *
 * この draft 機構を使う画面では、Start 押下**前**に URL から draft jobId を抽出するのが
 * 最も確実。ml/result 画面は draft 機構を持たないので従来通り snapshot 差分を使う。
 *
 * @param pathSegment - URL hash 内のセグメント名（例: "normalization"）。
 *                      URL が `#/{pathSegment}/create/{id}` の形を想定
 */
export async function getDraftJobIdFromUrl(
  page: Page,
  pathSegment: string,
): Promise<number> {
  const hash = await page.evaluate(() => window.location.hash);
  const regex = new RegExp(`/${pathSegment}/create/(\\d+)`);
  const match = hash.match(regex);
  if (match === null) {
    throw new Error(
      `[${pathSegment}] URL hash から draft jobId を抽出できません（hash=${hash}, 期待形式=/${pathSegment}/create/{id}）`,
    );
  }
  return parseInt(match[1], 10);
}

/**
 * Start ボタン押下後、snapshot との差分で新規 jobId を 1 件に確定する
 *
 * # なぜ snapshot 差分か
 *
 * 単純な「最新 1 件」では、Start が UI バグで何もしなかったときに前回の complete ジョブを
 * 拾って偽陽性になる。差分なら 0 件/複数件を即座に検知して失敗させられる。
 */
export async function captureNewJobId(
  page: Page,
  type: JobType,
  beforeIds: Set<number>,
  label = "ジョブ",
): Promise<number> {
  const after = await page.evaluate(async (t: JobType) => {
    const jobs = (await window.ipcRenderer.invoke("selectJobs", {
      type: t,
    })) as Array<{ id: number }>;
    return jobs.map((j) => j.id);
  }, type);
  const newIds = after.filter((id: number) => !beforeIds.has(id));
  expect(
    newIds.length,
    `[${label}] Start 直後の新規 ${type} ジョブは 1 件のはず（実際: ${newIds.length} 件, newIds=${JSON.stringify(newIds)}, before=${beforeIds.size} 件）。0 件なら Start ボタンが DB に insert できていない、複数件なら並列実行の疑い`,
  ).toBe(1);
  return newIds[0];
}

/**
 * jobId で同定してジョブ完了を待機する（推奨: 新規テストはこちらを使う）
 *
 * # 何をするか
 *
 * 1. ステータス一覧画面の指定行（先頭行 or tableIndex 指定）をクリックして詳細画面へ遷移
 * 2. URL hash に `job/detail/{jobId}/{type}` が含まれることを検証（= 先頭行が本当に期待ジョブか）
 * 3. interval 毎に IPC で `selectJobs({jobId}) + selectJobTasks(jobId)` を直読みし、
 *    `status + job_tasks の id:progress_percent 連結` を **進捗シグネチャ** として比較
 * 4. シグネチャが `stallTimeout` 以上変化しなければ即座に打ち切り（画面ハング/BE ハング検知）
 * 5. URL hash が対象 jobId の詳細画面から外れたら即座に打ち切り（ナビゲーションドリフト検知）
 *
 * # なぜ `waitForJobCompletion` ではなくこちらを使うか
 *
 * 旧 `waitForJobCompletion` は「いま画面に居る場所の table[tableIndex] tbody[0] の UI テキスト」という
 * **位置ベース同定** でジョブを特定していたため、前回テストの残存状態で別画面に居てしまうと
 * テーブル自体が存在せず、ログも出さずに maxWait まで静かに回り続けるハングが発生した
 * （2026-04-10 `normalization-estimation-full` 47分ハング事例）。
 *
 * こちらは **jobId という明示 ID** で同定し、IPC で DB を直読みするので、
 * 画面の居場所や UI テキスト・ロケール変更に依存しない。
 *
 * # 進捗シグネチャの設計理由
 *
 * `jobs.status` は Python 実行中ずっと空文字 `""` のままで、最終状態でしか更新されない
 * （`_start-job-process.ts:33` で `status: ""` insert、Python 終了時に `complete`/`error` へ遷移）。
 * よって status 単体では stall 検知にならない。実質の活動は `job_tasks` 行の増加と
 * `progress_percent` の更新に集約されるので、両方を文字列化して差分比較する。
 */
export async function waitForJobCompletionById(
  page: Page,
  options: {
    /** 待機対象のジョブ ID（`captureNewJobId` で取得したもの） */
    jobId: number;
    /** ジョブの type。URL hash の `job/detail/{id}/{type}` 検証に使う */
    type: JobType;
    /** 一覧画面上で該当ジョブ行を含むテーブルのインデックス（モデル構築画面は 1） */
    tableIndex?: number;
    /** 進捗ログに表示するラベル */
    label?: string;
    /** 最大待機時間（ms）。最終防護壁。デフォルト 1 時間 */
    maxWait?: number;
    /** ポーリング間隔（ms）。デフォルト 15 秒 */
    interval?: number;
    /** 進捗シグネチャ不変タイムアウト（ms）。デフォルト 10 分 */
    stallTimeout?: number;
  },
): Promise<JobWaitStatus> {
  const { jobId, type } = options;
  const tableIndex = options.tableIndex ?? 0;
  const label = options.label ?? "処理";
  const maxWait = options.maxWait ?? 3600000;
  const interval = options.interval ?? 15000;
  const stallTimeout = options.stallTimeout ?? 10 * 60 * 1000;

  // === 0. 遷移元のハッシュを記録（完了後にこのページへ戻すため） ===
  // 後続テスト（generateJobName / saveJobResult など）が一覧画面前提で書かれているので、
  // 完了時は元のページへ必ず戻す。
  const prevHash = await page.evaluate(() => window.location.hash);

  // === 1. URL hash 直書きで詳細画面へ遷移 ===
  // 旧実装は `table[tableIndex] tbody tr` の先頭行クリック方式だったが、
  // 画面遷移直後はテーブル描画が間に合わず、前回テスト残存の古い jobId の行を
  // 開く事故が起きる（2026-04-13 estimation-full ml test 3 で SWR 経由で観測。
  // #1796 で `useFetchJobsWithPagination` は pub/sub 化済だが、mount 時 fetch の
  // タイミング差で同種事故は再発しうる）。
  //
  // hash 直書きならテーブルレンダリング・行並び順すべてに依存しない。
  // preprocess の URL hash 読み (`getDraftJobIdFromUrl`) が実機で動作している事実が
  // HashRouter の `location.hash` 操作互換性の実証になっている。
  // tableIndex 引数は後方互換のため受け取るが現実装では未使用。
  void tableIndex;
  await page.evaluate(
    ([id, t]) => {
      window.location.hash = `#/job/detail/${id}/${t}`;
    },
    [jobId, type] as const,
  );

  // hash が反映されるまで待つ（評価関数が同期で書き換えるが念のため）
  try {
    await page.waitForFunction(
      ([id, t]) => window.location.hash.includes(`job/detail/${id}/${t}`),
      [jobId, type] as const,
      { timeout: 15000 },
    );
  } catch {
    const currentHash = await page
      .evaluate(() => window.location.hash)
      .catch(() => "(evaluate failed)");
    throw new Error(
      `[${label}] hash 直書き後に job/detail/${jobId}/${type} へ反映されませんでした。current hash=${currentHash}`,
    );
  }

  // eslint-disable-next-line no-console -- E2Eテストの進捗表示
  console.log(
    `🔎 [${label}] 詳細画面へ遷移: job/detail/${jobId}/${type}`,
  );

  // === 2. ポーリングループ ===
  const startTime = Date.now();
  let lastSig: string | null = null;
  let lastChangeAt = Date.now();

  while (Date.now() - startTime < maxWait) {
    await page.waitForTimeout(interval);

    // 2a. ナビゲーションドリフト検知
    const currentHash = await page.evaluate(() => window.location.hash);
    if (!currentHash.includes(`job/detail/${jobId}/${type}`)) {
      // eslint-disable-next-line no-console -- E2Eテストの診断ダンプ
      console.log(
        `❌ [${label}] ナビゲーションドリフト: hash=${currentHash}, 期待=job/detail/${jobId}/${type}`,
      );
      return "drifted";
    }

    // 2b. ジョブ状態を IPC で直読み
    const snapshot = await page.evaluate(async (id: number) => {
      const [jobsResult, tasksResult] = await Promise.all([
        window.ipcRenderer.invoke("selectJobs", { jobId: id }),
        window.ipcRenderer.invoke("selectJobTasks", id),
      ]);
      const job = (jobsResult as Array<{ status: string | null }>)[0];
      const tasks = tasksResult as Array<{
        id: number;
        progress_percent: string | null;
      }>;
      return {
        status: job?.status ?? "",
        taskCount: tasks.length,
        taskSig: tasks
          .map((t) => `${t.id}:${t.progress_percent ?? ""}`)
          .join(","),
      };
    }, jobId);

    const elapsed = Math.round((Date.now() - startTime) / 60000);

    // 2c. 完了・エラー判定（DB の status 列を素直に読む）
    if (snapshot.status === "complete") {
      // eslint-disable-next-line no-console -- E2Eテストの進捗表示
      console.log(
        `✅ [${label}] 完了 (${elapsed}分, tasks=${snapshot.taskCount})`,
      );
      // 遷移元のハッシュへ戻す（後続テストが一覧画面前提の操作をするため）
      await page.goBack();
      await page
        .waitForFunction((h) => window.location.hash === h, prevHash, {
          timeout: 10000,
        })
        .catch(() => {
          // 戻れなかった場合は警告だけ出して処理続行（呼び出し側で明示的に遷移している可能性）
          // eslint-disable-next-line no-console -- E2Eテストの診断ダンプ
          console.log(
            `⚠️  [${label}] page.goBack 後に prevHash=${prevHash} へ戻りませんでした`,
          );
        });
      return "complete";
    }
    if (snapshot.status === "error") {
      // eslint-disable-next-line no-console -- E2Eテストの進捗表示
      console.log(
        `❌ [${label}] エラー (${elapsed}分, tasks=${snapshot.taskCount})`,
      );
      return "error";
    }

    // 2d. 進捗シグネチャで stall 検知
    const sig = `${snapshot.status}|${snapshot.taskSig}`;
    if (sig !== lastSig) {
      lastSig = sig;
      lastChangeAt = Date.now();
      // eslint-disable-next-line no-console -- E2Eテストの進捗表示
      console.log(
        `⏳ [${label}] status=${snapshot.status || "(pending)"}, tasks=${snapshot.taskCount} (${elapsed}分)`,
      );
    } else if (Date.now() - lastChangeAt > stallTimeout) {
      const stallMin = Math.round(stallTimeout / 60000);
      // eslint-disable-next-line no-console -- E2Eテストの診断ダンプ
      console.log(
        `❌ [${label}] 進捗不変タイムアウト (${stallMin}分変化なし, status=${snapshot.status || "(pending)"}, tasks=${snapshot.taskCount}, hash=${currentHash}, sig=${sig})`,
      );
      return "stalled";
    }
  }

  const maxMin = Math.round(maxWait / 60000);
  // eslint-disable-next-line no-console -- E2Eテストの診断ダンプ
  console.log(`❌ [${label}] maxWait 超過 (${maxMin}分)`);
  return "timeout";
}

/**
 * ジョブ完了をポーリングで待機する（旧実装、位置ベース同定）
 *
 * @deprecated 新規テストは `waitForJobCompletionById` を使う。こちらは
 * 画面上の table[tableIndex] tbody[0] の UI テキストで同定するため、
 * 前回テストの残存状態で別画面にいるケースで無言ハングするリスクがある。
 *
 * @returns "complete" | "error" | "timeout"
 */
export async function waitForJobCompletion(
  page: Page,
  options: {
    /** 最大待機時間（ms）。デフォルト: 3600000（1時間） */
    maxWait?: number;
    /** ポーリング間隔（ms）。デフォルト: 15000（15秒） */
    interval?: number;
    /** 進捗ログに表示するラベル */
    label?: string;
    /** ジョブ一覧テーブルのインデックス（0始まり）。モデル構築画面など複数テーブルがある場合に指定 */
    tableIndex?: number;
  } = {},
): Promise<string> {
  const maxWait = options.maxWait ?? 3600000;
  const interval = options.interval ?? 15000;
  const label = options.label ?? "処理";
  const tableIndex = options.tableIndex ?? 0;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWait) {
    await page.waitForTimeout(interval);
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForTimeout(2000);

    const firstRow = page
      .locator("table")
      .nth(tableIndex)
      .locator("tbody tr")
      .first();
    const statusText = (await firstRow.textContent().catch(() => "")) ?? "";

    if (statusText.includes("完了")) {
      return "complete";
    }

    if (statusText.includes("エラー")) {
      return "error";
    }

    const progressMatch = statusText.match(/進行中\s*(\d+)%/);
    const elapsed = Math.round((Date.now() - startTime) / 60000);
    if (progressMatch) {
      // eslint-disable-next-line no-console -- E2Eテストの進捗表示
      console.log(`⏳ [${label}] ${progressMatch[0]} (${elapsed}分経過)`);
    }
  }

  return "timeout";
}

/**
 * ジョブ詳細画面で「名前をつけて保存」を実行する
 *
 * 前提: ジョブ一覧画面にいること（完了したジョブの行が表示されている状態）
 *
 * @param title - 保存名。省略時はデフォルト名のまま保存
 * @param tableIndex - ジョブ一覧テーブルのインデックス（0始まり）。モデル構築画面など複数テーブルがある場合に指定
 */
export async function saveJobResult(
  page: Page,
  options: {
    /** 保存名。省略時はデフォルト名のまま保存 */
    title?: string;
    /** テーブルインデックス（0始まり）。デフォルト: 0 */
    tableIndex?: number;
    /** 保存後の「として保存済み」確認をスキップする。モデル構築画面のようにリロードが必要な場合にtrue */
    skipVerification?: boolean;
  } = {},
): Promise<void> {
  const tableIndex = options.tableIndex ?? 0;

  // ジョブ詳細画面に遷移
  const completedRow = page
    .locator("table")
    .nth(tableIndex)
    .locator("tbody tr")
    .first();
  await completedRow.click();
  await page.waitForFunction(
    () => window.location.hash.includes("job/detail"),
    { timeout: 10000 },
  );
  await page.waitForTimeout(2000);

  // 「名前をつけて保存」ボタンをクリック
  const saveButton = page.getByRole("button", { name: "名前をつけて保存" });
  await expect(saveButton).toBeVisible({ timeout: 10000 });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // ダイアログが表示されるのを待機
  await page.waitForSelector('[role="dialog"]');

  // タイトルが指定されていればデフォルト名をクリアして入力
  if (options.title) {
    const nameInput = page.locator('[role="dialog"] input[name="title"]');
    await nameInput.fill(options.title);
  }

  // 「保存」をクリック
  await page
    .locator('[role="dialog"]')
    .getByRole("button", { name: "保存" })
    .click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden" });
  await page.waitForTimeout(1000);

  // 保存後の確認（モデル構築画面ではリロードが先に必要なためスキップ可能）
  if (!options.skipVerification) {
    await expect(page.getByText("として保存済み")).toBeVisible({
      timeout: 5000,
    });
  }
}

/**
 * 最新のジョブIDをIPC経由で取得する
 *
 * 直近に作成されたジョブを取得する。type 指定で「最新の名寄せ」「最新のモデル構築」等を絞り込める。
 *
 * @param type - "preprocess"=名寄せ, "ml"=モデル構築, "result"=空き家推定
 */
export async function getLatestJobId(
  page: Page,
  type: JobType,
): Promise<number> {
  const jobs = await page.evaluate(
    async (jobType: JobType) =>
      window.ipcRenderer.invoke("selectJobs", { type: jobType }),
    type,
  );
  expect(
    Array.isArray(jobs) && jobs.length > 0,
    `${type} ジョブが1件以上存在すること`,
  ).toBe(true);
  return jobs[0].id as number;
}

/**
 * 名寄せ処理（IF001）の各結合ステップが想定通り joining_rate > 0 を返すかを検証する
 *
 * # 何を検証するか
 *
 * IF001 は住基(juki)・登記(touki)・ジオコーディング(geocoding) の各結合ステップで
 * `job_tasks.result.joining_rate` を JSON で記録する（preprocess_type="e014"）。
 * このヘルパーは:
 * 1. ウィザードで実施したはずの結合ステップ数 ＝ DB に記録された e014 タスク数 か
 * 2. 各 e014 タスクの joining_rate が **0%より大きい** か（= 正常系データなのに名寄せ失敗していないか）
 * を IPC 経由で確認する。
 *
 * # なぜ必要か
 *
 * 既存 E2E は `status === "complete"` のみアサートしていたため、
 * 「正常終了したが結合率0%」（#1715 のような municipality 未送信バグ）を見逃していた。
 * UI から実データを送信した時にだけ顕在化するパラメータ送信経路のバグを Mac 開発時点で検知する。
 *
 * # 前提
 * - 名寄せジョブ完了直後に呼ぶこと（呼び出し時点で「最新の preprocess ジョブ」が対象）
 *
 * @param expectedJoinSteps - ウィザードで指定したはずの結合データソース数（juki/touki/geocoding の合計）。
 *                             デフォルト: 1（住基のみ）
 */
export async function verifyNormalizationJoiningRates(
  page: Page,
  options: {
    expectedJoinSteps?: number;
    label?: string;
  } = {},
): Promise<{ joining_rate: number; input_source?: string; success_rate?: string }[]> {
  const expected = options.expectedJoinSteps ?? 1;
  const label = options.label ?? "名寄せ";

  const jobId = await getLatestJobId(page, "preprocess");

  const tasks: Array<{
    preprocess_type: string | null;
    result: unknown;
    error_code: string | null;
    error_msg: string | null;
  }> = await page.evaluate(
    async (id: number) => window.ipcRenderer.invoke("selectJobTasks", id),
    jobId,
  );

  const e014Tasks = tasks.filter((t) => t.preprocess_type === "e014");

  // eslint-disable-next-line no-console -- E2Eテストの進捗表示
  console.log(
    `📊 [${label}] preprocess job_id=${jobId}, e014 タスク=${e014Tasks.length}件 (期待:${expected}件)`,
  );

  expect(
    e014Tasks.length,
    `e014（結合）タスクが ${expected} 件記録されていること（実際: ${e014Tasks.length}件）。ウィザードで指定したデータソースのいずれかが結合ステップに到達していない可能性`,
  ).toBe(expected);

  const parsed = e014Tasks.map((t) => {
    const r = typeof t.result === "string" ? JSON.parse(t.result) : t.result;
    return r as {
      joining_rate: number;
      input_source?: string;
      success_rate?: string;
    };
  });

  for (const r of parsed) {
    // eslint-disable-next-line no-console -- E2Eテストの進捗表示
    console.log(
      `  ▸ joining_rate=${r.joining_rate}% [${r.input_source ?? "?"}] ${r.success_rate ?? ""}`,
    );
    expect(
      r.joining_rate,
      `joining_rate > 0%（input_source: ${r.input_source ?? "?"}）— 正常系データで結合に失敗している可能性`,
    ).toBeGreaterThan(0);
  }

  return parsed;
}

/**
 * 推定結果（IF003）の building 件数が期待件数以上であることを検証する
 *
 * # 何を検証するか
 *
 * 最新の DataSetResult を取得し、building テーブルのレコード数が期待値以上か確認する。
 * #1719 のように IF003 が complete 表示なのに 0 件しか出ていない、というケースを検知する。
 *
 * @param minCount - 最小期待件数。デフォルト: 1
 */
export async function verifyEstimationResultCount(
  page: Page,
  options: { minCount?: number; label?: string } = {},
): Promise<{ resultId: number; buildingCount: number }> {
  const minCount = options.minCount ?? 1;
  const label = options.label ?? "推定結果";

  const results: Array<{ id: number; title: string | null }> =
    await page.evaluate(async () =>
      window.ipcRenderer.invoke("selectDataSetResults"),
    );
  expect(
    Array.isArray(results) && results.length > 0,
    "推定結果が1件以上存在すること",
  ).toBe(true);

  const latest = results[0];

  const countResult = await page.evaluate(
    async (resultId: number) =>
      window.ipcRenderer.invoke("selectDataSetCount", {
        dataSetResultId: resultId,
        unit: "building",
      }),
    latest.id,
  );
  const buildingCount =
    typeof countResult === "number"
      ? countResult
      : (countResult?.count ?? 0);

  // eslint-disable-next-line no-console -- E2Eテストの進捗表示
  console.log(
    `📊 [${label}] result_id=${latest.id}, building=${buildingCount}件 (期待: ≥${minCount})`,
  );

  expect(
    buildingCount,
    `building 件数 ≥ ${minCount} 件（実際: ${buildingCount}件）— 推定が complete 表示でも0件出力していないか`,
  ).toBeGreaterThanOrEqual(minCount);

  return { resultId: latest.id, buildingCount };
}

/**
 * 完了したジョブの作成日時から識別名を生成する
 *
 * 前提: ジョブ一覧画面にいること
 *
 * @param tableIndex - テーブルインデックス（0始まり）。デフォルト: 0
 * @returns "E2Eテスト_{prefix}_{YYYYMMDDHHMM}" 形式の文字列
 */
export async function generateJobName(
  page: Page,
  prefix: string,
  tableIndex = 0,
): Promise<string> {
  const completedRow = page
    .locator("table")
    .nth(tableIndex)
    .locator("tbody tr")
    .first();
  const createdAtCell = completedRow.locator("td").first();
  const createdAtText = (await createdAtCell.textContent()) ?? "";
  // "2026/03/17 15:30:00" → "202603171530"
  const dateForName = createdAtText.replace(/[/: ]/g, "").slice(0, 12);
  return `E2Eテスト_${prefix}_${dateForName}`;
}
