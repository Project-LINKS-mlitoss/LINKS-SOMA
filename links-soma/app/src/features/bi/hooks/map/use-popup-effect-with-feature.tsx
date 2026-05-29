import { type Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useState } from "react";
import { renderToString } from "react-dom/server";
import {
  AreaPopup,
  type AreaProperties,
} from "../../components/views/map/map-container/_components/area-popup";
import {
  BuildingPopup,
  type BuildingProperties,
} from "../../components/views/map/map-container/_components/building-popup";
import { OVERLAP_NAVIGATION } from "../../components/views/map/map-container/const";
import type { FeatureData } from "../../types";
import type { MapWithTableView } from "../../types/models/view";
import { getLngLatFromGeometry } from "../../util/map/get-lng-lat-from-geometry";
import { type GetFeatureById } from "./use-feature-fetcher";
import {
  type NavigateOverlap,
  type OverlapInfo,
  useOverlapNavigation,
} from "./use-overlap-navigation";
import { usePopupCamera } from "./use-popup-camera";
import { usePopupLifecycle } from "./use-popup-lifecycle";

// 型のre-export
export type { NavigateOverlap, OverlapInfo };

export type SetSelectedFeatureOptions = {
  /** trueの場合、選択したフィーチャーにカメラを移動する（デフォルト: true） */
  flyTo?: boolean;
  /** 重複レコード情報（重複がある場合に設定） */
  overlapInfo?: OverlapInfo;
};

export type SetSelectedFeature = (
  feature: FeatureData | null,
  options?: SetSelectedFeatureOptions,
) => void;

export type UsePopupEffectWithFeatureReturn = {
  selectedFeature: FeatureData | null;
  setSelectedFeature: SetSelectedFeature;
  clearPopup: () => void;
  /** 現在の重複情報（重複がある場合に設定） */
  overlapInfo: OverlapInfo | null;
  /** 重複レコードをナビゲートする関数 */
  navigateOverlap: NavigateOverlap;
};

/**
 * ポップアップの制御に関するエフェクト
 *
 * 以下のフックを合成:
 * - useOverlapNavigation: 重複レコードのナビゲーション状態管理
 * - usePopupLifecycle: ポップアップの生成・破棄・イベント管理
 * - usePopupCamera: カメラ制御（flyTo）
 */
export const usePopupEffectWithFeature = ({
  mapInstance,
  view: { unit, parameters },
  getFeatureById,
}: {
  mapInstance: MapLibreMap | null;
  view: MapWithTableView;
  /** IDでフィーチャーを取得する関数（遅延読み込み用） */
  getFeatureById: GetFeatureById;
}): UsePopupEffectWithFeatureReturn => {
  const [selectedFeature, setSelectedFeatureState] =
    useState<FeatureData | null>(null);

  // カメラ制御フック
  const { flyToFeature, skipNextFlyTo, shouldSkipFlyTo } = usePopupCamera({
    mapInstance,
    unit,
  });

  // 重複ナビゲーションフック
  const { overlapInfo, setOverlapInfo, navigateOverlap, navigateOverlapRef } =
    useOverlapNavigation({
      getFeatureById,
      onNavigate: (feature, _newOverlapInfo) => {
        // ナビゲーション時はカメラ移動しない
        skipNextFlyTo();
        setSelectedFeatureState(feature);
      },
    });

  // ポップアップライフサイクルフック
  const {
    showPopup,
    clearPopup,
    setupToggleListener,
    setupNavigationListeners,
  } = usePopupLifecycle({ mapInstance });

  // オプション付きのsetSelectedFeature関数
  const setSelectedFeature: SetSelectedFeature = useCallback(
    (feature, options) => {
      // flyToオプションがfalseの場合はスキップ
      if (options?.flyTo === false) {
        skipNextFlyTo();
      }
      // 重複情報を保存
      setOverlapInfo(options?.overlapInfo ?? null);
      setSelectedFeatureState(feature);
    },
    [setOverlapInfo, skipNextFlyTo],
  );

  // 設定変更時に状態をクリア
  useEffect(() => {
    setSelectedFeatureState(null);
    setOverlapInfo(null);
  }, [unit, parameters, setOverlapInfo]);

  // ポップアップの表示制御
  useEffect(() => {
    if (!mapInstance || !selectedFeature) return;

    const coordinates = getLngLatFromGeometry(selectedFeature.geometry);
    const popupContent = renderToString(
      unit === "building" ? (
        <BuildingPopup
          overlapInfo={overlapInfo ?? undefined}
          properties={selectedFeature.properties as BuildingProperties}
        />
      ) : (
        <AreaPopup properties={selectedFeature.properties as AreaProperties} />
      ),
    );

    // ポップアップを表示
    showPopup(popupContent, coordinates, {
      onOpen: (popup) => {
        // トグルボタンのリスナーを設定
        setupToggleListener(popup);

        // 重複ナビゲーションのリスナーを設定（建物単位のみ）
        if (unit === "building" && overlapInfo?.hasOverlap) {
          const maxIndex =
            Math.min(
              overlapInfo.totalCount,
              OVERLAP_NAVIGATION.MAX_NAVIGABLE_OVERLAPS,
            ) - 1;

          setupNavigationListeners(
            popup,
            (direction) => {
              navigateOverlapRef.current(direction).catch(() => {
                // エラーはnavigateOverlap内でログ記録済み
              });
            },
            overlapInfo.currentIndex,
            maxIndex,
          );
        }
      },
      onClose: () => {
        // ×ボタンで閉じた場合、React状態を同期
        setSelectedFeatureState(null);
        setOverlapInfo(null);
      },
    });

    // カメラを移動（スキップフラグが立っていなければ）
    if (!shouldSkipFlyTo()) {
      flyToFeature(coordinates);
    }

    return clearPopup;
  }, [
    mapInstance,
    selectedFeature,
    unit,
    overlapInfo,
    showPopup,
    clearPopup,
    setupToggleListener,
    setupNavigationListeners,
    navigateOverlapRef,
    setOverlapInfo,
    flyToFeature,
    shouldSkipFlyTo,
  ]);

  return {
    selectedFeature,
    setSelectedFeature,
    clearPopup,
    overlapInfo,
    navigateOverlap,
  };
};
