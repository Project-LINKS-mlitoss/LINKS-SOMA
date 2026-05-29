import { useCallback } from "react";
import { type FeatureData } from "../../types";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";

export type GetFeatureById = (id: number) => Promise<FeatureData | null>;

type UseFeatureFetcherProps = {
  unit: "building" | "area";
};

type UseFeatureFetcherReturn = {
  getFeatureById: GetFeatureById;
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

  return { getFeatureById };
};
