import { _electron as electron, type ElectronApplication } from "playwright";
import * as path from "path";

const APP_ROOT = path.resolve(__dirname, "..", "..", "..");

/**
 * Electron アプリを起動し、ElectronApplication インスタンスを返す。
 *
 * ビルド済みの electron/dist/main.js を直接起動する方式。
 * 事前に `yarn build` が必要。
 */
export async function launchElectronApp(): Promise<ElectronApplication> {
  const electronApp = await electron.launch({
    args: [path.join(APP_ROOT, "electron", "dist", "main.js")],
    cwd: APP_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "development",
    },
  });

  return electronApp;
}

/**
 * Electron アプリを起動し、最初のウィンドウ（Page）を取得する。
 * React の #root マウントまで待機する。
 */
export async function launchAndGetPage() {
  const electronApp = await launchElectronApp();
  const page = await electronApp.firstWindow({ timeout: 60000 });
  await page.waitForLoadState("load");
  await page.waitForSelector("#root > *", { timeout: 60000 });
  return { electronApp, page };
}
