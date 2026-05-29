import { type Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useRef } from "react";
import { POLYGON_RENDER_MIN_ZOOM } from "../../components/views/map/map-container/const";

export type UsePopupCameraReturn = {
  /** 指定座標にカメラを移動（ズームレベルも調整） */
  flyToFeature: (coordinates: [number, number]) => void;
  /** 次のflyToをスキップする */
  skipNextFlyTo: () => void;
  /** flyToがスキップされるかどうか */
  shouldSkipFlyTo: () => boolean;
};

/**
 * ポップアップ表示時のカメラ制御を管理するフック
 */
export const usePopupCamera = ({
  mapInstance,
  unit,
}: {
  mapInstance: MapLibreMap | null;
  unit: "building" | "area";
}): UsePopupCameraReturn => {
  const skipNextFlyToRef = useRef(false);

  const flyToFeature = useCallback(
    (coordinates: [number, number]) => {
      if (!mapInstance) return;

      // スキップフラグが立っている場合は移動しない
      if (skipNextFlyToRef.current) {
        skipNextFlyToRef.current = false;
        return;
      }

      const currentZoom = mapInstance.getZoom();
      const minZoomRequired = POLYGON_RENDER_MIN_ZOOM[unit];
      const targetZoom =
        currentZoom < minZoomRequired ? minZoomRequired + 1 : undefined;

      mapInstance.flyTo({
        center: coordinates,
        zoom: targetZoom,
        padding: { bottom: 280 },
      });
    },
    [mapInstance, unit],
  );

  const skipNextFlyTo = useCallback(() => {
    skipNextFlyToRef.current = true;
  }, []);

  const shouldSkipFlyTo = useCallback(() => {
    return skipNextFlyToRef.current;
  }, []);

  return {
    flyToFeature,
    skipNextFlyTo,
    shouldSkipFlyTo,
  };
};
