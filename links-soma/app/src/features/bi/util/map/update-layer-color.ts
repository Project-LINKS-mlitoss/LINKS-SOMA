import { type Map as MapLibreMap } from "maplibre-gl";
import { LAYER_SUFFIXES } from "../../components/views/map/map-container/const";
import {
  createColorExpressionForMetric,
  createOutlineColorForMetric,
  type MapColorMetric,
} from "./layer-styles";

/**
 * 既存レイヤーの色式だけを差し替える。
 *
 * 色分け指標の切り替えで変わるのは paint の色式のみで、ソースの feature は変わらない。
 * レイヤーを作り直すとビューポート全件の再取得が走り、地図が一度空になって数秒〜数十秒
 * 待たされるため、描画済みのレイヤーには setPaintProperty を当てる。
 *
 * 対象レイヤーが未生成のタイミングでは何もしない（生成時に正しい色式が入る）。
 */
export const updateLayerColor = (
  map: MapLibreMap,
  layerId: string,
  params: {
    colorPropertyName: string;
    colorMetric: MapColorMetric;
    probabilityStops: { medium: number; high: number };
  },
): void => {
  const { colorPropertyName, colorMetric, probabilityStops } = params;
  const fillColor = createColorExpressionForMetric(
    colorMetric,
    colorPropertyName,
    probabilityStops,
  );
  const outlineColor = createOutlineColorForMetric(
    colorMetric,
    colorPropertyName,
    probabilityStops,
  );

  const polygonLayerId = `${layerId}${LAYER_SUFFIXES.POLYGONS}`;
  if (map.getLayer(polygonLayerId)) {
    map.setPaintProperty(polygonLayerId, "fill-color", fillColor);
    map.setPaintProperty(polygonLayerId, "fill-outline-color", outlineColor);
  }

  const pointLayerId = `${layerId}${LAYER_SUFFIXES.POINTS}`;
  if (map.getLayer(pointLayerId)) {
    map.setPaintProperty(pointLayerId, "circle-color", fillColor);
  }
};
