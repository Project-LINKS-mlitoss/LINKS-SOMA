import useSWR, { type SWRResponse } from "swr";
import { type SelectDataSetResult } from "../schema";

type Params = {
  dataSetResultId: number | null | undefined;
};
type Response = SelectDataSetResult[] | undefined;

const fetcher = ([dataSetResultId]: [
  Params["dataSetResultId"],
  string,
]): Promise<Response> => {
  if (!dataSetResultId) return Promise.resolve(undefined);
  const result = window.ipcRenderer.invoke(
    "selectDataSetResults",
    dataSetResultId,
  );
  return result;
};

export const useFetchDataSetResultItem = ({
  dataSetResultId,
}: Params): SWRResponse<Response> => {
  const swr = useSWR([dataSetResultId, "useFetchDataSetResultItem"], fetcher);
  return swr;
};
