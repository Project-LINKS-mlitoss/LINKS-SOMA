import { useCallback } from "react";
import { type FeatureData } from "../../types";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";

export type GetFeatureById = (id: number) => Promise<FeatureData | null>;

/** 開いているフィーチャーを別の推定基準日の同一対象へ引き直す。該当なしは null。 */
export type GetFeatureByReferenceDate = (
  feature: FeatureData,
  referenceDate: string | undefined,
) => Promise<FeatureData | null>;

type UseFeatureFetcherProps = {
  unit: "building" | "area";
};

type UseFeatureFetcherReturn = {
  getFeatureById: GetFeatureById;
  getFeatureByReferenceDate: GetFeatureByReferenceDate;
};

/**
 * フィーチャーデータをIDで取得するためのフック
 * IPC呼び出しを抽象化し、コンポーネントからデータ取得の詳細を隠蔽する
 */
export const useFeatureFetcher = ({
  unit,
}: UseFeatureFetcherProps): UseFeatureFetcherReturn => {
  const getFeatureById = useCallback(
    async (id: number): Promise<FeatureData | null> => {
      try {
        if (unit === "area") {
          return await window.ipcRenderer.invoke("selectArea", {
            dataSetDetailAreasId: id,
          });
        } else {
          return await window.ipcRenderer.invoke("selectBuilding", {
            dataSetDetailBuildingsId: id,
          });
        }
      } catch (error) {
        rendererLogger.error("Failed to fetch feature by ID", error, {
          id,
          unit,
          component: "useFeatureFetcher",
        });
        return null;
      }
    },
    [unit],
  );

  const getFeatureByReferenceDate = useCallback(
    async (
      feature: FeatureData,
      referenceDate: string | undefined,
    ): Promise<FeatureData | null> => {
      if (!referenceDate) return null;
      try {
        const props = feature.properties as Record<string, unknown>;
        const dataSetResultId = props.data_set_result_id;
        if (typeof dataSetResultId !== "number") return null;

        if (unit === "area") {
          const areaGroup = props.area_group;
          const keyCode = props.key_code;
          if (typeof areaGroup !== "string" || typeof keyCode !== "string") {
            return null;
          }
          return await window.ipcRenderer.invoke("selectAreaByReferenceDate", {
            dataSetResultId,
            areaGroup,
            keyCode,
            referenceDate,
          });
        }

        const normalizedAddress = props.normalized_address;
        if (typeof normalizedAddress !== "string") return null;
        return await window.ipcRenderer.invoke(
          "selectBuildingByReferenceDate",
          {
            dataSetResultId,
            normalizedAddress,
            referenceDate,
          },
        );
      } catch (error) {
        rendererLogger.error(
          "Failed to fetch feature by reference date",
          error,
          {
            unit,
            referenceDate,
            component: "useFeatureFetcher",
          },
        );
        return null;
      }
    },
    [unit],
  );

  return { getFeatureById, getFeatureByReferenceDate };
};
