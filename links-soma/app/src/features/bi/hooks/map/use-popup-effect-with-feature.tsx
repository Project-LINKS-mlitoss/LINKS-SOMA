import { type Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  type GetFeatureById,
  type GetFeatureByReferenceDate,
} from "./use-feature-fetcher";
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
  getFeatureByReferenceDate,
  selectedDate,
  oldestReferenceDate,
  domainMax,
}: {
  mapInstance: MapLibreMap | null;
  view: MapWithTableView;
  /** IDでフィーチャーを取得する関数（遅延読み込み用） */
  getFeatureById: GetFeatureById;
  /** 別の推定基準日で同一対象を取得する関数 */
  getFeatureByReferenceDate: GetFeatureByReferenceDate;
  /** 現在選択中の推定基準日。切り替え時にポップアップを引き直す */
  selectedDate: string | undefined;
  /** 対象結果の最古推定基準日。最古年度は変化行を出さないための判定に使う */
  oldestReferenceDate: string | undefined;
  /** スライダー目盛り上限。area ポップアップ色を地図と一致させるのに使う */
  domainMax: number;
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

  // 推定基準日を切り替えたら、開いているポップアップを新しい推定日の同一対象へ
  // 引き直す。対象が新しい推定日に存在しなければ非表示（null）にする。
  // selectedFeature 自体は依存に入れず、推定日の変更時のみ発火させる（クリック直後の
  // 再取得ループを避ける）。最新の選択対象は ref から読む。
  const selectedFeatureRef = useRef(selectedFeature);
  selectedFeatureRef.current = selectedFeature;
  useEffect(() => {
    const current = selectedFeatureRef.current;
    if (!current) return;
    let cancelled = false;
    void getFeatureByReferenceDate(current, selectedDate).then((next) => {
      if (cancelled) return;
      setOverlapInfo(null);
      setSelectedFeatureState(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 推定日変更時のみ引き直す
  }, [selectedDate]);

  // ポップアップの表示制御
  useEffect(() => {
    if (!mapInstance || !selectedFeature) return;

    const coordinates = getLngLatFromGeometry(selectedFeature.geometry);
    const popupContent = renderToString(
      unit === "building" ? (
        <BuildingPopup
          isOldestReferenceDate={
            !!oldestReferenceDate &&
            (selectedFeature.properties as BuildingProperties)
              .reference_date === oldestReferenceDate
          }
          overlapInfo={overlapInfo ?? undefined}
          properties={selectedFeature.properties as BuildingProperties}
        />
      ) : (
        <AreaPopup
          domainMax={domainMax}
          properties={selectedFeature.properties as AreaProperties}
        />
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
    domainMax,
    oldestReferenceDate,
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
