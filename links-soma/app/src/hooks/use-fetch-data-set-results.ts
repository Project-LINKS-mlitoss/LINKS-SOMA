import useSWR, { type SWRResponse } from "swr";
import { type SelectDataSetResult } from "../schema";

const fetcher = (): Promise<SelectDataSetResult[]> => {
  const result = window.ipcRenderer.invoke("selectDataSetResults");
  return result;
};

export const useFetchDataSetResults = (): SWRResponse<
  SelectDataSetResult[]
> => {
  const swr = useSWR("useFetchDataSetResults", fetcher);
  return swr;
};
