import { basename } from "path";
import { Open } from "unzipper";
import { readCSVColumnValues } from "../util/read-csv-column-values";
import { getFilePathInDatabaseDirectory } from "../../../shared/utils/get-file-path-in-database-directory";
import { readShpColumnValues } from "../../../shared/utils/read-shp-column-values";
import { readGPKGColumnValues } from "../util/read-gpkg-column-values";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export type readDatasetColumnValuesArgs = {
  filename: string | undefined;
  columnName: string | undefined;
};

export type FileType = "csv" | "shapefile" | "citygml" | "geopackage";

const classifyFileType = async (filePath: string): Promise<FileType> => {
  const filename = basename(filePath);
  const ext = filename.split(".")?.pop();

  if (ext === "csv") {
    return "csv" as const;
  }

  if (ext === "gpkg") {
    return "geopackage" as const;
  }

  if (ext === "zip") {
    const directory = await Open.file(filePath);
    // 同一のZip内にShapefileとCityGMLが混在している場合はShapefileを優先
    const isShapefile = directory.files
      .map((file) => file.path)
      .some((path) => path.endsWith(".shp"));

    if (isShapefile) {
      return "shapefile" as const;
    }

    return "citygml" as const;
  }

  return "csv";
};

/**
 * データセットの絶対パスと列名から、その列のユニークな値を取得する
 */
export const readDatasetColumnValues = (async (
  _: unknown,
  { filename, columnName }: readDatasetColumnValuesArgs,
): Promise<string[] | undefined> => {
  if (!filename || !columnName) {
    return undefined;
  }

  const filePath = getFilePathInDatabaseDirectory(filename);
  const fileType = await classifyFileType(filePath);

  switch (fileType) {
    case "csv": {
      const result = await readCSVColumnValues(filePath, columnName);
      return result;
    }
    case "geopackage": {
      const result = await readGPKGColumnValues(filePath, columnName);
      return result;
    }
    case "citygml":
      return undefined;
    case "shapefile": {
      const result = await readShpColumnValues(filePath, columnName);
      return result;
    }
    default: {
      return undefined;
    }
  }
}) satisfies IpcMainListener;
