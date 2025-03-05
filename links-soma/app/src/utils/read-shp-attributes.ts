import { readFileSync } from "fs";
import shp from "shpjs";

/**
 *
 * ShapefileをZipで読み込み属性を取得
 * @param filePath ファイルへの絶対パス
 * @returns
 */
export const readShpAttributes = async (
  filePath: string,
): Promise<string[] | undefined> => {
  const data = await readFileSync(filePath);
  const geojson = await shp(data);

  if ("features" in geojson) {
    const properties = geojson.features.flatMap((feature) => {
      return feature.properties !== null ? Object.keys(feature.properties) : [];
    });

    return [...new Set(properties)];
  }

  return undefined;
};
