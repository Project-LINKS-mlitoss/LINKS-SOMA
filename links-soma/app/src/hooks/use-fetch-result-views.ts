import useSWR, { type SWRResponse } from "swr";
import { type SelectResultView } from "../schema";

const fetcher = ([sheetId]: [number | undefined | null, string]): Promise<
  SelectResultView[] | null
> => {
  if (!sheetId) return Promise.resolve(null);
  const result = window.ipcRenderer.invoke("selectResultViews", {
    sheetId,
  });
  return result;
};

export const useFetchResultViews = ({
  sheetId,
}: {
  sheetId: number | undefined | null;
}): SWRResponse<SelectResultView[] | null> => {
  const swr = useSWR([sheetId, "useFetchResultViews"], fetcher);
  return swr;
};
