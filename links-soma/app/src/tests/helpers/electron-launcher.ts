/**
 * Electron起動ヘルパー
 * 開発モードとビルドモードの両方をサポート
 */

import * as path from "path";
import {
  _electron as electron,
  type ElectronApplication,
} from "@playwright/test";
import { findLatestBuild, parseElectronApp } from "electron-playwright-helpers";

type LaunchMode = "development" | "production";

/**
 * Electronアプリを起動
 * @param mode - 起動モード（development: 開発モード, production: ビルド済みアプリ）
 */
export async function launchElectronApp(
  mode: LaunchMode = process.env.E2E_DEV_MODE === "true"
    ? "development"
    : "production",
): Promise<ElectronApplication> {
  if (mode === "development") {
    // 開発モード: Viteビルド後のエントリーポイントを直接起動
    const appPath = path.join(__dirname, "../../../");
    return electron.launch({
      args: [".vite/build/main.js"],
      cwd: appPath,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    });
  }

  // プロダクションモード: ビルド済みアプリを起動
  const latestBuild = findLatestBuild();
  const appInfo = parseElectronApp(latestBuild);
  // cwd="/" に設定: HonoのserveStaticが絶対パスの先頭"/"を除去してcwd相対パスにするため、
  // cwd="/"でないとasar内のファイルを解決できない（Finder起動時はcwd="/"で動作する）
  return electron.launch({
    executablePath: appInfo.executable,
    cwd: "/",
    timeout: 60000, // 起動タイムアウトを60秒に
  });
}
