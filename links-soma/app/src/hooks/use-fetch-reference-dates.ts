import useSWR, { type SWRResponse } from "swr";
import { type ReferenceDate } from "../ipc-main-listeners/select-reference-dates";

const fetcher = ([dataSetResultId]: [
  number | undefined | null,
  string,
]): Promise<ReferenceDate[] | undefined> => {
  if (dataSetResultId == null) return Promise.resolve(undefined);

  const result = window.ipcRenderer.invoke("selectReferenceDates", {
    dataSetResultId,
  });
  return result;
};

export const useFetchReferenceDates = ({
  dataSetResultId,
}: {
  dataSetResultId: number | undefined | null;
}): SWRResponse<ReferenceDate[] | undefined> => {
  const swr = useSWR([dataSetResultId, "useFetchReferenceDates"], fetcher);
  return swr;
};
