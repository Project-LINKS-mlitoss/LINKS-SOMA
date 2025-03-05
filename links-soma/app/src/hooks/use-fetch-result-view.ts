import useSWR, { type SWRResponse } from "swr";
import { type SelectResultView } from "../schema";

const fetcher = ([resultViewId]: [number | undefined, string]): Promise<
  SelectResultView | undefined
> => {
  if (!resultViewId) return Promise.resolve(undefined);
  const result = window.ipcRenderer.invoke("selectResultView", {
    resultViewId,
  });
  return result;
};

export const useFetchResultView = ({
  resultViewId,
}: {
  resultViewId: number | undefined;
}): SWRResponse<SelectResultView | undefined> => {
  const swr = useSWR([resultViewId, useFetchResultView.name], fetcher);
  return swr;
};
