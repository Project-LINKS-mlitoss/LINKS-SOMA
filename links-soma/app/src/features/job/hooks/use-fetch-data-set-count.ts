import useSWRImmutable from "swr/immutable";
import { rendererLogger } from "../../../shared/utils/renderer-logger";

/**
 * 推定結果データセットの件数（NR007 ⑨ 空き家推定結果データの件数）。
 * data_set_detail_buildings / _areas を data_set_result_id で数える既存IPCを利用する。
 */
export const useFetchDataSetCount = (
  dataSetResultId: number | undefined,
  unit: "building" | "area",
): number | undefined => {
  const { data } = useSWRImmutable(
    dataSetResultId != null
      ? { key: "useFetchDataSetCount", dataSetResultId, unit }
      : null,
    async ({ dataSetResultId, unit }) => {
      const result = await window.ipcRenderer.invoke("selectDataSetCount", {
        dataSetResultId,
        unit,
      });
      return result.count;
    },
    {
      onError: (error) =>
        rendererLogger.error("Failed to fetch data set count", {
          error,
          dataSetResultId,
          unit,
        }),
    },
  );

  return data;
};
