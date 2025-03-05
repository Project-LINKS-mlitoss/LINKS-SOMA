import path from "path";

/** Publicフォルダのアセットにアクセスする・開発向けの関数 */
export function getFilePathInDummyData(...filePaths: string[]): string {
  const isDev = process.env.NODE_ENV === "development";
  const directoryName = "dummy-data";
  const basePath = isDev
    ? path.resolve(directoryName)
    : path.join(process.resourcesPath, directoryName);

  return path.join(basePath, ...filePaths);
}
