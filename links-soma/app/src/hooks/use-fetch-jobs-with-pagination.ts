import useSWR, { type SWRResponse } from "swr";
import { type SelectJob } from "../schema";

type SelectJobsParams = {
  jobId?: number;
  type?: "preprocess" | "ml" | "result" | "export" | null;
  page?: number;
  limitPerPage?: number;
};

const fetcher = async ([jobId, type, page, limitPerPage, _key]: [
  SelectJobsParams["jobId"],
  SelectJobsParams["type"],
  SelectJobsParams["page"],
  SelectJobsParams["limitPerPage"],
  string,
]): Promise<SelectJob[]> => {
  const params: SelectJobsParams = {
    jobId,
    type,
    page,
    limitPerPage,
  };
  const result = await window.ipcRenderer.invoke(
    "selectJobsWithPagination",
    params,
  );
  return result;
};

export const useFetchJobsWithPagination = ({
  jobId,
  type,
  page,
  limitPerPage,
}: SelectJobsParams = {}): SWRResponse<SelectJob[]> => {
  return useSWR(
    [jobId, type, page, limitPerPage, useFetchJobsWithPagination.name],
    fetcher,
  );
};
