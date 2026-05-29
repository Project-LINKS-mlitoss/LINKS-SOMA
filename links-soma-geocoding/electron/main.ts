// electron/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';
import * as os from 'os';

// abr-geocoder library API (no CLI / no spawn — runs in-process).
// Use explicit /build paths because the package has no `main` field.
// Internal submodule paths (download-process, create-geocode-caches) are not
// covered by official exports, so we use require() to avoid TS resolution
// failures; this is the same construction the CLI uses internally.
import {
  AbrGeocoder,
  AbrGeocoderStream,
  AbrGeocoderDiContainer,
  OutputFormat,
  SearchTarget,
  DEFAULT_FUZZY_CHAR,
  FormatterProvider,
} from '@digital-go-jp/abr-geocoder/build/index';
const { Downloader } = require('@digital-go-jp/abr-geocoder/build/usecases/download/download-process');
const { createGeocodeCaches } = require('@digital-go-jp/abr-geocoder/build/usecases/geocode/services/create-geocode-caches');
// Match the CLI's MAX_CONCURRENT_DOWNLOAD (defined in @digital-go-jp/abr-geocoder/build/config/constant-values).
const MAX_CONCURRENT_DOWNLOAD = 3;

let mainWindow: BrowserWindow | null = null;

// ABR data directory (default: project folder/abr-data)
const getAbrDataDir = () => {
  // Default to project folder/abr-data
  // In production, this will be relative to app.asar or app directory
  const isDev = !app.isPackaged;
  if (isDev) {
    // Development: use project root
    return path.join(__dirname, '..', '..', 'abr-data');
  } else {
    // Production: use app resources directory
    return path.join(process.resourcesPath, 'abr-data');
  }
};

// Get prefecture file directory (writable user data directory)
const getPrefectureFileDir = (): string => {
  const isDev = !app.isPackaged;
  if (isDev) {
    // Development: use src/data directory
    return path.join(__dirname, '..', '..', 'src', 'data');
  } else {
    // Production: use user data directory (writable)
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'data');
  }
};

// Get default prefecture file from resources (read-only, bundled with app)
const getDefaultPrefectureFileFromResources = (): string | null => {
  const isDev = !app.isPackaged;
  if (isDev) {
    // Development: use src/data directory
    const devPath = path.join(__dirname, '..', '..', 'src', 'data', DEFAULT_PREFECTURE_FILE);
    return fs.existsSync(devPath) ? devPath : null;
  } else {
    // Production: use app resources directory
    const resourcesPath = path.join(process.resourcesPath, 'data', DEFAULT_PREFECTURE_FILE);
    return fs.existsSync(resourcesPath) ? resourcesPath : null;
  }
};

// Initialize default prefecture file if it doesn't exist
function initializeDefaultPrefectureFile(): void {
  try {
    const dataDir = getPrefectureFileDir();
    const defaultFilePath = path.join(dataDir, DEFAULT_PREFECTURE_FILE);
    
    // If default file already exists, no need to initialize
    if (fs.existsSync(defaultFilePath)) {
      return;
    }
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Try to copy from resources
    const sourcePath = getDefaultPrefectureFileFromResources();
    if (sourcePath && fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, defaultFilePath);
      console.log(`[Prefecture File] Initialized default file from resources: ${defaultFilePath}`);
      
      // Set as current file
      const currentFilePath = path.join(dataDir, CURRENT_FILE_METADATA);
      fs.writeFileSync(currentFilePath, DEFAULT_PREFECTURE_FILE, 'utf-8');
    }
  } catch (error) {
    console.error('[Prefecture File] Error initializing default file:', error);
  }
}

// Default prefecture file name (fallback)
const DEFAULT_PREFECTURE_FILE = '都道府県コード及び市区町村コード.xls';
const CURRENT_FILE_METADATA = '.current';

// Save uploaded prefecture file and backup original
async function savePrefectureFile(fileBuffer: Buffer, fileName: string): Promise<{ success: boolean; message: string }> {
  try {
    const dataDir = getPrefectureFileDir();
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Get current file name if exists
    const currentFilePath = path.join(dataDir, CURRENT_FILE_METADATA);
    let currentFileName = DEFAULT_PREFECTURE_FILE;
    if (fs.existsSync(currentFilePath)) {
      currentFileName = fs.readFileSync(currentFilePath, 'utf-8').trim() || DEFAULT_PREFECTURE_FILE;
    }
    
    // Backup the file that will be replaced (either current file or existing file with same name)
    // Only backup once, prioritizing the current file if it's different from the new file
    let fileToBackup: string | null = null;
    if (currentFileName !== fileName) {
      // If uploading a different file, backup the current file
      const currentFileFullPath = path.join(dataDir, currentFileName);
      if (fs.existsSync(currentFileFullPath)) {
        fileToBackup = currentFileName;
      }
    } else {
      // If uploading the same file name, backup the existing file before overwriting
      const existingFileFullPath = path.join(dataDir, fileName);
      if (fs.existsSync(existingFileFullPath)) {
        fileToBackup = fileName;
      }
    }
    
    // Create backup if needed
    if (fileToBackup) {
      // Generate timestamp: YYYYMMDDHHmmss
      const now = new Date();
      const timestamp = now.getFullYear().toString() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0') +
        String(now.getSeconds()).padStart(2, '0');
      
      // Create backup file with timestamp: filename.bak.YYYYMMDDHHmmss
      const fileToBackupPath = path.join(dataDir, fileToBackup);
      const backupFilePath = path.join(dataDir, `${fileToBackup}.bak.${timestamp}`);
      fs.copyFileSync(fileToBackupPath, backupFilePath);
    }
    
    // Save new file with original name (overwrite if exists)
    const newFilePath = path.join(dataDir, fileName);
    fs.writeFileSync(newFilePath, fileBuffer);
    
    // Save current file name to metadata
    fs.writeFileSync(currentFilePath, fileName, 'utf-8');
    
    return { success: true, message: `ファイル「${fileName}」を保存しました` };
  } catch (error) {
    console.error('[Prefecture File] Error saving file:', error);
    return { 
      success: false, 
      message: `ファイルの保存に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}` 
    };
  }
}

// Find the latest backup file for a given filename
function findLatestBackupFile(dataDir: string, baseFileName: string): string | null {
  try {
    const files = fs.readdirSync(dataDir);
    const backupPattern = new RegExp(`^${baseFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.bak\\.\\d{14}$`);
    
    const backupFiles = files
      .filter(file => backupPattern.test(file))
      .map(file => ({
        name: file,
        path: path.join(dataDir, file),
        timestamp: file.match(/\.bak\.(\d{14})$/)?.[1] || ''
      }))
      .filter(file => file.timestamp) // Only files with valid timestamp
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Sort by timestamp descending (newest first)
    
    if (backupFiles.length > 0) {
      return backupFiles[0].path; // Return the newest backup
    }
    
    // Fallback: check for old format backup (without timestamp) for backward compatibility
    const oldBackupPath = path.join(dataDir, `${baseFileName}.bak`);
    if (fs.existsSync(oldBackupPath)) {
      return oldBackupPath;
    }
    
    return null;
  } catch (error) {
    console.error('[Prefecture File] Error finding backup file:', error);
    return null;
  }
}

// Get default prefecture file path (original or backup)
function getDefaultPrefectureFilePath(): { path: string; fileName: string; isBackup: boolean } | null {
  try {
    const dataDir = getPrefectureFileDir();
    
    // Read current file name from metadata
    const currentFilePath = path.join(dataDir, CURRENT_FILE_METADATA);
    let currentFileName = DEFAULT_PREFECTURE_FILE;
    if (fs.existsSync(currentFilePath)) {
      currentFileName = fs.readFileSync(currentFilePath, 'utf-8').trim() || DEFAULT_PREFECTURE_FILE;
    }
    
    const defaultFilePath = path.join(dataDir, currentFileName);
    
    // Check if original file exists
    if (fs.existsSync(defaultFilePath)) {
      return { path: defaultFilePath, fileName: currentFileName, isBackup: false };
    }
    
    // Check if backup file exists (with timestamp or old format)
    const backupFilePath = findLatestBackupFile(dataDir, currentFileName);
    if (backupFilePath) {
      return { path: backupFilePath, fileName: currentFileName, isBackup: true };
    }
    
    // Fallback: check for default file name
    const fallbackFilePath = path.join(dataDir, DEFAULT_PREFECTURE_FILE);
    if (fs.existsSync(fallbackFilePath)) {
      return { path: fallbackFilePath, fileName: DEFAULT_PREFECTURE_FILE, isBackup: false };
    }
    
    // Fallback: check for default backup file
    const fallbackBackupPath = findLatestBackupFile(dataDir, DEFAULT_PREFECTURE_FILE);
    if (fallbackBackupPath) {
      return { path: fallbackBackupPath, fileName: DEFAULT_PREFECTURE_FILE, isBackup: true };
    }
    
    return null;
  } catch (error) {
    console.error('[Prefecture File] Error getting file path:', error);
    return null;
  }
}

// Get default prefecture file for download
async function getDefaultPrefectureFile(): Promise<{ success: boolean; filePath?: string; fileName?: string; isBackup?: boolean; error?: string }> {
  try {
    const fileInfo = getDefaultPrefectureFilePath();
    
    if (!fileInfo) {
      return { success: false, error: 'デフォルトファイルが見つかりません' };
    }
    
    const actualFileName = path.basename(fileInfo.path);
    
    return {
      success: true,
      filePath: fileInfo.path,
      fileName: actualFileName,
      isBackup: fileInfo.isBackup,
    };
  } catch (error) {
    console.error('[Prefecture File] Error getting file:', error);
    return {
      success: false,
      error: `ファイルの取得に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
    };
  }
}

// Read default prefecture file content
async function readDefaultPrefectureFile(): Promise<{ success: boolean; buffer?: Buffer; fileName?: string; error?: string }> {
  try {
    const fileInfo = getDefaultPrefectureFilePath();
    
    if (!fileInfo) {
      return { success: false, error: 'デフォルトファイルが見つかりません' };
    }
    
    const buffer = fs.readFileSync(fileInfo.path);
    const actualFileName = path.basename(fileInfo.path);
    
    return {
      success: true,
      buffer,
      fileName: actualFileName,
    };
  } catch (error) {
    console.error('[Prefecture File] Error reading file:', error);
    return {
      success: false,
      error: `ファイルの読み込みに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
    };
  }
}

// Build a DI container shared by Downloader, createGeocodeCaches, and AbrGeocoder.
function buildAbrContainer(): InstanceType<typeof AbrGeocoderDiContainer> {
  const abrgDir = getAbrDataDir();
  return new AbrGeocoderDiContainer({
    database: {
      type: 'sqlite3',
      dataDir: path.join(abrgDir, 'database'),
    },
    cacheDir: path.join(abrgDir, 'cache'),
    debug: false,
  });
}

function numThreads(): number {
  return Math.max(os.cpus().length - 1, 1);
}

// Check if ABR data exists (data should already be downloaded)
function checkAbrDataExists(): boolean {
  const abrDir = getAbrDataDir();
  // Check if data directory exists and has data files
  // This is a simplified check - adjust based on actual ABR data structure
  return fs.existsSync(abrDir) && fs.statSync(abrDir).isDirectory();
}

// Check if ABR data exists for a specific lgCode.
// After a successful download, abr-geocoder creates:
//   abr-data/database/abrg-{lgCode}.sqlite  (city-level SQLite DB)
//   abr-data/download/mt_*_city{lgCode}.csv (city-level CSV files)
function checkAbrDataExistsForCode(lgCode: string): boolean {
  const abrDir = getAbrDataDir();
  if (!fs.existsSync(abrDir)) {
    return false;
  }

  // Primary check: city-specific SQLite database (most reliable)
  if (lgCode.length === 6) {
    const dbFile = path.join(abrDir, 'database', `abrg-${lgCode}.sqlite`);
    if (fs.existsSync(dbFile)) return true;
  }

  // Secondary check: download/ folder for CSV files
  const downloadDir = path.join(abrDir, 'download');
  if (!fs.existsSync(downloadDir)) {
    return false;
  }

  try {
    const files = fs.readdirSync(downloadDir);
    return files.some((file) => {
      const fileName = file.replace(/\.zip$/, '');
      if (lgCode.length === 6) {
        return fileName.includes(`city${lgCode}`);
      } else if (lgCode.length === 2) {
        return fileName.includes(`pref${lgCode}`);
      } else {
        return fileName.includes(lgCode);
      }
    });
  } catch (error) {
    console.error(`[ABR] Error checking data for code ${lgCode}:`, error);
    return false;
  }
}

// Delete all ABR data
async function deleteAbrData(): Promise<{ success: boolean; message: string }> {
  try {
    const abrDataDir = getAbrDataDir();
    
    if (!fs.existsSync(abrDataDir)) {
      return { success: true, message: 'データが存在しません' };
    }

    console.log(`[ABR] Deleting data directory: ${abrDataDir}`);
    
    // Delete directory recursively
    fs.rmSync(abrDataDir, { recursive: true, force: true });
    
    console.log(`[ABR] Data deleted successfully`);
    return { success: true, message: 'データが削除されました' };
  } catch (error: any) {
    console.error(`[ABR] Error deleting data: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// Download ABR data using the abr-geocoder library Downloader (in-process).
// Mirrors what abrg's CLI `download` command does internally: data fetch +
// geocode cache build. No spawn / no external Node dependency.
async function downloadAbrData(
  abrCodes: string | string[],
  onProgress?: (progress: string) => void
): Promise<{ success: boolean; message: string }> {
  try {
    const abrgDir = getAbrDataDir();
    const codes = Array.isArray(abrCodes) ? abrCodes : [abrCodes];

    console.log(`[ABR] Downloading data for ${codes.length} code(s): ${codes.join(', ')}`);
    console.log(`[ABR] Using data dir: ${abrgDir}`);

    if (!fs.existsSync(abrgDir)) {
      fs.mkdirSync(abrgDir, { recursive: true });
    }

    const dbConfig = { type: 'sqlite3' as const, dataDir: path.join(abrgDir, 'database') };
    const threads = numThreads();

    const downloader = new Downloader({
      cacheDir: path.join(abrgDir, 'cache'),
      downloadDir: path.join(abrgDir, 'download'),
      database: dbConfig,
      keepFiles: false,
    });

    await downloader.download({
      lgCodes: codes,
      concurrentDownloads: MAX_CONCURRENT_DOWNLOAD,
      numOfThreads: threads,
      progress: (current: number, total: number) => {
        if (onProgress) {
          onProgress(`Downloading: ${current}/${total}`);
        }
      },
    });

    // Build geocode caches after download (matches CLI download-command behavior).
    const container = buildAbrContainer();
    await createGeocodeCaches({
      container,
      maxConcurrency: threads,
      progress: (current: number, total: number) => {
        if (onProgress) {
          onProgress(`Building cache: ${current}/${total}`);
        }
      },
    });

    // Downloader.download() swallows pipeline errors internally (catches and
    // logs without re-throwing), so a resolved Promise does not guarantee
    // success. Verify each requested lgCode has data on disk before reporting
    // success to the UI.
    const missing = codes.filter((code) => !checkAbrDataExistsForCode(code));
    if (missing.length > 0) {
      const msg = `データ取得に失敗したlgCodeがあります: ${missing.join(', ')}`;
      console.error(`[ABR] ${msg}`);
      return { success: false, message: msg };
    }

    console.log(`[ABR] Download completed successfully`);
    return { success: true, message: 'Download completed successfully' };
  } catch (error: any) {
    console.error(`[ABR] Download error: ${error?.message ?? error}`);
    return { success: false, message: error?.message ?? String(error) };
  }
}

type GeocodeResult = {
  success: boolean;
  lat?: number;
  lon?: number;
  label?: string;
  errorMessage?: string;
  score?: number;
  matchLevel?: string;
  coordinateLevel?: string;
  rsdtAddrFlg?: number;
};

// Convert a single parsed JSON element from FormatterProvider(JSON) to UI shape.
function normalizeAbrResultItem(item: any, fallbackAddress: string): GeocodeResult {
  const inner = item?.result ?? item;
  if (!inner || inner.lat === undefined || inner.lon === undefined) {
    return { success: false, errorMessage: '該当する住所が見つかりませんでした' };
  }
  return {
    success: true,
    lat: typeof inner.lat === 'number' ? inner.lat : parseFloat(inner.lat),
    lon: typeof inner.lon === 'number' ? inner.lon : parseFloat(inner.lon),
    label: inner.output || inner.address || inner.label || fallbackAddress,
    score: inner.score !== undefined
      ? (typeof inner.score === 'number' ? inner.score : parseFloat(inner.score))
      : undefined,
    matchLevel: inner.match_level || inner.matchLevel,
    coordinateLevel: inner.coordinate_level || inner.coordinateLevel,
    rsdtAddrFlg: inner.rsdt_addr_flg !== undefined
      ? (typeof inner.rsdt_addr_flg === 'number' ? inner.rsdt_addr_flg : parseInt(inner.rsdt_addr_flg, 10))
      : undefined,
  };
}

// In-process geocoding pipeline using the abr-geocoder library:
//   addresses -> AbrGeocoderStream -> FormatterProvider(JSON) -> collected text
// Mirrors the CLI's geocode command without spawning a child process.
async function geocodeBatchWithAbr(addresses: string[]): Promise<GeocodeResult[]> {
  if (addresses.length === 0) return [];

  try {
    const container = buildAbrContainer();
    const threads = Math.min(numThreads(), addresses.length);

    const geocoder = await AbrGeocoder.create({
      container,
      numOfThreads: threads,
      isSilentMode: true,
    });

    const stream = new AbrGeocoderStream({
      geocoder,
      fuzzy: DEFAULT_FUZZY_CHAR,
      searchTarget: SearchTarget.ALL,
      highWatermark: Math.max(threads * 500, 1000),
    });

    const formatter = FormatterProvider.get({ type: OutputFormat.JSON, debug: false });
    const source = Readable.from(addresses.map(a => `${a}\n`));

    let collected = '';
    const sink = new Writable({
      write(chunk, _enc, cb) {
        collected += chunk.toString();
        cb();
      },
    });

    await pipeline(source, stream, formatter, sink);

    let parsedResults: GeocodeResult[];
    try {
      const arr = JSON.parse(collected.trim());
      parsedResults = Array.isArray(arr)
        ? arr.map((item, i) => normalizeAbrResultItem(item, addresses[i] ?? ''))
        : addresses.map(() => ({ success: false, errorMessage: 'Invalid response format' }));
    } catch (e: any) {
      console.error(`[ABR] Parse error: ${e.message}, output head: ${collected.substring(0, 200)}`);
      return addresses.map(() => ({
        success: false,
        errorMessage: e.message || 'Failed to parse geocoding result',
      }));
    }

    while (parsedResults.length < addresses.length) {
      parsedResults.push({ success: false, errorMessage: '該当する住所が見つかりませんでした' });
    }
    return parsedResults.slice(0, addresses.length);
  } catch (error: any) {
    console.error(`[ABR] Geocode batch error: ${error?.message ?? error}`);
    return addresses.map(() => ({
      success: false,
      errorMessage: error?.message ?? String(error),
    }));
  }
}

async function geocodeWithAbr(address: string): Promise<GeocodeResult> {
  const [result] = await geocodeBatchWithAbr([address]);
  return result ?? { success: false, errorMessage: 'No result returned' };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // React アプリのビルド成果物を読み込む場合
  const indexHtmlPath = path.join(__dirname, '..', '..', 'dist', 'index.html');
  mainWindow.loadFile(indexHtmlPath);

  // 開発時に React Dev Server を使う場合
  // mainWindow.loadURL('http://localhost:3000');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('abr:check-data', async () => {
  return checkAbrDataExists();
});

ipcMain.handle('abr:check-data-for-code', async (_event, lgCode: string) => {
  return checkAbrDataExistsForCode(lgCode);
});

ipcMain.handle('abr:download-data', async (_event, abrCodes: string | string[]) => {
  // Keep download handler for manual download if needed, but data should already be available
  return downloadAbrData(abrCodes);
});

// Download with progress streaming
ipcMain.handle('abr:download-data-with-progress', async (event, abrCodes: string | string[]) => {
  return new Promise((resolve) => {
    downloadAbrData(abrCodes, (progress) => {
      // Send progress to renderer
      event.sender.send('abr:download-progress', progress);
    }).then(resolve);
  });
});

// Delete all ABR data
ipcMain.handle('abr:delete-data', async () => {
  return deleteAbrData();
});

ipcMain.handle('abr:geocode', async (_event, address: string) => {
  return geocodeWithAbr(address);
});

ipcMain.handle('abr:geocode-batch', async (_event, addresses: string[]) => {
  return geocodeBatchWithAbr(addresses);
});

// Prefecture file management handlers
ipcMain.handle('prefecture-file:save', async (_event, fileBuffer: Buffer, fileName: string) => {
  return savePrefectureFile(fileBuffer, fileName);
});

ipcMain.handle('prefecture-file:get-default', async () => {
  return getDefaultPrefectureFile();
});

ipcMain.handle('prefecture-file:read-default', async () => {
  return readDefaultPrefectureFile();
});

app.on('ready', () => {
  // Initialize default prefecture file before creating window
  initializeDefaultPrefectureFile();
  createWindow();
});

app.on('window-all-closed', () => {
  // macOS 以外ではすべてのウィンドウが閉じられた時に終了
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // macOS ではウィンドウが全て閉じられても、Dock アイコンがクリックされたら再度ウィンドウを開く
  if (mainWindow === null) {
    createWindow();
  }
});
