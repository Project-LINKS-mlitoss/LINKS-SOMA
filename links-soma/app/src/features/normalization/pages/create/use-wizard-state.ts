/**
 * 名寄せ処理ウィザードの状態管理フック
 */

import { useCallback, useMemo, useState } from "react";
import { type NormalizationPurpose } from "../../hooks/use-form-normalization";
import {
  TOTAL_STEPS,
  buildWizardSteps,
  type WizardStepConfig,
} from "./wizard-steps";

type UseWizardStateProps = {
  /** 初期ステップ（再実行時など） */
  initialStep?: number;
  /** 初期手動スキップ状態（下書き再開時） */
  initialManuallySkippedSteps?: number[];
  /** 名寄せの目的。必須性・説明文の出し分けに使う */
  purpose: NormalizationPurpose;
};

type UseWizardStateReturn = {
  /** 現在のステップインデックス */
  currentStep: number;
  /** 現在のステップ設定 */
  currentStepConfig: WizardStepConfig;
  /** 総ステップ数 */
  totalSteps: number;
  /** 有効なステップ数（自動スキップを除く） */
  effectiveSteps: number;
  /** 有効なステップでの現在位置 */
  effectiveCurrentStep: number;
  /** プログレス（0-100） */
  progress: number;
  /** 最初のステップかどうか */
  isFirstStep: boolean;
  /** 最後のステップかどうか */
  isLastStep: boolean;
  /** 手動スキップしたステップ */
  manuallySkippedSteps: Set<number>;
  /** 自動スキップされたステップ */
  autoSkippedSteps: Set<number>;
  /** 次のステップへ進む */
  goNext: () => void;
  /** 前のステップへ戻る */
  goPrev: () => void;
  /** 手動スキップの切り替え */
  toggleManualSkip: (stepId: number, isSkipped: boolean) => void;
  /** 指定したステップへ移動 */
  goToStep: (stepId: number) => void;
};

/**
 * ウィザードの状態管理フック
 */
export const useWizardState = ({
  initialStep = 0,
  initialManuallySkippedSteps,
  purpose,
}: UseWizardStateProps): UseWizardStateReturn => {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [manuallySkippedSteps, setManuallySkippedSteps] = useState<Set<number>>(
    () => new Set(initialManuallySkippedSteps ?? []),
  );

  // 目的で並びが変わるとスキップのインデックスが無効になるため、変更時にリセットする。
  // （render 中の state 調整。React 推奨パターン: 派生 state のリセット）
  const [prevPurpose, setPrevPurpose] = useState(purpose);
  if (prevPurpose !== purpose) {
    setPrevPurpose(purpose);
    setManuallySkippedSteps(new Set());
  }

  // 目的で解決・並べ替えたステップ列（必須を先に提示）。
  const steps = useMemo(() => buildWizardSteps(purpose), [purpose]);

  // 条件付き自動スキップの判定
  // 建物ポリゴンデータでPLATEAUを選択した場合のスキップ処理
  // （将来的には他の条件も追加可能）
  // 注: Phase 1ではスキップロジックは無効化（常にfalse）
  // Phase 2以降で実際の依存関係ロジックを実装
  const shouldSkipBuildingPolygon = false;

  // 自動スキップされたステップ
  const autoSkippedSteps = useMemo(() => {
    const skipped = new Set<number>();
    if (shouldSkipBuildingPolygon) {
      skipped.add(8); // 建物ポリゴンデータのステップID
    }
    return skipped;
  }, [shouldSkipBuildingPolygon]);

  // 現在のステップ設定
  const currentStepConfig = steps[currentStep];

  // 有効なステップ数と現在位置の計算（自動スキップを除外）
  const { effectiveSteps, effectiveCurrentStep } = useMemo(() => {
    const validSteps = Array.from({ length: TOTAL_STEPS }, (_, i) => i).filter(
      (i) => !autoSkippedSteps.has(i),
    );

    return {
      effectiveSteps: validSteps.length,
      effectiveCurrentStep: validSteps.indexOf(currentStep),
    };
  }, [currentStep, autoSkippedSteps]);

  // プログレス計算
  const progress = ((effectiveCurrentStep + 1) / effectiveSteps) * 100;

  // 次の有効なステップを探す（自動スキップ対象をスキップ）
  const findValidStep = useCallback(
    (start: number, direction: 1 | -1): number | null => {
      const next = start + direction;
      if (next < 0 || next >= TOTAL_STEPS) return null;
      return autoSkippedSteps.has(next) ? findValidStep(next, direction) : next;
    },
    [autoSkippedSteps],
  );

  // 次のステップへ
  const goNext = useCallback(() => {
    const nextStep = findValidStep(currentStep, 1);
    if (nextStep !== null) {
      setCurrentStep(nextStep);
    }
  }, [currentStep, findValidStep]);

  // 前のステップへ
  const goPrev = useCallback(() => {
    const prevStep = findValidStep(currentStep, -1);
    if (prevStep !== null) {
      setCurrentStep(prevStep);
    }
  }, [currentStep, findValidStep]);

  // 手動スキップの切り替え
  const toggleManualSkip = useCallback((stepId: number, isSkipped: boolean) => {
    setManuallySkippedSteps((prev) => {
      const next = new Set(prev);
      if (isSkipped) {
        next.add(stepId);
      } else {
        next.delete(stepId);
      }
      return next;
    });
  }, []);

  // 指定したステップへ移動
  const goToStep = useCallback(
    (stepId: number) => {
      // 有効なステップIDの範囲チェック
      if (
        stepId >= 0 &&
        stepId < TOTAL_STEPS &&
        !autoSkippedSteps.has(stepId)
      ) {
        setCurrentStep(stepId);
      }
    },
    [autoSkippedSteps],
  );

  return {
    currentStep,
    currentStepConfig,
    totalSteps: TOTAL_STEPS,
    effectiveSteps,
    effectiveCurrentStep,
    progress,
    isFirstStep: currentStep === 0,
    isLastStep: currentStepConfig.type === "confirmation",
    manuallySkippedSteps,
    autoSkippedSteps,
    goNext,
    goPrev,
    toggleManualSkip,
    goToStep,
  };
};
