import useSWR, { type SWRResponse } from "swr";
import { type ResultDataSetUnit } from "../components/dataset/result-dataset-table";

type Params = {
  dataSetResultId: number;
  type: ResultDataSetUnit;
  page: number;
  limitPerPage: number;
};

export type ResultDataSetsResponse =
  | Record<string, string | number | null>[]
  | undefined;

const fetcher = ([id, type, page, limitPerPage]: [
  Params["dataSetResultId"],
  Params["type"],
  Params["page"],
  Params["limitPerPage"],
  string,
]): Promise<ResultDataSetsResponse> => {
  switch (type) {
    case "building": {
      const result = window.ipcRenderer.invoke(
        "selectBuildingsWithPagination",
        {
          dataSetResultId: id,
          page,
          limitPerPage,
        },
      );
      return result;
    }
    case "area": {
      const result = window.ipcRenderer.invoke("selectAreasWithPagination", {
        dataSetResultId: id,
        page,
        limitPerPage,
      });
      return result;
    }
    default: {
      const _exhaustiveCheck: never = type;
      throw new Error(`Unhandled type: ${_exhaustiveCheck}`);
    }
  }
};

export const useFetchResultDataSetsWithPagination = ({
  dataSetResultId,
  type,
  page,
  limitPerPage,
}: Params): SWRResponse<Awaited<ResultDataSetsResponse>> => {
  const swr = useSWR(
    [
      dataSetResultId,
      type,
      page,
      limitPerPage,
      useFetchResultDataSetsWithPagination.name,
    ],
    fetcher,
  );
  return swr;
};
