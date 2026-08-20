import useSWR, { type SWRResponse } from "swr";

const fetcher = ([dataSetResultId]: [
  number | undefined | null,
  string,
]): Promise<number | null> => {
  if (dataSetResultId == null) return Promise.resolve(null);

  // 既存の selectBuildingsCount を geometryNotNull で呼び、測位済み建物の件数を得る。
  // referenceDate を渡さない＝推定結果全体で「座標付き建物が1件でもあるか」を判定する。
  return window.ipcRenderer.invoke("selectBuildingsCount", {
    dataSetResultId,
    filterConditions: [],
    geometryNotNull: true,
  });
};

/**
 * 推定結果に「座標付き建物（測位済み）」が何件あるかを取得するフック。
 *
 * 用途: 地図・地域集計ビューは建物の位置情報を前提とするため、測位ゼロの結果を
 * 開いたときに前提条件案内を出すかの判定に使う。件数(0件)ではなく「測位の有無」で
 * 判定するため、実測0（空き家0件）と退化0（位置情報なし）を取り違えない。
 */
export const useFetchPositionedBuildingCount = ({
  dataSetResultId,
}: {
  dataSetResultId: number | undefined | null;
}): SWRResponse<number | null> => {
  return useSWR([dataSetResultId, "useFetchPositionedBuildingCount"], fetcher);
};
