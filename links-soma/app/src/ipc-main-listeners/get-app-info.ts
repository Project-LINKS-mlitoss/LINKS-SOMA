import { app } from "electron";
import type { IpcMainListener } from "./index";

export const getAppInfo: IpcMainListener = async () => {
  // アプリケーション情報を返す
  return {
    version: app.getVersion(),
    buildDate: __BUILD_DATE__,
    buildTimestamp: __BUILD_TIMESTAMP__,
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
  };
};
