import { readFileSync } from "fs";
import shp from "shpjs";

/**
 * Shapefileから指定されたカラムのユニークな値を取得する
 * @param filePath ファイルへの絶対パス
 * @param columnName 値を取得するカラム名
 */
export const readShpColumnValues = async (
  filePath: string,
  columnName: string,
): Promise<string[]> => {
  const values = new Set<string>();
  const data = await readFileSync(filePath);
  const geojson = await shp(data);

  if ("features" in geojson) {
    for (const feature of geojson.features) {
      if (feature.properties && columnName in feature.properties) {
        const value = feature.properties[columnName];
        if (value && value !== "") {
          values.add(String(value));
        }
      }
    }
  }

  return Array.from(values).sort();
};
