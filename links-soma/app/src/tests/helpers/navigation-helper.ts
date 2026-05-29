/**
 * 共通ナビゲーションヘルパー
 *
 * サイドバーメニュー遷移・ページ見出し確認の共通操作
 */

import { expect, type Page } from "@playwright/test";

/** サイドバーメニュー定義 */
export const MENU_ITEMS = [
  { href: "#analysis/workbook", label: "分析", heading: "分析" },
  { href: "#normalization", label: "名寄せ処理", heading: "名寄せ処理" },
  { href: "#model", label: "モデル構築", heading: "モデル構築" },
  { href: "#evaluation", label: "空き家推定", heading: "空き家推定" },
  { href: "#dataset", label: "データセット管理", heading: "データセット管理" },
  { href: "#job", label: "処理一覧", heading: "処理一覧" },
  {
    href: "#app-info",
    label: "アプリ情報",
    heading: "アプリケーション情報",
  },
] as const;

/**
 * サイドバーメニューをクリックして画面遷移を待機
 *
 * HashRouterがURLを `#path` → `#/path` に正規化するため、
 * waitForURL ではなく waitForFunction で hash を直接確認する
 */
export async function navigateTo(page: Page, menuHref: string): Promise<void> {
  await page.locator(`a[href="${menuHref}"]`).click();
  const hashPath = menuHref.replace(/^#\/?/, "");
  await page.waitForFunction(
    (path) => window.location.hash.includes(path),
    hashPath,
    { timeout: 10000 },
  );
  await page.waitForTimeout(500);
}

/**
 * ページ見出し（h2 または テキスト要素）の表示確認
 */
export async function expectPageHeading(
  page: Page,
  text: string,
): Promise<void> {
  // h2見出しを優先、なければテキスト要素で確認
  const h2 = page.locator("h2", { hasText: text });
  if ((await h2.count()) > 0) {
    await expect(h2.first()).toBeVisible();
    return;
  }
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}
