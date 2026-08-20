import "maplibre-gl/dist/maplibre-gl.css";
import "./maplibre-gl.css";
import { useEffect } from "react";
import { type FilterSpecification } from "maplibre-gl";
import { makeStyles } from "@fluentui/react-components";
import { type ProbabilityRange } from "../../../probability-range-slider/hooks";
import {
  type MapInitReturn,
  type ViewportLayerEffectReturn,
} from "../../../../../../hooks/map";
import { LAYER_SUFFIXES } from "../../const";

const useStyles = makeStyles({
  map: {
    width: "100%",
    height: "600px",
  },
});

type Props = {
  range: ProbabilityRange;
  /** スライダーの目盛り下限。端ぴったりは無制限扱いの判定に使う */
  domainMin: number;
  /** スライダーの目盛り上限（unit/データにより可変）。端ぴったりは無制限扱いの判定に使う */
  domainMax: number;
  /** 絞り込む対象のプロパティ名。色分けの基準と同じ量を絞る */
  filterProperty: string;
  mapInitState: MapInitReturn;
  viewportLayerEffectState?: ViewportLayerEffectReturn;
};

export function MapContainer({
  range,
  domainMin,
  domainMax,
  filterProperty,
  mapInitState: { containerRef, mapInstance },
  viewportLayerEffectState,
}: Props): JSX.Element {
  const styles = useStyles();

  const [min, max] = range;

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

      // 端（min=domainMin / max=domainMax）は無制限扱い。域外（area の 0.11 超、
      // 変化率の ±50% 超など）も全域では表示する
      const conditions = [];
      if (min > domainMin) {
        conditions.push([">=", ["get", filterProperty], min]);
      }
      if (max < domainMax) {
        conditions.push(["<=", ["get", filterProperty], max]);
      }
      const mapLibreFilter =
        conditions.length > 0
          ? (["all", ...conditions] as FilterSpecification)
          : null;

      for (const layerId of actualLayerIds) {
        if (!mapInstance.getLayer(layerId)) continue;
        mapInstance.setLayoutProperty(layerId, "visibility", "visible");
        mapInstance.setFilter(layerId, mapLibreFilter);
      }
    },
    [
      currentLayerIds,
      mapInstance,
      min,
      max,
      domainMin,
      domainMax,
      filterProperty,
    ],
  );

  return <div ref={containerRef} className={styles.map} />;
}
