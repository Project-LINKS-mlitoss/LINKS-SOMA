import type { Page, ElectronApplication } from "playwright";

/**
 * モックで使用する固定座標値。
 * 東京都庁付近の座標。mock と assertion の両方でこの定数を参照する。
 */
export const MOCK_COORDINATES = {
  lat: 35.6896,
  lon: 139.6922,
} as const;

/**
 * テスト用フィクスチャ（test-data.csv）から導出される期待値。
 *
 * test-data.csv:
 *   行1: 東京都庁（正常系）
 *   行2: 大阪市役所（正常系）
 *   行3: 名古屋市役所（正常系）
 *   行4: 存在しない住所（異常系: モックが空結果を返す）
 *   行5: 空文字（境界値: モックが空結果を返す）
 *
 * モック条件: address が空 or "存在しない" を含む → 失敗
 */
export const EXPECTED_COUNTS = {
  total: 5,
  success: 3,
  fail: 2,
} as const;

/**
 * AWS Location Service API のモックをセットアップする。
 * page.route() で HTTP リクエストをインターセプトし、固定レスポンスを返す。
 */
export async function mockAwsApi(page: Page) {
  await page.route(
    "**/places.geo.ap-northeast-1.amazonaws.com/**",
    async (route) => {
      const request = route.request();
      const postData = request.postDataJSON();
      const address = postData?.Text || "";

      // 空文字や存在しない住所はエラーレスポンス
      if (!address || address.includes("存在しない")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ Results: [] }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          Results: [
            {
              Place: {
                Geometry: {
                  Point: [MOCK_COORDINATES.lon, MOCK_COORDINATES.lat], // AWS は [lon, lat] 順
                },
                Label: address,
              },
            },
          ],
        }),
      });
    }
  );
}

/**
 * NTT Geospace API のモックをセットアップする。
 * page.route() で HTTP リクエストをインターセプトし、固定レスポンスを返す。
 */
export async function mockNttApi(page: Page) {
  await page.route("**/api-geocode.geospace.jp/**", async (route) => {
    const url = new URL(route.request().url());
    const address = url.searchParams.get("string") || "";

    if (!address || address.includes("存在しない")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ geocoding: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        geocoding: [
          {
            lat: String(MOCK_COORDINATES.lat),
            lon: String(MOCK_COORDINATES.lon),
            addr: address,
          },
        ],
      }),
    });
  });
}

/**
 * ABR ジオコーディング（IPC経由）のモックをセットアップする。
 *
 * contextBridge.exposeInMainWorld は exposed オブジェクトを deep freeze するため、
 * page.evaluate() で window.electronAPI のプロパティを差し替えることはできない。
 * 代わりに electronApp.evaluate() で main process の ipcMain.handle を差し替える。
 */
export async function mockAbrApi(electronApp: ElectronApplication) {
  await electronApp.evaluate(({ ipcMain }) => {
    // 単件ジオコーディングのモック
    ipcMain.removeHandler("abr:geocode");
    ipcMain.handle("abr:geocode", async (_event, address: string) => {
      if (!address || address.includes("存在しない")) {
        return {
          success: false,
          lat: 0,
          lon: 0,
          label: "",
          errorMessage: "該当する住所が見つかりませんでした",
        };
      }
      return {
        success: true,
        lat: 35.6896,
        lon: 139.6922,
        label: address,
        score: 1.0,
        matchLevel: "住居表示",
        coordinateLevel: "街区",
        rsdtAddrFlg: 1,
      };
    });

    // バッチジオコーディングのモック
    ipcMain.removeHandler("abr:geocode-batch");
    ipcMain.handle("abr:geocode-batch", async (_event, addresses: string[]) => {
      return addresses.map((address: string) => {
        if (!address || address.includes("存在しない")) {
          return {
            success: false,
            lat: 0,
            lon: 0,
            label: "",
            errorMessage: "該当する住所が見つかりませんでした",
          };
        }
        return {
          success: true,
          lat: 35.6896,
          lon: 139.6922,
          label: address,
          score: 1.0,
          matchLevel: "住居表示",
          coordinateLevel: "街区",
          rsdtAddrFlg: 1,
        };
      });
    });

    // ABR データ存在確認のモック
    // データ未ダウンロード状態をデフォルトにする（ダウンロードフローをテスト可能にするため）
    ipcMain.removeHandler("abr:check-data");
    ipcMain.handle("abr:check-data", async () => ({ exists: false }));

    ipcMain.removeHandler("abr:check-data-for-code");
    ipcMain.handle("abr:check-data-for-code", async () => false);

    // ABR ダウンロード関連のモック
    ipcMain.removeHandler("abr:download-data-with-progress");
    ipcMain.handle("abr:download-data-with-progress", async () => ({
      success: true,
      message: "モックダウンロード完了",
    }));

    ipcMain.removeHandler("abr:delete-data");
    ipcMain.handle("abr:delete-data", async () => ({
      success: true,
      message: "データが削除されました",
    }));

    // 都道府県ファイル関連のモック
    // CSV 形式のテスト用都道府県データを返す
    // parsePrefectureFile が期待するフォーマット: lgCode(6桁),都道府県名,市区町村名
    const csvContent = [
      "131016,東京都,千代田区",
      "131024,東京都,中央区",
      "131032,東京都,港区",
      "271276,大阪府,大阪市北区",
    ].join("\n");
    const csvBuffer = Buffer.from(csvContent, "utf-8");

    ipcMain.removeHandler("prefecture-file:read-default");
    ipcMain.handle("prefecture-file:read-default", async () => ({
      success: true,
      buffer: csvBuffer,
      fileName: "test-prefectures.csv",
    }));
  });
}
