import useSWR, { type SWRResponse } from "swr";

const fetcher = ([dataSetResultId]: [
  number | undefined | null,
  string,
]): Promise<number | null> => {
  if (dataSetResultId == null) return Promise.resolve(null);

  return window.ipcRenderer.invoke("selectEstimationThreshold", {
    dataSetResultId,
  });
};

/**
 * 推定実行時に使用された閾値を取得するフック
 * data_set_results → jobs → parameters.settings.threshold の経路で取得
 */
export const useFetchEstimationThreshold = ({
  dataSetResultId,
}: {
  dataSetResultId: number | undefined | null;
}): SWRResponse<number | null> => {
  return useSWR([dataSetResultId, "useFetchEstimationThreshold"], fetcher);
};
