import { unlinkSync, existsSync } from "fs";
import path from "path";

export function deleteDataSetFile(fileName: string): void {
  const isDev = process.env.NODE_ENV === "development";
  const directoryName = "database";
  const folderPath = isDev
    ? path.resolve(directoryName)
    : path.resolve(process.resourcesPath, directoryName);
  const filePath = path.resolve(folderPath, fileName);

  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}
