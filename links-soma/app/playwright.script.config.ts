/**
 * 操作スクリプト用Playwright設定
 *
 * scripts/ ディレクトリ内の .ts ファイルを実行するための設定
 * デフォルトのplaywright.config.tsを継承し、testDir・testMatchを変更
 */

import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testDir: "./src/tests/scripts",
  testMatch: /.*\.ts/,
});
