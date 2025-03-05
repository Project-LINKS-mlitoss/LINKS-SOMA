import useSWR, { type SWRResponse } from "swr";
import { type SelectWorkbook } from "../schema";

const fetcher = ([workbookId]: [number | undefined, string]): Promise<
  SelectWorkbook | undefined
> => {
  if (!workbookId) return Promise.resolve(undefined);
  const result = window.ipcRenderer.invoke("selectWorkbook", {
    id: workbookId,
  });
  return result;
};

export const useFetchWorkbook = ({
  id,
}: {
  id: number | undefined;
}): SWRResponse<SelectWorkbook | undefined> => {
  const swr = useSWR([id, "useFetchWorkbook"], fetcher);
  return swr;
};
