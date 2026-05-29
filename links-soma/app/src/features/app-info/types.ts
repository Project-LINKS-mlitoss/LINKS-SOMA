export interface MemoryInfo {
  app: number; // process.memoryUsage().rss - アプリのメモリ使用量（bytes）
  total: number; // systemMemoryInfo.total * 1024 - システム総メモリ量（bytes）
  available: number; // systemMemoryInfo.free * 1024 - 利用可能メモリ量（bytes）
  usage: number; // 計算値 - アプリのメモリ使用率（%）
}

export interface FileInfo {
  path: string; // ファイルの絶対パス
  exists: boolean; // statSync()による存在チェック結果
  size: number; // stat.size - ファイルサイズ（bytes、存在しない場合は0）
}

export interface BasicInfo {
  name: string; // app.getName() - アプリケーション名
  environment: string; // NODE_ENV - 実行環境（development/production）
  processId: number; // process.pid - メインプロセスのプロセスID
  userDataPath: string; // app.getPath("userData") - ユーザーデータディレクトリパス
}

export interface SystemInfo {
  platform: string; // process.platform - OS種別（win32/darwin/linux）
  arch: string; // process.arch - CPUアーキテクチャ（x64/arm64等）
  osVersion: string; // process.getSystemVersion() - OSバージョン
  cpuCores: number; // cpus().length - CPUコア数
  memory: MemoryInfo;
  nodeVersion: string; // process.versions.node - Node.jsバージョン
  chromeVersion: string; // process.versions.chrome - Chromeバージョン
}

export interface FileSystemInfo {
  database: FileInfo; // dbPath - SQLiteデータベースファイル情報
  pmtiles: FileInfo; // app.getAppPath() + "public/basemap.pmtiles" - 地図タイルファイル情報
  mlModels: FileInfo; // app.getAppPath() + "ml/dist" - 機械学習モデルディレクトリ情報
  logsPath: string; // app.getPath("logs") - ログファイル出力ディレクトリパス
}

export interface BuildInfo {
  buildDate: string; // __BUILD_DATE__ - ビルド日時（ISO文字列）
  buildTimestamp: number; // __BUILD_TIMESTAMP__ - ビルド日時（Unixタイムスタンプ）
  environment: string; // __BUILD_ENV__ - ビルド環境（local/ci等）
  workflowRun: number | null; // __WORKFLOW_RUN__ - GitHub Actionsワークフロー実行番号
  commitHash: string; // __GIT_COMMIT_HASH__ - ビルド時のGitコミットハッシュ
  branch: string; // __GIT_BRANCH__ - ビルド時のGitブランチ名
}

export interface AppInfoData {
  basic: BasicInfo;
  system: SystemInfo;
  files: FileSystemInfo;
  build: BuildInfo;
}
