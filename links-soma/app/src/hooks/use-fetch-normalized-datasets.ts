import useSWR, { type SWRResponse } from "swr";
import { type SelectNormalizedDataSet } from "../schema";

const fetcher = (): Promise<SelectNormalizedDataSet[]> => {
  const result = window.ipcRenderer.invoke("selectNormalizedDataSets");
  return result;
};

export const useFetchNormalizedDatasets = (): SWRResponse<
  SelectNormalizedDataSet[]
> => {
  const swr = useSWR([useFetchNormalizedDatasets.name], fetcher);
  return swr;
};
