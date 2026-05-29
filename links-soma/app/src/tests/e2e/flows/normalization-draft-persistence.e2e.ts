/**
 * 名寄せ下書きの画面遷移時永続化 (#1796 regression)
 *
 * ウィザード入力直後にサイドバー離脱→復帰しても下書きが消えないことを確認する。
 * 旧実装は SWR の stale cache により、復帰時に「下書きなし」と表示される事象が
 * Windows 本番で 100% 再現していた。
 *
 * 対象外:
 * - form.subscribe → IPC の fire-and-forget race (subscribe callback が発火する前に
 *   unmount する timing 依存問題)。本テストは「入力後 navigate」の静的シナリオのみで、
 *   race 窓を広げる条件 (Windows prod IPC latency, react-hook-form 内部 batching 等)
 *   を再現しない。race 検証は別 PR で扱う。
 */

import {
  test,
  expect,
  type ElectronApplication,
  type Page,
} from "@playwright/test";
import { setupApp } from "../../helpers/app-setup";
import { navigateTo } from "../../helpers/navigation-helper";
import {
  startNormalizationWizard,
  clickNext,
} from "../../helpers/wizard-operations";

let electronApp: ElectronApplication;
let page: Page;

test.describe.configure({ mode: "serial" });
test.setTimeout(60000);

test.beforeAll(async () => {
  ({ electronApp, page } = await setupApp());
});

test.afterAll(async () => {
  await electronApp.close();
});

async function readDraftMunicipality(page: Page): Promise<string | null> {
  const job = await page.evaluate(async () => {
    const ipc = (
      window as unknown as {
        ipcRenderer: { invoke: (channel: string) => Promise<unknown> };
      }
    ).ipcRenderer;
    return await ipc.invoke("selectDraftJob");
  });
  if (!job) return null;
  const params = (job as { parameters: { settings?: { municipality?: string } } })
    .parameters;
  return params?.settings?.municipality ?? null;
}

async function cleanDraft(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const ipc = (
      window as unknown as {
        ipcRenderer: {
          invoke: (ch: string, args?: unknown) => Promise<unknown>;
        };
      }
    ).ipcRenderer;
    const existing = (await ipc.invoke("selectDraftJob")) as {
      id: number;
    } | null;
    if (existing) {
      await ipc.invoke("deleteJob", { id: existing.id });
    }
  });
}

test.describe("名寄せ下書きの永続化 (#1796)", () => {
  test.beforeEach(async () => {
    await cleanDraft(page);
  });

  test("入力直後にサイドバー離脱→復帰しても下書きが保持される", async () => {
    // サンプルデータ (千代田区) の有効日付範囲内 (README: 2023-04-01〜2025-04-01)
    const municipality = "千代田区";
    const referenceDate = "2024-01-01";

    // wizard 起動 → step1 (settings) へ
    await startNormalizationWizard(page);
    await clickNext(page);
    await page.locator('input[type="date"]').waitFor({ state: "visible" });

    // step1 入力
    await page.locator('input[type="date"]').fill(referenceDate);
    await page.getByPlaceholder("市区町村名を入力").fill(municipality);

    // 入力直後 (待機 0ms = race window 最大) でサイドバー離脱
    await navigateTo(page, "#job");

    // 復帰
    await navigateTo(page, "#normalization");

    // DB の draft に municipality が保持されていること (書込確認)
    expect(await readDraftMunicipality(page)).toBe(municipality);

    // UI 側の form 復元も確認する
    // (DB には値があるが UI 側の復元が壊れていれば同じ症状として知覚されるため)
    // 「続ける」は step=confirm に飛ぶので、step=1 へ hash 直書きで移動して form を検証
    const draftId = await page.evaluate(async () => {
      const job = (await (
        window as unknown as {
          ipcRenderer: { invoke: (channel: string) => Promise<unknown> };
        }
      ).ipcRenderer.invoke("selectDraftJob")) as { id: number } | null;
      return job?.id;
    });
    if (!draftId) throw new Error("draft id not found after navigation");

    await page.evaluate((id) => {
      window.location.hash = `#/normalization/create/${id}?step=1`;
    }, draftId);
    await page.locator('input[type="date"]').waitFor({ state: "visible" });
    await expect(page.getByPlaceholder("市区町村名を入力")).toHaveValue(
      municipality,
    );
    await expect(page.locator('input[type="date"]')).toHaveValue(referenceDate);
  });
});
