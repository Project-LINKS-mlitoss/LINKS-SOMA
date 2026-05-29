import { app } from "electron";
import { cpus } from "node:os";
import { statSync } from "node:fs";
import { join } from "node:path";
import { dbPath } from "../../db/client";
import type {
  AppInfoData,
  BasicInfo,
  SystemInfo,
  FileSystemInfo,
  BuildInfo,
  FileInfo,
} from "./types";

export const collectAppInfo = async (): Promise<AppInfoData> => {
  // 並列実行で収集処理を高速化
  const [basic, system, files, build] = await Promise.all([
    Promise.resolve(collectBasicInfo()),
    Promise.resolve(collectSystemInfo()),
    collectFileSystemInfo(), // 既にPromiseを返す
    Promise.resolve(collectBuildInfo()),
  ]);

  return {
    basic,
    system,
    files,
    build,
  };
};

function collectBasicInfo(): BasicInfo {
  try {
    return {
      name: app.getName(),
      environment:
        process.env.NODE_ENV === "development" ? "development" : "production",
      processId: process.pid,
      userDataPath: app.getPath("userData"),
    };
  } catch {
    return {
      name: "unknown",
      environment: "unknown",
      processId: 0,
      userDataPath: "unknown",
    };
  }
}

function collectSystemInfo(): SystemInfo {
  try {
    const systemMemoryInfo = process.getSystemMemoryInfo();
    const totalMemoryBytes = systemMemoryInfo.total * 1024; // KB to bytes

    // アプリのメモリ使用量を取得
    const appMemoryUsage = process.memoryUsage();
    const appMemoryBytes = appMemoryUsage.rss; // Resident Set Size (物理メモリ使用量)

    // メモリ使用率を計算 (0-100のパーセンテージ)
    const memoryUsagePercent =
      totalMemoryBytes > 0 ? (appMemoryBytes / totalMemoryBytes) * 100 : 0;

    return {
      platform: process.platform,
      arch: process.arch,
      osVersion: process.getSystemVersion(),
      cpuCores: cpus().length,
      memory: {
        app: appMemoryBytes,
        total: totalMemoryBytes,
        available: systemMemoryInfo.free * 1024, // KB to bytes
        usage: memoryUsagePercent,
      },
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
    };
  } catch {
    return {
      platform: "unknown",
      arch: "unknown",
      osVersion: "unknown",
      cpuCores: 0,
      memory: {
        app: 0,
        total: 0,
        available: 0,
        usage: 0,
      },
      nodeVersion: "unknown",
      chromeVersion: "unknown",
    };
  }
}

async function collectFileSystemInfo(): Promise<FileSystemInfo> {
  try {
    const logsPath = app.getPath("logs");
    const isDev = process.env.NODE_ENV === "development";

    // ファイル情報を安全に取得するヘルパー関数
    const getFileInfo = (filePath: string): FileInfo => {
      try {
        const stat = statSync(filePath);
        return {
          path: filePath,
          exists: true,
          size: stat.size,
        };
      } catch {
        return {
          path: filePath,
          exists: false,
          size: 0,
        };
      }
    };

    // 開発環境と本番環境でパスを切り替える
    const pmtilesPath = isDev
      ? join(app.getAppPath(), "public", "basemap.pmtiles")
      : join(process.resourcesPath, "basemap.pmtiles");

    const mlModelsPath = isDev
      ? join(app.getAppPath(), "ml", "dist")
      : join(process.resourcesPath, "dist");

    return {
      database: getFileInfo(dbPath),
      pmtiles: getFileInfo(pmtilesPath),
      mlModels: getFileInfo(mlModelsPath),
      logsPath,
    };
  } catch {
    return {
      database: {
        path: "unknown",
        exists: false,
        size: 0,
      },
      pmtiles: {
        path: "unknown",
        exists: false,
        size: 0,
      },
      mlModels: {
        path: "unknown",
        exists: false,
        size: 0,
      },
      logsPath: "unknown",
    };
  }
}

function collectBuildInfo(): BuildInfo {
  try {
    return {
      buildDate: __BUILD_DATE__,
      buildTimestamp: __BUILD_TIMESTAMP__,
      environment: __BUILD_ENV__,
      workflowRun: __WORKFLOW_RUN__,
      commitHash: __GIT_COMMIT_HASH__,
      branch: __GIT_BRANCH__,
    };
  } catch {
    return {
      buildDate: "unknown",
      buildTimestamp: 0,
      environment: "unknown",
      workflowRun: null,
      commitHash: "unknown",
      branch: "unknown",
    };
  }
}
