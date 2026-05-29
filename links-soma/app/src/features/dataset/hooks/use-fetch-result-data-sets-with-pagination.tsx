import useSWR, { type SWRResponse } from "swr";
import { type ResultDataSetUnit } from "../components/dataset/result-dataset-table/types";
import { type PaginatedBuildingsResponse } from "../../bi/ipc/select-buildings-with-pagination";
import { type PaginatedAreasResponse } from "../../bi/ipc/select-areas-with-pagination";

type Params = {
  dataSetResultId: number | null;
  type: ResultDataSetUnit;
  page: number;
  limitPerPage: number;
};

export type ResultDataSetsResponse = {
  data: Record<string, string | number | null>[];
  totalCount: number;
} | null;

/**
 * optional_data_source（JSON配列型）をレスポンスから除外する。
 *
 * このカラムはユーザーが任意で取り込んだ追加説明変数の生データを保持するJSON型で、
 * DataPreviewTable（推定結果プレビュー）のスカラー値前提の表示ロジックに適合しない。
 * 分析画面での表示は別途専用UIで対応予定のため、ここでは除外して
 * 既存の型制約（Record<string, string | number | null>）を維持する。
 */
const excludeJsonColumns = <T extends Record<string, unknown>>(
  data: T[],
): Record<string, string | number | null>[] =>
  data.map(
    ({ optional_data_source: _, ...rest }) =>
      rest as Record<string, string | number | null>,
  );

const fetcher = async ([id, type, page, limitPerPage]: [
  Params["dataSetResultId"],
  Params["type"],
  Params["page"],
  Params["limitPerPage"],
  string,
]): Promise<ResultDataSetsResponse> => {
  if (id === null) {
    return null;
  }
  switch (type) {
    case "building": {
      const result: PaginatedBuildingsResponse =
        await window.ipcRenderer.invoke("selectBuildingsWithPagination", {
          dataSetResultId: id,
          page,
          limitPerPage,
        });
      return {
        data: excludeJsonColumns(result.data),
        totalCount: result.totalCount,
      };
    }
    case "area": {
      const result: PaginatedAreasResponse = await window.ipcRenderer.invoke(
        "selectAreasWithPagination",
        {
          dataSetResultId: id,
          page,
          limitPerPage,
        },
      );
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
