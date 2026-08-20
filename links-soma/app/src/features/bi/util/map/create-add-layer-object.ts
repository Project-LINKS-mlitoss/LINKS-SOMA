import { type AddLayerObject, type FilterSpecification } from "maplibre-gl";
import { LAYER_SUFFIXES } from "../../components/views/map/map-container/const";
import {
  LAYER_COLORS,
  createColorExpressionForMetric,
  createClickedStateExpression,
  type MapColorMetric,
} from "./layer-styles";

/**
 * ポイントレイヤーオブジェクトを作成
 * @param layerId レイヤーID
 * @param predictedProbability 色分けのしきい値
 * @param colorPropertyName 色分けに使用するプロパティ名（デフォルト: predicted_probability）
 * @param colorMetric 色分けが表す指標（確率／変化率）
 */
export const createAddPointLayerObject = (
  layerId: string,
  predictedProbability: { medium: number; high: number },
  colorPropertyName = "predicted_probability",
  colorMetric: MapColorMetric = "probability",
): AddLayerObject => ({
  id: `${layerId}${LAYER_SUFFIXES.POINTS}`,
  type: "circle",
  source: `${layerId}${LAYER_SUFFIXES.POINTS}`,
  maxzoom: 22,
  minzoom: 8,
  paint: {
    "circle-color": createColorExpressionForMetric(
      colorMetric,
      colorPropertyName,
      predictedProbability,
    ),
    "circle-radius": createClickedStateExpression(10, 6),
    "circle-opacity": createClickedStateExpression(1.0, 0.8),
    "circle-stroke-width": 2,
    "circle-stroke-color": LAYER_COLORS.WHITE,
  },
});

/**
 * 重複ポイント用の強調レイヤーオブジェクトを作成
 * 通常のポイントレイヤーの下に配置し、グレーの外輪で重複を表現
 *
 * @param layerId ベースレイヤーID
 */
export const createOverlapPointLayerObject = (
  layerId: string,
): AddLayerObject => ({
  id: `${layerId}${LAYER_SUFFIXES.POINTS}${LAYER_SUFFIXES.OVERLAP}-outline`,
  type: "circle",
  source: `${layerId}${LAYER_SUFFIXES.POINTS}`,
  maxzoom: 22,
  minzoom: 8,
  filter: ["==", ["get", "hasOverlap"], true] as FilterSpecification,
  paint: {
    "circle-radius": createClickedStateExpression(12, 8), // 通常より少し大きい半径
    "circle-color": "transparent",
    "circle-stroke-width": 1.5,
    "circle-stroke-color": LAYER_COLORS.OVERLAP_OUTLINE,
  },
});
