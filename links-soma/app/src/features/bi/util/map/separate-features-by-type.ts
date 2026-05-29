import { type FeatureData } from "../../types";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";

/**
 * フィーチャーをジオメトリタイプ別に分離する関数
 */
export const separateFeaturesByType = (
  features: FeatureData[],
): { pointFeatures: FeatureData[]; polygonFeatures: FeatureData[] } => {
  // 入力検証
  if (!features || !Array.isArray(features)) {
    rendererLogger.warn("Invalid features input", undefined, {
      featuresType: typeof features,
      featuresLength: Array.isArray(features)
        ? (features as unknown[]).length
        : "not array",
      component: "separateFeaturesByType",
    });
    return { pointFeatures: [], polygonFeatures: [] };
  }

  try {
    const pointFeatures = features.filter((f) => {
      const isPoint = f?.geometry?.type === "Point";
      return isPoint;
    });

    const polygonFeatures = features.filter((f) => {
      const isPolygon =
        f?.geometry?.type === "Polygon" || f?.geometry?.type === "MultiPolygon";
      return isPolygon;
    });

    return { pointFeatures, polygonFeatures };
  } catch (error) {
    rendererLogger.error("Error during feature separation", error, {
      featuresCount: features.length,
      component: "separateFeaturesByType",
    });
    return { pointFeatures: [], polygonFeatures: [] };
  }
};
