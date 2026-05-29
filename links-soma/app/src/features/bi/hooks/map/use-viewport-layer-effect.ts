import { type Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { type MapWithTableView } from "../../types/models/view";

import { addLayerEffect } from "../../components/views/map/map-container/_components/add-layer-effect";
import { ViewportLoader } from "../../util/map/viewport-loader";
import {
  type BufferedViewport,
  createBufferedViewport,
  getViewportBounds,
  shouldRefetchData,
} from "../../util/map/viewport-utils";
import {
  LAYER_SUFFIXES,
  MAP_EVENTS,
  POLYGON_RENDER_MIN_ZOOM,
} from "../../components/views/map/map-container/const";
import { isFilterCondition } from "../../types/models/parameter";
import { type FeatureData } from "../../types";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import { extractThresholdFromParameters } from "../../util/threshold-column-utils";
import { useFeatureFetcher } from "./use-feature-fetcher";

/** フェードアウトアニメーションの時間（ミリ秒） */
const FADE_OUT_DURATION_MS = 300;

/** デバウンス時間（ミリ秒、unit別） */
const DEBOUNCE_MS: Record<"building" | "area", number> = {
  area: 300,
  building: 500,
};

/**
 * MapLibreからレイヤーとソースを即座に削除するヘルパー関数
 * レイヤーIDに対して、ベースID、-points、-polygons、重複レイヤーを全て削除する
 */
const removeLayerAndSourceImmediate = (
  map: MapLibreMap,
  baseLayerId: string,
): void => {
  const pointLayerId = `${baseLayerId}${LAYER_SUFFIXES.POINTS}`;
  const polygonLayerId = `${baseLayerId}${LAYER_SUFFIXES.POLYGONS}`;
  const overlapOutlineLayerId = `${polygonLayerId}${LAYER_SUFFIXES.OVERLAP}-outline`;
  const overlapPointLayerId = `${pointLayerId}${LAYER_SUFFIXES.OVERLAP}-outline`;

  [
    baseLayerId,
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
    } catch (error) {
      rendererLogger.warn(`Layer/source removal failed for ${id}`, error);
    }
  });
};

/**
 * レイヤーのopacityを徐々に下げてフェードアウトさせる
 * @param map MapLibreインスタンス
 * @param layerId レイヤーID
 * @param duration フェードアウト時間（ミリ秒）
 * @returns フェードアウト完了後にresolveするPromise
 */
const fadeOutLayer = (
  map: MapLibreMap,
  layerId: string,
  duration: number,
): Promise<void> => {
  return new Promise((resolve) => {
    const pointLayerId = `${layerId}${LAYER_SUFFIXES.POINTS}`;
    const polygonLayerId = `${layerId}${LAYER_SUFFIXES.POLYGONS}`;

    const layerIds = [layerId, pointLayerId, polygonLayerId].filter((id) => {
      try {
        return map.getLayer(id) !== undefined;
      } catch {
        return false;
      }
    });

    if (layerIds.length === 0) {
      resolve();
      return;
    }

    const steps = 10;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const animateStep = (): void => {
      currentStep++;
      const opacity = 1 - currentStep / steps;

      layerIds.forEach((id) => {
        try {
          const layer = map.getLayer(id);
          if (layer) {
            const layerType = layer.type;
            if (layerType === "fill") {
              map.setPaintProperty(id, "fill-opacity", opacity * 0.6);
            } else if (layerType === "line") {
              map.setPaintProperty(id, "line-opacity", opacity);
            } else if (layerType === "circle") {
              map.setPaintProperty(id, "circle-opacity", opacity);
            }
          }
        } catch (error) {
          rendererLogger.warn(`Failed to set opacity for layer ${id}`, error);
        }
      });

      if (currentStep < steps) {
        setTimeout(animateStep, stepDuration);
      } else {
        resolve();
      }
    };

    animateStep();
  });
};

/**
 * MapLibreからレイヤーとソースを削除するヘルパー関数
 * 地域データの場合はフェードアウトアニメーション付きで削除
 * @param map MapLibreインスタンス
 * @param baseLayerId レイヤーID
 * @param unit 単位（building/area）
 * @param immediate 即座に削除するかどうか（デフォルト: false）
 */
const removeLayerAndSource = (
  map: MapLibreMap,
  baseLayerId: string,
  unit: "building" | "area" = "building",
  immediate = false,
): void => {
  // 建物の場合、または即座削除フラグがある場合は即座に削除
  if (unit === "building" || immediate) {
    removeLayerAndSourceImmediate(map, baseLayerId);
    return;
  }

  // 地域の場合はフェードアウトしてから削除
  void fadeOutLayer(map, baseLayerId, FADE_OUT_DURATION_MS).then(() => {
    removeLayerAndSourceImmediate(map, baseLayerId);
  });
};

type Props = {
  mapInstance: MapLibreMap | null;
  selectedDate: string | undefined;
  view: MapWithTableView;
  setSelectedFeature: (feature: FeatureData | null) => void;
};

export type ViewportLayerEffectReturn = {
  layerIds: string[] | null;
  progress: number;
  viewportStats: {
    recordCount: number;
    viewportArea: number;
    filteredCount: number;
  } | null;
  /** ズームレベルが低すぎて描画をスキップしているかどうか */
  isZoomTooLow: boolean;
  /** 描画に必要な最小ズームレベル */
  minZoomRequired: number;
};

/**
 * ビューポートベースでデータを取得し、レイヤを追加するエフェクト
 * 地図の移動・ズーム時に動的にデータを更新する
 */
export const useViewportLayerEffect = ({
  mapInstance,
  selectedDate,
  view,
  setSelectedFeature,
}: Props): ViewportLayerEffectReturn => {
  const [layerIds, setLayerIds] = useState<string[] | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [viewportStats, setViewportStats] =
    useState<ViewportLayerEffectReturn["viewportStats"]>(null);
  const [isZoomTooLow, setIsZoomTooLow] = useState<boolean>(false);

  const minZoomRequired = POLYGON_RENDER_MIN_ZOOM[view.unit];

  // フィーチャー取得用のフック
  const { getFeatureById } = useFeatureFetcher({ unit: view.unit });

  /** ビューパラメータから閾値を抽出（地図の色分けに使用） */
  const threshold = useMemo(
    () => extractThresholdFromParameters(view.parameters),
    [view.parameters],
  );

  /** レイヤークリーンアップ関数の管理 */
  const layerCleanupFunctions = useRef<Map<string, () => void>>(
    new Map<string, () => void>(),
  );

  /** デバウンス用のタイマー */
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  /** 現在のローダー */
  const currentLoader = useRef<ViewportLoader | null>(null);

  /** キャッシュされたビューポート（データ取得済みの領域） */
  const cachedViewportRef = useRef<BufferedViewport | null>(null);

  /** 前回のズームレベル */
  const lastZoomRef = useRef<number | null>(null);

  /** ビューポートベースでレイヤーを更新する関数 */
  const updateLayersForViewport = useCallback(
    async (_forceUpdate = false): Promise<void> => {
      if (!mapInstance || !selectedDate) {
        return;
      }

      // ズームレベルをチェック
      const currentZoom = mapInstance.getZoom();
      const isZoomBelowThreshold = currentZoom < minZoomRequired;
      setIsZoomTooLow(isZoomBelowThreshold);

      // 既存のローダーを停止
      if (currentLoader.current) {
        currentLoader.current.stop();
      }

      const viewport = getViewportBounds(mapInstance);
      const viewportArea =
        (viewport.maxLng - viewport.minLng) *
        (viewport.maxLat - viewport.minLat);

      // クリーンアップ関数内で使用するためにrefを変数にコピー
      const cleanupFunctionsRef = layerCleanupFunctions.current;

      // ズームレベルが低すぎる場合は既存レイヤーをクリアして終了
      if (isZoomBelowThreshold) {
        // 既存のレイヤーをクリア（ズーム変更時は即座に削除）
        setLayerIds((prevLayerIds) => {
          prevLayerIds?.forEach((layerId) => {
            removeLayerAndSource(mapInstance, layerId, view.unit, true);
          });
          return null;
        });
        cleanupFunctionsRef.clear();
        setViewportStats(null);
        setProgress(0);
        return;
      }

      const loader = new ViewportLoader();
      currentLoader.current = loader;

      try {
        const areaFilter = view.parameters.find((p) => p.key === "area");
        const areas = areaFilter?.value;

        const filterConditions = view.parameters.filter((p) =>
          isFilterCondition(p),
        );

        await loader.initWithViewport(
          {
            referenceDate: selectedDate,
            dataSetResultId: view.dataSetResultId,
            areas,
            filterConditions,
            unit: view.unit,
          },
          viewport,
        );

        const stats = loader.getStats();

        setViewportStats({
          recordCount: stats.viewportRecordCount,
          viewportArea,
          filteredCount: stats.filteredCount,
        });

        // 既存のレイヤーをフェードアウトしてクリア（地域の場合はアニメーション付き）
        setLayerIds((prevLayerIds) => {
          prevLayerIds?.forEach((layerId) => {
            removeLayerAndSource(mapInstance, layerId, view.unit);
          });
          return null;
        });
        cleanupFunctionsRef.clear();

        await loader.loadFeatures({
          process: (params) => {
            const { processedCount, chunk, chunkLastId, viewportRecordCount } =
              params;
            const layerId = `${view.unit}-viewport-${chunkLastId.toString()}-${Date.now()}`;

            // 返却する値の更新
            setLayerIds((prev) => (prev ? [...prev, layerId] : [layerId]));
            setProgress(
              viewportRecordCount
                ? Math.round((processedCount / viewportRecordCount) * 100)
                : 0,
            );

            // addLayerEffectからクリーンアップ関数を取得して保存
            const cleanupFunction = addLayerEffect({
              map: mapInstance,
              layerId,
              features: chunk,
              setSelectedFeature,
              unit: view.unit,
              getFeatureById,
              threshold,
            });

            cleanupFunctionsRef.set(layerId, cleanupFunction);

            // チャンクデータを即座にクリア（メモリリーク防止）
            setTimeout(() => {
              chunk.length = 0;
            }, 0);
          },
        });

        // データ取得成功後、キャッシュされたビューポートを更新
        cachedViewportRef.current = createBufferedViewport(viewport);
        lastZoomRef.current = currentZoom;
      } catch (error) {
        rendererLogger.error("Failed to load viewport features", error);
      }
    },
    [
      mapInstance,
      minZoomRequired,
      selectedDate,
      setSelectedFeature,
      threshold,
      view.dataSetResultId,
      view.parameters,
      view.unit,
      getFeatureById,
    ],
  );

  /** ビューポートベースでレイヤーを更新する関数（安定化） */
  const updateLayersForViewportStable = useCallback(async (): Promise<void> => {
    await updateLayersForViewport();
  }, [updateLayersForViewport]);

  /** レイヤーを即座にクリアする関数 */
  const clearLayersImmediately = useCallback((): void => {
    if (!mapInstance) return;

    const cleanupFunctionsRef = layerCleanupFunctions.current;

    // 既存のローダーを停止
    if (currentLoader.current) {
      currentLoader.current.stop();
    }

    // イベントリスナーのクリーンアップ
    cleanupFunctionsRef.forEach((cleanup: () => void) => {
      try {
        cleanup();
      } catch (error) {
        rendererLogger.warn("Cleanup failed during immediate clear", error);
      }
    });
    cleanupFunctionsRef.clear();

    // レイヤーとソースの削除（即座に削除）
    setLayerIds((prevLayerIds) => {
      prevLayerIds?.forEach((layerId) => {
        removeLayerAndSource(mapInstance, layerId, view.unit, true);
      });
      return null;
    });

    // キャッシュをクリア
    cachedViewportRef.current = null;
    lastZoomRef.current = null;

    setViewportStats(null);
    setProgress(0);
  }, [mapInstance, view.unit]);

  /** 地図移動時のデバウンス処理 */
  const handleMapMove = useCallback((): void => {
    if (!mapInstance) return;

    // ズームレベルを即座にチェック
    const currentZoom = mapInstance.getZoom();
    const isZoomBelowThreshold = currentZoom < minZoomRequired;
    setIsZoomTooLow(isZoomBelowThreshold);

    // しきい値未満の場合は即座にレイヤーをクリア（キャッシュもクリアされる）
    if (isZoomBelowThreshold) {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      clearLayersImmediately();
      return;
    }

    // キャッシュがある場合、再取得が必要かチェック
    if (cachedViewportRef.current && lastZoomRef.current !== null) {
      const currentViewport = getViewportBounds(mapInstance);
      const isZoomingIn = currentZoom > lastZoomRef.current;
      const isWithinCachedArea = !shouldRefetchData(
        currentViewport,
        cachedViewportRef.current,
      );

      // ズームイン かつ キャッシュ領域内の場合は再取得をスキップ
      if (isZoomingIn && isWithinCachedArea) {
        // ズームレベルは更新
        lastZoomRef.current = currentZoom;
        return;
      }

      // キャッシュ領域内でズームレベルが同じ（パンのみ）の場合もスキップ
      if (
        isWithinCachedArea &&
        Math.abs(currentZoom - lastZoomRef.current) < 0.1
      ) {
        return;
      }
    }

    // 通常のデバウンス処理
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      void updateLayersForViewportStable();
    }, DEBOUNCE_MS[view.unit]);
  }, [
    clearLayersImmediately,
    mapInstance,
    minZoomRequired,
    updateLayersForViewportStable,
    view.unit,
  ]);

  /** メインエフェクト：地図イベントリスナーの設定 */
  useEffect(() => {
    if (!mapInstance || !selectedDate) return;

    // クリーンアップ用の参照をコピー
    const cleanupFunctionsRef = layerCleanupFunctions.current;

    // 初回読み込み
    void updateLayersForViewport(true);

    // 地図移動イベントリスナーを設定
    mapInstance.on("moveend", handleMapMove);
    mapInstance.on("zoomend", handleMapMove);

    return () => {
      // デバウンスタイマーをクリア
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      // ローダーを停止
      if (currentLoader.current) {
        currentLoader.current.stop();
      }

      // イベントリスナーを削除
      mapInstance.off("moveend", handleMapMove);
      mapInstance.off("zoomend", handleMapMove);

      try {
        mapInstance.fire(MAP_EVENTS.CLOSE_ALL_POPUPS);
      } catch (error) {
        rendererLogger.warn("Failed to close popups", error);
      }

      // イベントリスナーのクリーンアップを優先実行
      cleanupFunctionsRef.forEach((cleanup: () => void, layerId: string) => {
        try {
          cleanup();
        } catch (error) {
          rendererLogger.warn(`Cleanup failed for layer ${layerId}`, error);
        }
      });
      cleanupFunctionsRef.clear();

      // レイヤーとソースの削除（クリーンアップ時は即座に削除）
      setLayerIds((prevLayerIds) => {
        prevLayerIds?.forEach((layerId) => {
          removeLayerAndSource(mapInstance, layerId, view.unit, true);
        });
        return null;
      });

      setViewportStats(null);
    };
  }, [
    handleMapMove,
    mapInstance,
    selectedDate,
    updateLayersForViewport,
    updateLayersForViewportStable,
    view.unit,
  ]);

  return {
    layerIds,
    progress,
    viewportStats,
    isZoomTooLow,
    minZoomRequired,
  };
};
