import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import * as path from "path";
import Papa from "papaparse";
import { launchAndGetPage } from "./helpers/electron-launcher";
import { mockAwsApi, MOCK_COORDINATES, EXPECTED_COUNTS } from "./helpers/mock-api";

/**
 * 出力CSVの列。入力CSV（fixtures/test-data.csv）の全列に続けて、
 * ジオコーダによらず同じ6列を固定で出力する。
 */
const EXPECTED_HEADERS = [
  "ID",
  "名称",
  "住所",
  "備考",
  "緯度",
  "経度",
  "ジオコーディング住所",
  "位置レベル",
  "判定値",
  "エラーメッセージ",
];

const FIXTURES_DIR = path.join(__dirname, "fixtures");
const TEST_CSV = path.join(FIXTURES_DIR, "test-data.csv");

test.describe("CSV ダウンロード", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120000);
  let electronApp: ElectronApplication;
  let page: Page;

  test.beforeAll(async () => {
    ({ electronApp, page } = await launchAndGetPage());
  });

  test.afterAll(async () => {
    await electronApp.close();
  });

  test("本番実行完了前: ダウンロードボタンが無効", async () => {
    await page.getByRole("tab", { name: "本番実行" }).click();

    const downloadButton = page.getByRole("button", { name: "ダウンロード" });
    await expect(downloadButton).toBeDisabled();
  });

  test("本番実行後: ダウンロードボタンが有効化される", async () => {
    await mockAwsApi(page);

    // CSV アップロード + カラム選択
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CSV);
    await expect(page.getByText("test-data.csv")).toBeVisible();

    const dropdown = page.locator("button[role='combobox']").first();
    await dropdown.click();
    await page.getByRole("option", { name: "住所" }).click();

    // AWS トークン入力
    await page.getByPlaceholder("APIキーを入力").fill("test-token");

    // 本番実行タブに切替して実行
    await page.getByRole("tab", { name: "本番実行" }).click();
    await page.getByRole("button", { name: "実行", exact: true }).click();

    // 完了を待つ — 値まで検証する
    await expect(page.getByText(`総数: ${EXPECTED_COUNTS.total}`)).toBeVisible({ timeout: 60000 });
    await expect(page.getByText(`成功数: ${EXPECTED_COUNTS.success}`)).toBeVisible();

    // ダウンロードボタンが有効化
    const downloadButton = page.getByRole("button", { name: "ダウンロード" });
    await expect(downloadButton).toBeEnabled();
  });

  test("位置レベルの内訳が画面に表示される", async () => {
    await expect(page.getByText("位置レベルの内訳:")).toBeVisible();

    // 成功3件は AWS モックが PointAddress を返すため「号・地番」
    await expect(
      page.getByText(`号・地番: ${EXPECTED_COUNTS.success}件`)
    ).toBeVisible();
    // 失敗2件は座標が無いため「特定できず」
    await expect(
      page.getByText(`特定できず: ${EXPECTED_COUNTS.fail}件`)
    ).toBeVisible();
  });

  test("結果に座標が含まれる", async () => {
    // 前提確認: 本番実行タブに結果が表示されている
    await expect(page.getByText(`総数: ${EXPECTED_COUNTS.total}`)).toBeVisible();

    // 座標値が結果に含まれている（複数行にマッチするので first()）
    await expect(page.getByText(String(MOCK_COORDINATES.lat)).first()).toBeVisible();
    await expect(page.getByText(String(MOCK_COORDINATES.lon)).first()).toBeVisible();
  });

  test("出力CSVの列構成と位置レベルが仕様どおり", async () => {
    // Electron のダウンロードは main プロセスが処理するため Playwright の
    // download イベントに現れない。createObjectURL に渡る Blob を捕捉する。
    await page.evaluate(() => {
      const original = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (obj: Blob | MediaSource) => {
        (window as unknown as { __lastBlob?: Blob }).__lastBlob = obj as Blob;
        return original(obj);
      };
    });

    await page.getByRole("button", { name: "ダウンロード" }).click();

    const raw = await page.evaluate(async () => {
      const blob = (window as unknown as { __lastBlob?: Blob }).__lastBlob;
      return blob ? await blob.text() : "";
    });

    const text = raw.replace(/^﻿/, "");
    expect(text).not.toBe("");
    const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });

    expect(parsed.meta.fields).toEqual(EXPECTED_HEADERS);
    expect(parsed.data).toHaveLength(EXPECTED_COUNTS.total);

    // 全行が同じ列を持つ。値の有無で列が増減しない
    for (const row of parsed.data) {
      expect(Object.keys(row)).toEqual(EXPECTED_HEADERS);
    }

    const succeeded = parsed.data.filter((r) => r["緯度"] !== "");
    const failed = parsed.data.filter((r) => r["緯度"] === "");
    expect(succeeded).toHaveLength(EXPECTED_COUNTS.success);
    expect(failed).toHaveLength(EXPECTED_COUNTS.fail);

    for (const row of succeeded) {
      expect(row["緯度"]).toBe(String(MOCK_COORDINATES.lat));
      expect(row["経度"]).toBe(String(MOCK_COORDINATES.lon));
      expect(row["ジオコーディング住所"]).toBe(row["住所"]);
      expect(row["位置レベル"]).toBe("号・地番");
      expect(row["判定値"]).toBe("AWS:PointAddress");
      expect(row["エラーメッセージ"]).toBe("");
    }

    // 失敗行は座標を空欄にする。0 を書くと地図表示と集計が破綻する
    for (const row of failed) {
      expect(row["経度"]).toBe("");
      expect(row["ジオコーディング住所"]).toBe("");
      expect(row["位置レベル"]).toBe("特定できず");
      expect(row["判定値"]).toBe("");
      expect(row["エラーメッセージ"]).not.toBe("");
    }
  });
});
