import "maplibre-gl/dist/maplibre-gl.css";
import "./maplibre-gl.css";
import { useEffect } from "react";
import { type FilterSpecification } from "maplibre-gl";
import { makeStyles } from "@fluentui/react-components";
import { type VacancyLevels } from "../../../vacancy-level-checkbox/types";
import {
  type MapInitReturn,
  type ViewportLayerEffectReturn,
} from "../../../../../../hooks/map";
import { LAYER_SUFFIXES, PREDICTED_PROBABILITY } from "../../const";
import { type MapWithTableView } from "../../../../../../types";

const useStyles = makeStyles({
  map: {
    width: "100%",
    height: "600px",
  },
});

type Props = {
  view: MapWithTableView;
  vacancyLevels: VacancyLevels;
  mapInitState: MapInitReturn;
  viewportLayerEffectState?: ViewportLayerEffectReturn;
};

export function MapContainer({
  view,
  vacancyLevels,
  mapInitState: { containerRef, mapInstance },
  viewportLayerEffectState,
}: Props): JSX.Element {
  const styles = useStyles();

  const { unit } = view;

  // ビューポートモードのレイヤーIDのみを使用
  const currentLayerIds = viewportLayerEffectState?.layerIds;

  useEffect(
    function applyFiltersEffect() {
      if (!mapInstance || !currentLayerIds?.length) return;

      // ベースIDから実際のレイヤーID（-points, -polygons）を生成
      const actualLayerIds = currentLayerIds.flatMap((baseId) => [
        `${baseId}${LAYER_SUFFIXES.POINTS}`,
        `${baseId}${LAYER_SUFFIXES.POLYGONS}`,
      ]);

      const allFalse =
        !vacancyLevels.low && !vacancyLevels.medium && !vacancyLevels.high;
      if (allFalse) {
        for (const layerId of actualLayerIds) {
          if (!mapInstance.getLayer(layerId)) continue;
          mapInstance.setLayoutProperty(layerId, "visibility", "none");
        }
        return;
      }

      for (const layerId of actualLayerIds) {
        if (!mapInstance.getLayer(layerId)) continue;
        const filters = [];
        if (vacancyLevels.low) {
          filters.push([
            "<",
            ["get", "predicted_probability"],
            PREDICTED_PROBABILITY[unit].medium,
          ]);
        }
        if (vacancyLevels.medium) {
          filters.push([
            "all",
            [
              ">=",
              ["get", "predicted_probability"],
              PREDICTED_PROBABILITY[unit].medium,
            ],
            [
              "<",
              ["get", "predicted_probability"],
              PREDICTED_PROBABILITY[unit].high,
            ],
          ]);
        }
        if (vacancyLevels.high) {
          filters.push([
            ">=",
            ["get", "predicted_probability"],
            PREDICTED_PROBABILITY[unit].high,
          ]);
        }

        const mapLibreFilter = ["any", ...filters] as FilterSpecification;

        mapInstance.setLayoutProperty(layerId, "visibility", "visible");
        mapInstance.setFilter(layerId, mapLibreFilter);
      }
    },
    [
      currentLayerIds,
      mapInstance,
      unit,
      vacancyLevels.high,
      vacancyLevels.low,
      vacancyLevels.medium,
    ],
  );

  return <div ref={containerRef} className={styles.map} />;
}
