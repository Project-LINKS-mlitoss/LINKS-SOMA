/* eslint-disable @typescript-eslint/no-explicit-any */
export type ApiType = 'aws' | 'zenrin';

export interface FormValues {
  apiType: ApiType; // 'aws' or 'zenrin'
  apiToken: string; // APIトークン（ユーザーが発行したもの）
  datasetPaths: string[]; // アップロードしたCSVファイルパス一覧
  spatialFile: string; // 地域集計用データファイルパス
  columns: Record<string, string>; // 各カラム選択状況: { "世帯番号カラム": "option1", ... }
  csvData: Record<string, string>[]; // CSV解析結果（オブジェクトの配列）
}

export interface GeocodingResult {
  lat: number;
  lon: number;
  label: string;
  success: boolean;
  errorMessage?: string;
}

export interface RunResultSummary {
  total: number;
  successCount: number;
  failCount: number;
  results: GeocodingResult[];
}

async function geocodeAddressWithAWS(
  address: string,
  apiKey: string
): Promise<GeocodingResult> {
  try {
    const endpoint = `https://places.geo.ap-northeast-1.amazonaws.com/places/v0/indexes/ProjectLINKS_Veda/search/text?key=${encodeURIComponent(
      apiKey
    )}`;

    const payload = { Text: address };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        lat: 0,
        lon: 0,
        label: '',
        success: false,
        errorMessage: `HTTP error ${response.status}`,
      };
    }

    const data = await response.json();
    if (!data.Results || data.Results.length === 0) {
      return {
        lat: 0,
        lon: 0,
        label: '',
        success: false,
        errorMessage: '該当する住所が見つかりませんでした',
      };
    }

    const place = data.Results[0].Place;
    if (!place || !place.Geometry || !place.Geometry.Point) {
      return {
        lat: 0,
        lon: 0,
        label: '',
        success: false,
        errorMessage: 'レスポンスから座標情報を抽出できませんでした',
      };
    }

    const [lon, lat] = place.Geometry.Point;
    const label = place.Label || address;

    return {
      lat,
      lon,
      label,
      success: true,
    };
  } catch (error: any) {
    return {
      lat: 0,
      lon: 0,
      label: '',
      success: false,
      errorMessage: error.message,
    };
  }
}

async function geocodeAddressWithZenrin(): Promise<GeocodingResult> {
  try {
    // ダミー実装
    const lat = Math.random() * 90;
    const lon = Math.random() * 180;
    return { lat, lon, label: 'ZenrinLabel', success: true };
  } catch (error: any) {
    return {
      lat: 0,
      lon: 0,
      label: '',
      success: false,
      errorMessage: error.message,
    };
  }
}

export function getGeocodingFunction(apiType: ApiType) {
  return apiType === 'aws' ? geocodeAddressWithAWS : geocodeAddressWithZenrin;
}

// testRunは単一住所のみでのテスト用
export async function testRun(formData: FormValues): Promise<GeocodingResult> {
  const { apiType, apiToken, csvData, columns } = formData;

  if (!apiToken || !csvData || csvData.length === 0) {
    throw new Error('APIトークンまたはCSVデータが未設定または空です');
  }

  // 選択された住所カラム名を取得
  const addressColumn = columns['住所に対応するカラムを選択'];
  if (!addressColumn) {
    throw new Error('住所カラムが選択されていません');
  }

  // CSVデータから該当カラムの値（住所）を抽出し、最初の1件を取得
  const firstAddress = csvData[0][addressColumn];
  if (!firstAddress) {
    throw new Error('最初の住所が見つかりません');
  }

  // 選択されたAPIタイプに応じたジオコーディング関数を取得
  const geocodeFunc = getGeocodingFunction(apiType);

  // ジオコーディングを実行
  const result = await geocodeFunc(firstAddress, apiToken);

  return result;
}

// 本番実行: 選択された住所カラムにある全住所をジオコーディング
export async function runExecution(
  formData: FormValues
): Promise<RunResultSummary> {
  const { apiType, apiToken, csvData, columns } = formData;
  if (!apiToken || !csvData || csvData.length === 0) {
    throw new Error('APIトークンまたはCSVデータが未設定または空です');
  }

  // 選択された住所カラム名を取得
  const addressColumn = columns['住所に対応するカラムを選択'];
  if (!addressColumn) {
    throw new Error('住所カラムが選択されていません');
  }

  // CSVデータから該当カラムの値（住所）を抽出
  const addresses: string[] = csvData.map(
    (row: Record<string, string>) => row[addressColumn]
  );

  // 選択されたAPIタイプに応じたジオコーディング関数を取得
  const geocodeFunc = getGeocodingFunction(apiType);

  const results: GeocodingResult[] = [];
  for (const address of addresses) {
    const result = await geocodeFunc(address, apiToken);
    results.push(result);
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  return { total: results.length, successCount, failCount, results };
}
