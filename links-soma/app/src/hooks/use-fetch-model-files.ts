import useSWR, { type SWRResponse } from "swr";
import { type SelectModelFile } from "../schema";

const fetcher = (): Promise<SelectModelFile[]> => {
  const result = window.ipcRenderer.invoke("selectModelFiles");
  return result;
};

export const useFetchModelFiles = (): SWRResponse<SelectModelFile[]> => {
  const swr = useSWR("useFetchModelFiles", fetcher);
  return swr;
};
