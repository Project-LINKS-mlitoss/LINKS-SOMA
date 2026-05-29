import type * as maplibregl from "maplibre-gl";
import { rendererLogger } from "../../../../../../../shared/utils/renderer-logger";
import {
  LAYER_SUFFIXES,
  MAP_EVENTS,
  OVERLAP_NAVIGATION,
  PREDICTED_PROBABILITY,
} from "../const";
import { type FeatureData } from "../../../../../types";
import {
  type GetFeatureById,
  type SetSelectedFeature,
  type OverlapInfo,
} from "../../../../../hooks/map";
import {
  separateFeaturesByType,
  createAddPointLayerObject,
  createAddPolygonLayerObject,
  createOverlapOutlineLayerObject,
  createOverlapPointLayerObject,
  parseOverlapIds,
} from "../../../../../util/map";
import {
  type ThresholdValue,
  getAreaPredictedProbabilityColumn,
} from "../../../../../util/threshold-column-utils";

type Params = {
  map: maplibregl.Map;
  layerId: string;
  features: FeatureData[];
  setSelectedFeature: SetSelectedFeature;
  unit: "building" | "area";
  getFeatureById: GetFeatureById;
  /** 閾値設定（地域単位の色分けに使用） */
  threshold?: ThresholdValue;
};

/** イベントリスナーのクリーンアップ関数の型 */
type EventListenerCleanupFunction = () => void;

/**
 * クリックハンドラーを作成する
 * フィーチャーがクリックされたときにDBから完全なデータを取得する
 * マップ上でクリックした場合はカメラ移動しない（flyTo: false）
 *
 * 重複ポリゴン対応:
 * - クリック位置に複数のFeatureがある場合、重複情報を収集
 * - パフォーマンス対策として、初回は最大20件までDB取得
 * - 残りはナビゲーション時に遅延取得
 */
function createClickHandler(
  setSelectedFeature: SetSelectedFeature,
  getFeatureById: GetFeatureById,
  layerType: "polygon" | "point",
): (
  e: maplibregl.MapMouseEvent & {
    features?: maplibregl.MapGeoJSONFeature[] | undefined;
  },
) => void {
  return (e) => {
    if (e.features && e.features.length > 0) {
      const clickedFeature = e.features[0];
      const featureId = clickedFeature.properties?.id as number | undefined;

      // 重複レコード情報を取得（プロパティから）
      const hasOverlap = clickedFeature.properties?.hasOverlap === true;
      const overlapCount =
        (clickedFeature.properties?.overlapCount as number) || 1;
      const parsedOverlapIds = parseOverlapIds(
        clickedFeature.properties?.overlapIds as number[] | string | undefined,
        featureId,
      );

      if (featureId) {
        // 重複がある場合は、最大OVERLAP_NAVIGATION.INITIAL_FETCH_LIMIT件まで取得
        const idsToFetch = hasOverlap
          ? parsedOverlapIds.slice(0, OVERLAP_NAVIGATION.INITIAL_FETCH_LIMIT)
          : [featureId];

        Promise.all(idsToFetch.map((id) => getFeatureById(id)))
          .then((features) => {
            const validFeatures = features.filter(
              (f): f is FeatureData => f !== null,
            );

            if (validFeatures.length > 0) {
              // 重複情報を構築
              const overlapInfo: OverlapInfo | undefined = hasOverlap
                ? {
                    hasOverlap: true,
                    totalCount: overlapCount,
                    allIds: parsedOverlapIds,
                    fetchedFeatures: validFeatures,
                    currentIndex: 0,
                  }
                : undefined;

              // マップクリック時はカメラ移動しない
              setSelectedFeature(validFeatures[0], {
                flyTo: false,
                overlapInfo,
              });
            } else {
              // フォールバック：最小限のデータを使用
              setSelectedFeature(clickedFeature as unknown as FeatureData, {
                flyTo: false,
              });
            }
          })
          .catch((error: unknown) => {
            rendererLogger.error("Failed to fetch feature details", error, {
              featureId,
              layerType,
              overlapCount,
              component: "addLayerEffect",
            });
            // エラー時はクリックしたフィーチャーをそのまま使用
            setSelectedFeature(clickedFeature as unknown as FeatureData, {
              flyTo: false,
            });
          });
      } else {
        // IDがない場合はそのまま使用
        setSelectedFeature(clickedFeature as unknown as FeatureData, {
          flyTo: false,
        });
      }
    }
  };
}

/**
 * 地図にレイヤーを追加し、イベントリスナーを設定する
 *
 * @returns イベントリスナーのクリーンアップ関数
 *          （レイヤー・ソースの削除はuse-viewport-layer-effect.tsが担当）
 */
export function addLayerEffect({
  map,
  layerId,
  features,
  setSelectedFeature,
  unit,
  getFeatureById,
  threshold,
}: Params): EventListenerCleanupFunction {
  try {
    // 既存のPOINT、POLYGON、重複レイヤーをクリーンアップ（防御的コード）
    const pointLayerId = `${layerId}${LAYER_SUFFIXES.POINTS}`;
    const polygonLayerId = `${layerId}${LAYER_SUFFIXES.POLYGONS}`;
    const overlapOutlineLayerId = `${polygonLayerId}${LAYER_SUFFIXES.OVERLAP}-outline`;
    const overlapPointLayerId = `${pointLayerId}${LAYER_SUFFIXES.OVERLAP}-outline`;

    [
      layerId,
      pointLayerId,
      polygonLayerId,
      overlapOutlineLayerId,
      overlapPointLayerId,
    ].forEach((id) => {
      try {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
        if (map.getSource(id)) {
          map.removeSource(id);
        }
      } catch (removeError) {
        rendererLogger.warn(
          `Failed to remove layer/source ${id}`,
          removeError,
          {
            layerId: id,
            component: "addLayerEffect",
          },
        );
      }
    });

    // 入力検証
    if (!features || features.length === 0) {
      rendererLogger.warn("No features provided", undefined, {
        layerId,
        component: "addLayerEffect",
      });
      return () => {
        // 空のクリーンアップ関数
      };
    }

    // フィーチャーをタイプ別に分離
    const { pointFeatures, polygonFeatures } = separateFeaturesByType(features);

    const { medium, high } = PREDICTED_PROBABILITY[unit];
    const cleanupFunctions: (() => void)[] = [];

    // 閾値に基づく色分けプロパティ名の決定
    // 地域単位で閾値が設定されている場合は predicted_probability_XX を使用
    const colorPropertyName =
      unit === "area" && threshold !== undefined
        ? getAreaPredictedProbabilityColumn(threshold)
        : "predicted_probability";

    // POLYGONレイヤーの追加
    if (polygonFeatures.length > 0) {
      map.addSource(polygonLayerId, {
        type: "geojson",
        generateId: true,
        data: {
          type: "FeatureCollection",
          features: polygonFeatures,
        },
      });

      const polygonLayerObject = createAddPolygonLayerObject(
        layerId,
        { medium, high },
        colorPropertyName,
        unit,
      );
      map.addLayer(polygonLayerObject);

      // 建物単位の場合、重複ポリゴンの境界線強調レイヤーを追加
      if (unit === "building") {
        const overlapOutlineLayer = createOverlapOutlineLayerObject(layerId);
        map.addLayer(overlapOutlineLayer);
      }

      const onPolygonClickHandler = createClickHandler(
        setSelectedFeature,
        getFeatureById,
        "polygon",
      );

      const onPolygonMouseEnterHandler = (): void => {
        map.getCanvas().style.cursor = "pointer";
      };

      const onPolygonMouseLeaveHandler = (): void => {
        map.getCanvas().style.cursor = "";
      };

      map.on(MAP_EVENTS.CLICK, polygonLayerId, onPolygonClickHandler);
      map.on(
        MAP_EVENTS.MOUSE_ENTER,
        polygonLayerId,
        onPolygonMouseEnterHandler,
      );
      map.on(
        MAP_EVENTS.MOUSE_LEAVE,
        polygonLayerId,
        onPolygonMouseLeaveHandler,
      );

      cleanupFunctions.push(() => {
        try {
          map.off(MAP_EVENTS.CLICK, polygonLayerId, onPolygonClickHandler);
          map.off(
            MAP_EVENTS.MOUSE_ENTER,
            polygonLayerId,
            onPolygonMouseEnterHandler,
          );
          map.off(
            MAP_EVENTS.MOUSE_LEAVE,
            polygonLayerId,
            onPolygonMouseLeaveHandler,
          );
        } catch (error) {
          rendererLogger.warn(
            `Polygon event listener cleanup failed for layer ${polygonLayerId}`,
            error,
            {
              layerId: polygonLayerId,
              component: "addLayerEffect",
            },
          );
        }
      });
    }

    // POINTレイヤーの追加
    if (pointFeatures.length > 0) {
      map.addSource(pointLayerId, {
        type: "geojson",
        generateId: true,
        data: {
          type: "FeatureCollection",
          features: pointFeatures,
        },
      });

      // 建物単位の場合、重複ポイントの外輪強調レイヤーを先に追加（下に配置）
      if (unit === "building") {
        const overlapPointLayer = createOverlapPointLayerObject(layerId);
        map.addLayer(overlapPointLayer);
      }

      const pointLayerObject = createAddPointLayerObject(
        layerId,
        { medium, high },
        colorPropertyName,
      );
      map.addLayer(pointLayerObject);

      const onPointClickHandler = createClickHandler(
        setSelectedFeature,
        getFeatureById,
        "point",
      );

      const onPointMouseEnterHandler = (): void => {
        map.getCanvas().style.cursor = "pointer";
      };

      const onPointMouseLeaveHandler = (): void => {
        map.getCanvas().style.cursor = "";
      };

      map.on(MAP_EVENTS.CLICK, pointLayerId, onPointClickHandler);
      map.on(MAP_EVENTS.MOUSE_ENTER, pointLayerId, onPointMouseEnterHandler);
      map.on(MAP_EVENTS.MOUSE_LEAVE, pointLayerId, onPointMouseLeaveHandler);

      cleanupFunctions.push(() => {
        try {
          map.off(MAP_EVENTS.CLICK, pointLayerId, onPointClickHandler);
          map.off(
            MAP_EVENTS.MOUSE_ENTER,
            pointLayerId,
            onPointMouseEnterHandler,
          );
          map.off(
            MAP_EVENTS.MOUSE_LEAVE,
            pointLayerId,
            onPointMouseLeaveHandler,
          );
        } catch (error) {
          rendererLogger.warn(
            `Point event listener cleanup failed for layer ${pointLayerId}`,
            error,
            {
              layerId: pointLayerId,
              component: "addLayerEffect",
            },
          );
        }
      });
    }

    // メモリリーク防止: フィーチャーデータを即座にクリア
    setTimeout(() => {
      try {
        features.length = 0;
        pointFeatures.length = 0;
        polygonFeatures.length = 0;
      } catch (memoryCleanupError) {
        rendererLogger.warn("Memory cleanup failed", memoryCleanupError, {
          layerId,
          component: "addLayerEffect",
        });
      }
    }, 100);

    /**
     * イベントリスナーのクリーンアップ関数
     * 注意: この関数はイベントリスナー（click, mouseenter, mouseleave）の解除のみを行う
     * レイヤー・ソースの削除は use-viewport-layer-effect.ts の removeLayerAndSourceImmediate が担当
     */
    const cleanupEventListeners = (): void => {
      try {
        cleanupFunctions.forEach((cleanupFn) => cleanupFn());
      } catch (cleanupError) {
        rendererLogger.error("Event listener cleanup failed", cleanupError, {
          layerId,
          component: "addLayerEffect",
        });
      }
    };

    return cleanupEventListeners;
  } catch (error) {
    // 全体のエラーハンドリング
    rendererLogger.error("addLayerEffect failed", error, {
      layerId,
      featuresCount: features?.length || 0,
      component: "addLayerEffect",
    });

    // エラー時は空のクリーンアップ関数を返す
    return () => {
      // エラー時のクリーンアップ関数
    };
  }
}
