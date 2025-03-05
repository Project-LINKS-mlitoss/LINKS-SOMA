import path from "path";
import { existsSync, mkdirSync, writeFile } from "fs";
import { type IpcMainListener } from ".";

export const saveFile = ((
  _: unknown,
  {
    data,
    fileName,
  }: {
    data: ArrayBuffer;
    fileName: string;
  },
) => {
  const isDev = process.env.NODE_ENV === "development";
  const directoryName = "database";
  const folderPath = isDev
    ? path.resolve(directoryName)
    : path.resolve(process.resourcesPath, directoryName);

  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }

  const buffer = Buffer.from(data);
  const filePath = path.resolve(folderPath, fileName);
  writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error("ファイルの保存中にエラーが発生しました:", err);
    } else {
      console.info("ファイルが正常に保存されました:", filePath);
    }
  });
}) satisfies IpcMainListener;
