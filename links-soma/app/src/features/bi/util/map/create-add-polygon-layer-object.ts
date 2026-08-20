import { type AddLayerObject, type FilterSpecification } from "maplibre-gl";
import { LAYER_SUFFIXES } from "../../components/views/map/map-container/const";
import {
  LAYER_COLORS,
  createColorExpressionForMetric,
  createOutlineColorForMetric,
  createClickedStateExpression,
  type MapColorMetric,
} from "./layer-styles";

/**
 * ポリゴンレイヤーオブジェクトを作成
 * @param layerId レイヤーID
 * @param predictedProbability 色分けのしきい値
 * @param colorPropertyName 色分けに使用するプロパティ名（デフォルト: predicted_probability）
 * @param unit 表示単位（building/area）- 建物は透過なし、地域は透過あり
 * @param colorMetric 色分けが表す指標（確率／変化率）
 */
export const createAddPolygonLayerObject = (
  layerId: string,
  predictedProbability: { medium: number; high: number },
  colorPropertyName = "predicted_probability",
  unit: "building" | "area" = "building",
  colorMetric: MapColorMetric = "probability",
): AddLayerObject => ({
  id: `${layerId}${LAYER_SUFFIXES.POLYGONS}`,
  type: "fill",
  source: `${layerId}${LAYER_SUFFIXES.POLYGONS}`,
  maxzoom: 22,
  minzoom: 8,
  paint: {
    "fill-color": createColorExpressionForMetric(
      colorMetric,
      colorPropertyName,
      predictedProbability,
    ),
    // 建物: 透過なし（濃淡問題対策）、地域: 透過あり（通常時0.4、クリック時0.8）
    "fill-opacity":
      unit === "building"
        ? createClickedStateExpression(1.0, 1.0)
        : createClickedStateExpression(0.8, 0.4),
    "fill-outline-color": createOutlineColorForMetric(
      colorMetric,
      colorPropertyName,
      predictedProbability,
    ),
  },
});

/**
 * 重複ポリゴン用の境界線強調レイヤーオブジェクトを作成
 *
 * @param layerId ベースレイヤーID
 */
export const createOverlapOutlineLayerObject = (
  layerId: string,
): AddLayerObject => ({
  id: `${layerId}${LAYER_SUFFIXES.POLYGONS}${LAYER_SUFFIXES.OVERLAP}-outline`,
  type: "line",
  source: `${layerId}${LAYER_SUFFIXES.POLYGONS}`,
  maxzoom: 22,
  minzoom: 8,
  filter: ["==", ["get", "hasOverlap"], true] as FilterSpecification,
  paint: {
    "line-color": LAYER_COLORS.OVERLAP_OUTLINE,
    "line-width": 1.5,
  },
});
