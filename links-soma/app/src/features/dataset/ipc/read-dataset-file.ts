import path from "path";
import { readFileSync } from "fs";
import { dbDirectory } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const readDatasetFile = (async (
  _: unknown,
  {
    fileName,
  }: {
    fileName: string;
  },
) => {
  const filePath = path.resolve(dbDirectory, fileName);

  const data = readFileSync(filePath);

  return data;
}) satisfies IpcMainListener;
