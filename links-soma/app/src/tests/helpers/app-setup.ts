/**
 * アプリ起動・初期化ヘルパー
 *
 * 全テストファイルで共通のbeforeAll処理を提供する。
 */

import * as path from "path";
import { test, type ElectronApplication, type Page } from "@playwright/test";
import { launchElectronApp } from "./electron-launcher";

/**
 * Playwright の testInfo.file から呼び出し元テストファイルを判別し、
 * 開発モードのウィンドウタイトル用の kind / name を決定する。
 * - `tests/scripts/` 配下 → kind="script", name=ファイル名（拡張子除く）
 * - `tests/e2e/` 配下     → kind="e2e",   name=ファイル名（.e2e 拡張子除く）
 */
const detectCallerTitleInfo = ():
  | { kind: "script" | "e2e"; name: string }
  | undefined => {
  const file = test.info().file.replace(/\\/g, "/");
  if (file.includes("/tests/scripts/")) {
    return {
      kind: "script",
      name: path.basename(file, path.extname(file)),
    };
  }
  if (file.includes("/tests/e2e/")) {
    return {
      kind: "e2e",
      name: path.basename(file).replace(/\.e2e\.(ts|js)$/, ""),
    };
  }
  return undefined;
};

/**
 * Electronアプリを起動し、初期画面が表示されるまで待機する
 * @returns { electronApp, page }
 */
export async function setupApp(): Promise<{
  electronApp: ElectronApplication;
  page: Page;
}> {
  const info = detectCallerTitleInfo();
  if (info) {
    process.env.SOMA_TITLE_KIND = info.kind;
    process.env.SOMA_TITLE_NAME = info.name;
  } else {
    delete process.env.SOMA_TITLE_KIND;
    delete process.env.SOMA_TITLE_NAME;
  }
  const electronApp = await launchElectronApp();
  const page = await electronApp.firstWindow({ timeout: 60000 });
  await page.waitForLoadState("load");
  await page.waitForSelector("#root > *", { timeout: 60000 });
  return { electronApp, page };
}
