/**
 * 名寄せ下書きの破壊操作サイト（新規作成＝下書き削除）が、ガイド参照状態を問い合わせ、
 * 参照中ならガイドを解放するための述語フック。
 *
 * ADR-0024 の境界: ドメインは tutorial の store を直接 import せず、述語経由で扱う
 * （job 削除の useGuideEndGuard と同じ依存方向）。1 枚ダイアログ UX のため、
 * 参照中かどうかを呼び出し側が文言へ反映できるよう reactive に返す。
 */

import { useCallback } from "react";
import { tutorialStore, useTutorial } from "./store";

export type UseGuideDraftGuardResult = {
  /** この下書きを進行中/中断中ガイドが握っているか（ダイアログ文言の出し分けに使う）。 */
  guideReferenced: boolean;
  /** 参照中ならガイドを解放する（破壊操作の直前に呼ぶ）。 */
  releaseIfReferenced: () => void;
};

export const useGuideDraftGuard = (
  draftJobId: number | null | undefined,
): UseGuideDraftGuardResult => {
  const { phase, draftJobId: referencedId } = useTutorial();
  const guideReferenced =
    draftJobId != null &&
    referencedId === draftJobId &&
    (phase === "running" || phase === "paused");
  const releaseIfReferenced = useCallback((): void => {
    if (guideReferenced) tutorialStore.reset();
  }, [guideReferenced]);
  return { guideReferenced, releaseIfReferenced };
};
