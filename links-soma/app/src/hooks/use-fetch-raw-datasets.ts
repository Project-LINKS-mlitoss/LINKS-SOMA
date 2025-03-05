import useSWR, { type SWRResponse } from "swr";
import { type SelectRawDataSet } from "../schema";

const fetcher = (): Promise<SelectRawDataSet[]> => {
  const result = window.ipcRenderer.invoke("selectRawDatasets");
  return result;
};

export const useFetchRawDatasets = (): SWRResponse<SelectRawDataSet[]> => {
  const swr = useSWR([useFetchRawDatasets.name], fetcher);
  return swr;
};
