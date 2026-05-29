import type { IpcMainListener } from "../../ipc-main-listeners";
import type { AppInfoData } from "./types";
import { collectAppInfo } from "./collector";

export const appInfoHandler: IpcMainListener =
  async (): Promise<AppInfoData> => {
    return await collectAppInfo();
  };
