import useSWR, { type SWRResponse } from "swr";

const fetcher = ([dataSetResultId]: [
  number | undefined | null,
  string,
]): Promise<number | null> => {
  if (dataSetResultId == null) return Promise.resolve(null);

  return window.ipcRenderer.invoke("selectAreaProbabilityMax", {
    dataSetResultId,
  });
};

/**
 * area の推定空き家割合（predicted_probability）のデータセット全体の最大値を取得するフック。
 * レンジスライダーの目盛り上限をデータ分布に合わせるために使う（割合は building と違い上限が一定でない）。
 */
export const useFetchAreaProbabilityMax = ({
  dataSetResultId,
}: {
  dataSetResultId: number | undefined | null;
}): SWRResponse<number | null> => {
  return useSWR([dataSetResultId, "useFetchAreaProbabilityMax"], fetcher);
};
