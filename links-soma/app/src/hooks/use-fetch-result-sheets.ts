import useSWR, { type SWRResponse } from "swr";
import { type SelectResultSheet } from "../schema";

const fetcher = ([workbookId]: [number | undefined | null, string]): Promise<
  SelectResultSheet[]
> => {
  if (!workbookId) return Promise.resolve([]);
  const result = window.ipcRenderer.invoke("selectResultSheets", {
    workbookId,
  });
  return result;
};

export const useFetchResultSheets = ({
  workbookId,
}: {
  workbookId: number | undefined | null;
}): SWRResponse<SelectResultSheet[]> => {
  const swr = useSWR([workbookId, "useFetchResultSheets"], fetcher);
  return swr;
};
