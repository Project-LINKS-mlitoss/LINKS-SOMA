import { useCallback, useRef, useState } from "react";
import { rendererLogger } from "../../../../shared/utils/renderer-logger";
import { OVERLAP_NAVIGATION } from "../../components/views/map/map-container/const";
import type { FeatureData } from "../../types";
import { type GetFeatureById } from "./use-feature-fetcher";

/**
 * 重複レコード情報
 * 同一ジオメトリに複数のレコードが存在する場合の情報
 */
export type OverlapInfo = {
  /** 重複フラグ */
  hasOverlap: boolean;
  /** 重複レコードの総数 */
  totalCount: number;
  /** 全重複レコードのID一覧 */
  allIds: number[];
  /** 取得済みのFeature配列（遅延読み込み対応） */
  fetchedFeatures: FeatureData[];
  /** 現在表示中のインデックス */
  currentIndex: number;
};

/** 重複レコードナビゲーション関数の型 */
export type NavigateOverlap = (direction: "prev" | "next") => Promise<void>;

export type UseOverlapNavigationReturn = {
  /** 現在の重複情報 */
  overlapInfo: OverlapInfo | null;
  /** 重複情報を設定 */
  setOverlapInfo: (info: OverlapInfo | null) => void;
  /** 重複レコードをナビゲート */
  navigateOverlap: NavigateOverlap;
  /** navigateOverlapのref（useEffect依存配列問題回避用） */
  navigateOverlapRef: React.MutableRefObject<NavigateOverlap>;
};

/**
 * 重複レコードのナビゲーション状態と操作を管理するフック
 *
 * パフォーマンス考慮事項:
 * - 蓄積型設計: fetchedFeatures配列にナビゲーション済みレコードを保持
 * - 100件以上が頻発する場合は、スライディングウィンドウ方式への移行を検討
 */
export const useOverlapNavigation = ({
  getFeatureById,
  onNavigate,
}: {
  /** IDでフィーチャーを取得する関数（遅延読み込み用） */
  getFeatureById: GetFeatureById;
  /** ナビゲーション完了時のコールバック（Feature更新用） */
  onNavigate: (feature: FeatureData, newOverlapInfo: OverlapInfo) => void;
}): UseOverlapNavigationReturn => {
  const [overlapInfo, setOverlapInfo] = useState<OverlapInfo | null>(null);

  const navigateOverlap: NavigateOverlap = useCallback(
    async (direction: "prev" | "next") => {
      if (!overlapInfo || !overlapInfo.hasOverlap) return;

      const { currentIndex, allIds, fetchedFeatures, totalCount } = overlapInfo;
      const maxNavigableIndex =
        Math.min(totalCount, OVERLAP_NAVIGATION.MAX_NAVIGABLE_OVERLAPS) - 1;

      // 新しいインデックスを計算
      const newIndex =
        direction === "prev"
          ? Math.max(0, currentIndex - 1)
          : Math.min(maxNavigableIndex, currentIndex + 1);

      // 現在と同じインデックスなら何もしない（端に達している）
      if (newIndex === currentIndex) return;

      // 対象のIDを取得
      const targetId = allIds[newIndex];
      if (targetId === undefined) {
        rendererLogger.warn("Invalid overlap navigation index", undefined, {
          newIndex,
          allIdsLength: allIds.length,
          component: "useOverlapNavigation",
        });
        return;
      }

      // 既に取得済みかチェック
      let targetFeature = fetchedFeatures.find(
        (f) => f.properties.id === targetId,
      );

      // 未取得の場合は遅延取得
      if (!targetFeature) {
        try {
          const fetched = await getFeatureById(targetId);
          if (!fetched) {
            rendererLogger.warn("Failed to fetch overlap feature", undefined, {
              targetId,
              component: "useOverlapNavigation",
            });
            return;
          }
          targetFeature = fetched;
          // fetchedFeaturesに追加（蓄積型）
          fetchedFeatures.push(fetched);
        } catch (error) {
          rendererLogger.error("Error fetching overlap feature", error, {
            targetId,
            component: "useOverlapNavigation",
          });
          return;
        }
      }

      // 新しいOverlapInfoを作成
      const newOverlapInfo: OverlapInfo = {
        ...overlapInfo,
        currentIndex: newIndex,
        fetchedFeatures: [...fetchedFeatures],
      };

      // 状態を更新し、コールバックを呼び出す
      setOverlapInfo(newOverlapInfo);
      onNavigate(targetFeature, newOverlapInfo);
    },
    [overlapInfo, getFeatureById, onNavigate],
  );

  // navigateOverlapをrefで保持（useEffectの依存配列問題を回避）
  const navigateOverlapRef = useRef(navigateOverlap);
  navigateOverlapRef.current = navigateOverlap;

  return {
    overlapInfo,
    setOverlapInfo,
    navigateOverlap,
    navigateOverlapRef,
  };
};
