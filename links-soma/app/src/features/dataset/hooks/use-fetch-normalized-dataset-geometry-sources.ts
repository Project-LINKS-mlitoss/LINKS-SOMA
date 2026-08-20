import useSWR, { type SWRResponse } from "swr";
import { type NormalizedDatasetGeometrySource } from "../ipc/select-normalized-dataset-geometry-sources";

const fetcher = ([{ paths }]: [{ paths: string[] }, string]): Promise<
  NormalizedDatasetGeometrySource[]
> => {
  return window.ipcRenderer.invoke("selectNormalizedDatasetGeometrySources", {
    paths,
  });
};

/**
 * 選択中の名寄せデータがジオコーディング（地域集計に必要な建物ジオメトリの唯一の源）を
 * 使ったかを取得する（issue #1924）。paths が変わるたびに再取得する。
 *
 * 判定対象（完了済み名寄せジョブの parameters.geocoding）はセッション中不変なので stale リスクは無い。
 * keepPreviousData=true で paths 切替中も直前の結果を保持し、再取得完了までの一瞬 data が undefined に
 * 落ちるのを防ぐ。これが無いと呼び出し側で「表示中フォームが点滅→選択値がクリア」される（#1924）。
 */
export const useFetchNormalizedDatasetGeometrySources = (
  paths: string[],
): SWRResponse<NormalizedDatasetGeometrySource[]> => {
  return useSWR(
    [{ paths }, "useFetchNormalizedDatasetGeometrySources"],
    fetcher,
    { keepPreviousData: true },
  );
};
