/* eslint-disable @typescript-eslint/no-explicit-any */

const DEFAULT_BASE_URL = 'https://api-geocode.geospace.jp/api/v1/geocoding/';

export type ApiType = 'aws' | 'zenrin' | 'ntt' | 'abr';

export interface FormValues {
  apiType: ApiType; // 'aws', 'zenrin', 'ntt', or 'abr'
  apiToken: string; // APIトークン（AWS用）またはAPIのappid（NTT用）
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
  // ABR specific fields
  score?: number;
  matchLevel?: string;
  coordinateLevel?: string;
  rsdtAddrFlg?: number;
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

/**
 * Helper function to sleep/delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with retries and exponential backoff
 */
async function fetchWithRetries(
  url: string,
  maxRetries: number = 3,
  backoffBase: number = 1.5,
  timeout: number = 30000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Return response even if not ok - let caller handle HTTP errors
      // Retry only on exceptions (network errors, timeouts), not on HTTP errors
      return response;
    } catch (error: any) {
      lastError = error;

      // If not last attempt, retry with exponential backoff
      if (attempt < maxRetries) {
        const sleepMs = backoffBase * Math.pow(2, attempt - 1) * 1000;
        console.warn(
          `GET failed (attempt ${attempt}/${maxRetries}): ${error.message} -> retry in ${sleepMs / 1000}s`
        );
        await sleep(sleepMs);
        continue;
      }

      // Last attempt, throw error
      throw error;
    }
  }

  // Should not reach here, but TypeScript requires it
  if (lastError) {
    throw lastError;
  }
  throw new Error('Unknown error in fetchWithRetries');
}

async function geocodeAddressWithNTT(
  address: string,
  appid: string
): Promise<GeocodingResult> {
  try {
    const url = new URL(DEFAULT_BASE_URL);
    url.searchParams.append('appid', appid);
    url.searchParams.append('string', address);

    // Retry logic: max 3 retries, exponential backoff with base 1.5
    // Attempt 1: immediate
    // Attempt 2: wait 1.5s (1.5 * 2^0)
    // Attempt 3: wait 3.0s (1.5 * 2^1)
    // Attempt 4: wait 6.0s (1.5 * 2^2)
    const response = await fetchWithRetries(url.toString(), 3, 1.5, 30000);

    // Check HTTP status - retry only handles network errors, not HTTP errors
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
    console.log(data);


    // Check if geocoding array exists and has at least one result
    if (!data.geocoding || !Array.isArray(data.geocoding) || data.geocoding.length === 0) {
      return {
        lat: 0,
        lon: 0,
        label: '',
        success: false,
        errorMessage: '該当する住所が見つかりませんでした',
      };
    }

    // Get geocoding
    const geocoding = data.geocoding[0];
    if (!geocoding || geocoding.lat === undefined || geocoding.lon === undefined) {
      return {
        lat: 0,
        lon: 0,
        label: '',
        success: false,
        errorMessage: 'レスポンスから座標情報を抽出できませんでした',
      };
    }

    // Extract data from geocoding
    const lat = parseFloat(geocoding.lat);
    const lon = parseFloat(geocoding.lon);
    const label = geocoding.addr || address;

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

async function geocodeAddressWithABR(
  address: string,
  _unused: string // Keep for type consistency with other geocoding functions
): Promise<GeocodingResult> {
  try {
    
    // Check if we're in Electron context
    if (typeof window !== 'undefined' && window.electronAPI) {
      
      const result = await window.electronAPI.abr.geocode(address);

      if (result.success && result.lat !== undefined && result.lon !== undefined) {
        return {
          lat: result.lat,
          lon: result.lon,
          label: result.label || address,
          success: true,
          score: result.score,
          matchLevel: result.matchLevel,
          coordinateLevel: result.coordinateLevel,
          rsdtAddrFlg: result.rsdtAddrFlg,
        };
      } else {
        return {
          lat: 0,
          lon: 0,
          label: '',
          success: false,
          errorMessage: result.errorMessage || '該当する住所が見つかりませんでした',
        };
      }
    } else {
      // Not in Electron context
      return {
        lat: 0,
        lon: 0,
        label: '',
        success: false,
        errorMessage: 'ABR geocoding requires Electron environment',
      };
    }
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

async function geocodeAddressWithZenrin(
  _address: string,
  _apiToken: string
): Promise<GeocodingResult> {
  try {
    // ダミー実装
    // Note: address and apiToken parameters are required for type consistency
    // with other geocoding functions (AWS, NTT), but not used in this dummy implementation
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
  if (apiType === 'aws') {
    return geocodeAddressWithAWS;
  } else if (apiType === 'ntt') {
    return geocodeAddressWithNTT;
  } else if (apiType === 'abr') {
    return geocodeAddressWithABR;
  } else {
    return geocodeAddressWithZenrin;
  }
}

// testRunは単一住所のみでのテスト用
export async function testRun(formData: FormValues): Promise<GeocodingResult> {
  const { apiType, apiToken, csvData, columns } = formData;

  // Validate
  if (!csvData || csvData.length === 0) {
    throw new Error('CSVデータが未設定または空です');
  }

  // ABR doesn't need apiToken, others do
  if (apiType !== 'abr' && !apiToken) {
    throw new Error('APIトークンが未設定です');
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
  // ABR doesn't need token/code, others use apiToken
  const result = apiType === 'abr' 
    ? await geocodeFunc(firstAddress, '')
    : await geocodeFunc(firstAddress, apiToken);

  return result;
}

// 本番実行: 選択された住所カラムにある全住所をジオコーディング
export async function runExecution(
  formData: FormValues
): Promise<RunResultSummary> {
  const { apiType, apiToken, csvData, columns } = formData;
  
  // Validate
  if (!csvData || csvData.length === 0) {
    throw new Error('CSVデータが未設定または空です');
  }

  // ABR doesn't need apiToken, others do
  if (apiType !== 'abr' && !apiToken) {
    throw new Error('APIトークンが未設定です');
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
  
  if (apiType === 'ntt') {
    // NTT: Run sequentially like Python code
    // Rate limiting: 0.2 seconds between each request (rate_limit_sleep = 0.2)
    for (let index = 0; index < addresses.length; index++) {
      const address = addresses[index];
      const result = await geocodeFunc(address, apiToken);
      results.push(result);
      
      // Rate limiting: 0.2 seconds between requests (like Python code line 342-344)
      if (index < addresses.length - 1) {
        await sleep(200); // 0.2 seconds = 200ms
      }
    }
  } else {
    // AWS, ABR, Zenrin: Run sequentially
    for (let index = 0; index < addresses.length; index++) {
      const address = addresses[index];
      // ABR doesn't need token/code, others use apiToken
      const tokenOrEmpty = apiType === 'abr' ? '' : apiToken;
      const result = await geocodeFunc(address, tokenOrEmpty);
      results.push(result);
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  return { total: results.length, successCount, failCount, results };
}
