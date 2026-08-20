import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import * as path from "path";
import Papa from "papaparse";
import { launchAndGetPage } from "./helpers/electron-launcher";
import { mockAbrApi } from "./helpers/mock-api";

/**
 * abr-geocoder は住所を特定できない場合、エラーではなく lat / lon が null の
 * 結果を返す。この行を成功として扱うと、座標が NaN のまま CSV に出力される。
 */
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const TEST_CSV = path.join(FIXTURES_DIR, "abr-null-coordinates.csv");

test.describe("ABR: 座標が null の結果は失敗として扱う", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120000);
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
    await mockAbrApi(electronApp);
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("成功数・失敗数が座標の有無に一致する", async () => {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CSV);
    await expect(page.getByText("abr-null-coordinates.csv")).toBeVisible();

    const dropdown = page.locator("button[role='combobox']").first();
    await dropdown.click();
    await page.getByRole("option", { name: "住所" }).click();

    await page.getByLabel("ABRジオコーディング").click();

    await page.getByRole("tab", { name: "本番実行" }).click();
    await page.getByRole("button", { name: "実行", exact: true }).click();

    await expect(page.getByText("総数: 2")).toBeVisible({ timeout: 60000 });
    await expect(page.getByText("成功数: 1")).toBeVisible();
    await expect(page.getByText("失敗数: 1")).toBeVisible();
  });

  test("出力CSVに NaN が現れない", async () => {
    await page.evaluate(() => {
      const original = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (obj: Blob | MediaSource) => {
        (window as unknown as { __lastBlob?: Blob }).__lastBlob = obj as Blob;
        return original(obj);
      };
    });

    // ABR 選択時は ABR データのダウンロードボタンも存在する。
    // 実行完了後に有効なのは CSV ダウンロードボタンのみ。
    await page
      .getByRole("button", { name: "ダウンロード", disabled: false })
      .click();

    const raw = await page.evaluate(async () => {
      const blob = (window as unknown as { __lastBlob?: Blob }).__lastBlob;
      return blob ? await blob.text() : "";
    });

    const text = raw.replace(/^﻿/, "");
    expect(text).not.toContain("NaN");

    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });

    const nullCoordRow = parsed.data.find((r) => r["名称"] === "座標なし");
    expect(nullCoordRow).toBeDefined();
    expect(nullCoordRow!["緯度"]).toBe("");
    expect(nullCoordRow!["経度"]).toBe("");
    expect(nullCoordRow!["位置レベル"]).toBe("特定できず");
    expect(nullCoordRow!["判定値"]).toBe("");
    expect(nullCoordRow!["エラーメッセージ"]).not.toBe("");
  });
});
