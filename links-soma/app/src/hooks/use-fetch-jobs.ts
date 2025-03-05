import useSWR, { type SWRResponse } from "swr";
import { type SelectJob } from "../schema";

const fetcher = async ([jobId, type]: [
  number | undefined,
  SelectJob["type"] | undefined,
  string,
]): Promise<SelectJob[]> => {
  const result = await window.ipcRenderer.invoke("selectJobs", { jobId, type });
  return result;
};

export const useFetchJobs = (
  jobId?: number,
  type?: SelectJob["type"],
): SWRResponse<SelectJob[]> => {
  const swr = useSWR([jobId, type, useFetchJobs.name], fetcher);
  return swr;
};
