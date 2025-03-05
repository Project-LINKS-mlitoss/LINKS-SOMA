import useSWR, { type SWRResponse } from "swr";
import { type SelectNormalizedDataSet, type SelectRawDataSet } from "../schema";

type DatasetTypeWithFile = "raw" | "normalized";

type Params<T extends DatasetTypeWithFile> = {
  filePath:
    | (T extends "raw"
        ? SelectRawDataSet["file_path"]
        : SelectNormalizedDataSet["file_path"])
    | undefined;
  type: T;
};

type Response<T extends DatasetTypeWithFile> =
  | (T extends "raw" ? SelectRawDataSet : SelectNormalizedDataSet)
  | undefined;

const fetcher = <T extends DatasetTypeWithFile>({
  filePath,
  type,
}: Params<T>): Promise<Response<T>> => {
  switch (type) {
    case "raw": {
      const result = window.ipcRenderer.invoke("selectRawDatasetWithFilePath", {
        filePath,
      });
      return result as Promise<Response<T>>;
    }
    case "normalized": {
      const result = window.ipcRenderer.invoke(
        "selectNormalizedDatasetWithFilePath",
        {
          filePath,
        },
      );
      return result as Promise<Response<T>>;
    }
    default: {
      const exhaustiveCheck: never = type;
      throw new Error(`Unreachable: ${exhaustiveCheck}`);
    }
  }
};

/**
 * UUIDのファイルパス（ファイル名）からデータセットを取得する
 */
export const useFetchDatasetWithFilePath = <T extends DatasetTypeWithFile>(
  params: Params<T>,
): SWRResponse<Response<T>> => {
  const swr = useSWR(
    {
      ...params,
      key: useFetchDatasetWithFilePath.name,
    },
    fetcher<T>,
  );
  return swr;
};
