import useSWR, { type SWRResponse } from "swr";
import { type EstimationParameters } from "../../ipc";

const fetcher = ([dataSetResultId]: [
  number | undefined | null,
  string,
]): Promise<EstimationParameters | null> => {
  if (dataSetResultId == null) return Promise.resolve(null);

  return window.ipcRenderer.invoke("selectEstimationParameters", {
    dataSetResultId,
  });
};

/**
 * 推定再実行（FR022）のための、元 job の推定入力を復元するフック。
 * data_set_results → jobs → parameters（result 型）の経路で取得する。
 * CSV インポート経由の結果など復元不可なら null（UI 側でボタンを無効化）。
 */
export const useFetchEstimationParameters = ({
  dataSetResultId,
}: {
  dataSetResultId: number | undefined | null;
}): SWRResponse<EstimationParameters | null> => {
  return useSWR([dataSetResultId, "useFetchEstimationParameters"], fetcher);
};
