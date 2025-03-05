import useSWR, { type SWRResponse } from "swr";
import { type SelectJobResult } from "../schema";

type Response = SelectJobResult | undefined;

const fetcher = ([jobId]: [number, string]): Promise<Response> => {
  const result = window.ipcRenderer.invoke("selectJobResults", { jobId });
  return result;
};

export const useFetchJobResults = ({
  jobId,
}: {
  jobId: number;
}): SWRResponse<Response> => {
  const swr = useSWR([jobId, useFetchJobResults.name], fetcher);
  return swr;
};
