/**
 * チュートリアルガイド動線E2E（DB接続基本）
 *
 * 未開始→起動→名寄せ作成へ遷移し、進行中ポップオーバーに
 * 4工程ステッパーと進捗が出ることを検証する。
 * 各工程の実行や完了までは検証しない（パイプライン実行は別フローE2Eが担う）。
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import { clickNext } from "../../helpers/wizard-operations";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });
test.setTimeout(60000);

/** ガイド進行状態を SQLite (tutorial_state) に直接書き込む（localStorage は廃止, ADR-0024）。 */
const setTutorialState = (
  p: Page,
  state: {
    phase: "idle" | "running" | "paused" | "done";
    stage: "normalization" | "model" | "evaluation" | "analysis" | null;
    modelMode?: "build" | "generic";
  },
): Promise<unknown> =>
  p.evaluate(
    (s) =>
      window.ipcRenderer.invoke("updateTutorialState", {
        phase: s.phase,
        stage: s.stage,
        modelMode: s.modelMode ?? "build",
        draftJobId: null,
        modelJobId: null,
        evaluationJobId: null,
        resumeState: null,
      }),
    state,
  );

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
  // 前回実行の残留状態を除去して「未開始」から始める。
  await setTutorialState(page, { phase: "idle", stage: null });
  await page.reload();
  await page.waitForLoadState("load");
  await page.waitForSelector("#root > *", { timeout: 60000 });
});

test.afterAll(async () => {
  await setTutorialState(page, { phase: "idle", stage: null });
  await electronApp.close();
});

test.describe("チュートリアルガイド (DB接続基本)", () => {
  test("未開始では右上に「ガイド」ボタンが出る", async () => {
    await expect(
      page.getByRole("button", { name: "ガイド", exact: true }),
    ).toBeVisible();
  });

  test("「ガイド」クリックで起動ダイアログが開く", async () => {
    await page.getByRole("button", { name: "ガイド", exact: true }).click();
    await expect(page.getByText("ガイドを始めますか？")).toBeVisible();
  });

  test("「始める」で名寄せ作成画面へ遷移する", async () => {
    // 起動ダイアログの既定モデルは generic（モデル構築を飛ばす3工程）。
    // 本 describe は4工程ステッパーを検証するため、build（モデルを構築する）を選ぶ。
    await page.getByRole("radio", { name: /モデルを構築する/ }).click();
    await page.getByRole("button", { name: "始める" }).click();
    await page.waitForFunction(
      () => window.location.hash.includes("normalization/create"),
      undefined,
      { timeout: 10000 },
    );
    expect(page.url()).toContain("normalization/create");
  });

  test("進行中ポップオーバーに4工程ステッパーと進捗(1/4)が出る", async () => {
    const toggle = page.getByRole("button", { name: /ガイド進行中 \(1\/4\)/ });
    await expect(toggle).toBeVisible();
    // 工程ラベルは名寄せ作成画面側にも存在するため、ポップオーバー内に限定して検証する。
    const popover = toggle.locator("..");
    await expect(popover.getByText("工程 1 / 4")).toBeVisible();
    for (const label of ["名寄せ処理", "モデル構築", "空き家推定", "分析"]) {
      await expect(popover.getByText(label, { exact: true })).toBeVisible();
    }
    // 現工程（名寄せ・intro）の「次にやること」。画面内容の確認を促す。build 選択時は
    // 既定の目的のまま開始させないよう、目的の切り替え（AIモデル構築用）も明示する。
    // 断片は normStepIntroBuild 固有の一節を使う。「AIモデル構築用の名寄せ処理」単体は
    // イントロ画面の目的選択ラジオ（approachCustomTitle）とも一致し、ポップオーバー限定
    // スコープが崩れると画面ラベルを誤検出しうるため、コーチング文にしか現れない節で照合する。
    await expect(
      popover.getByText(
        "「AIモデル構築用の名寄せ処理」を選び、用意するデータを確認して",
      ),
    ).toBeVisible();
  });

  test("ウィザードのステップに応じてコーチングが変わる", async () => {
    // MU1（#1908）: intro→基本設定→最初のデータ（水道閉開栓状況）へ進むと、
    // 進行カードのコーチングが intro の案内から dataset の案内（対象名＋「右側の説明」への
    // 言及）に切り替わる。resume_state.stepType/stepTitle の同期を実機で担保する。
    const popover = page
      .getByRole("button", { name: /ガイド進行中/ })
      .locator("..");
    // clickNext はステップ遷移（createDraftJob 等）の確定を待つバッファを挟む。
    await clickNext(page); // intro → 基本設定
    await clickNext(page); // 基本設定 → 水道閉開栓状況
    await expect(popover.getByText(/右側の説明も参考にできます/)).toBeVisible({
      timeout: 15000,
    });
  });

  test("開始後は右上が進行トグルに変わり「ガイド」入口ボタンは消える", async () => {
    // 入口は右上（ADR-0024）。running では idle 用「ガイド」ボタンが消え、
    // 進行トグル「ガイド進行中」に切り替わる。
    await expect(
      page.getByRole("button", { name: "ガイド", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /ガイド進行中/ }),
    ).toBeVisible();
  });

  test("空き家推定工程: 進行カードが「地域集計用データ」と「推定開始」を案内する", async () => {
    // MU3（#1908）: コーチングの案内語が実 UI と一致することを担保する。案内対象は
    // 「地域集計用データ」の選択と、送信ボタン「推定開始」（evaluation/create の submit）。
    // 番号（①②③）は使わない（#1924）。地域集計はジオメトリ源のあるデータでのみ表示される。
    await setTutorialState(page, { phase: "running", stage: "evaluation" });
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForSelector("#root > *", { timeout: 60000 });

    await page
      .getByRole("button", { name: /ガイド進行中/ })
      .click({ timeout: 15000 });
    const popover = page
      .getByRole("button", { name: /ガイド進行中/ })
      .locator("..");
    await expect(popover.getByText(/地域集計用データ/)).toBeVisible({
      timeout: 15000,
    });
    await expect(popover.getByText(/推定開始/)).toBeVisible();
  });

  test("分析工程: 進行ポップオーバーの「完了」で完了Dialogが出る", async () => {
    // 分析工程の進行中状態に上書きしてリロード（store は起動時に SQLite から hydrate）。
    await setTutorialState(page, { phase: "running", stage: "analysis" });
    await page.reload();
    await page.waitForLoadState("load");
    await page.waitForSelector("#root > *", { timeout: 60000 });

    // 任意の WB 表示では完了 Dialog は出ない（旧 useEffect 自動発火の廃止を担保）。
    // ポップオーバーは既定で折りたたみ（基本閉じる）。トグルで開いてから「完了」を押す。
    await page
      .getByRole("button", { name: /ガイド進行中/ })
      .click({ timeout: 15000 });

    // 分析コーチングの進捗連動（#1908 B）: resume_state.analysis なし（WB未入場）では
    // 未着手コーチング（ワークブック作成の案内）が出る。ビュー作成後の段階別文言は
    // coaching.ts のユニットテストが担保するため、ここは配線（文言が出ること）だけ確認する。
    const popover = page
      .getByRole("button", { name: /ガイド進行中/ })
      .locator("..");
    await expect(popover.getByText(/新規ワークブック作成/)).toBeVisible({
      timeout: 15000,
    });

    await page
      .getByRole("button", { name: "ガイドを完了する" })
      .click({ timeout: 15000 });

    await expect(page.getByText("お疲れさまでした")).toBeVisible({
      timeout: 15000,
    });
  });
});
