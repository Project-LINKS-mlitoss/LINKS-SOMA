/**
 * チュートリアル動線の工程定義。
 *
 * 一気通貫 (名寄せ → モデル → 推定 → 分析) の各工程の表示名・次工程・入口ルート。
 * 進行中ポップオーバーの「現在地/次工程」と、各工程のハンドオフ先に使う。
 */

import { ROUTES } from "../config/routes";
import {
  type ModelMode,
  type TutorialStage,
  type TutorialState,
} from "./store";

export interface TutorialStageInfo {
  /** 表示名 */
  label: string;
  /** 次の工程 (最終工程は null)。build モードの既定順。分岐込みの次工程は getNextStage を使う。 */
  next: TutorialStage | null;
  /** その工程の入口ルート */
  route: string;
}

// 工程の説明・指示はポップオーバーのコーチング (coaching.ts / lang.coach) が担う。
export const TUTORIAL_STAGES: Record<TutorialStage, TutorialStageInfo> = {
  normalization: {
    label: "名寄せ処理",
    next: "model",
    route: ROUTES.NORMALIZATION.ROOT,
  },
  model: {
    label: "モデル構築",
    next: "evaluation",
    route: ROUTES.MODEL.CREATE,
  },
  evaluation: {
    label: "空き家推定",
    next: "analysis",
    route: ROUTES.EVALUATION.CREATE,
  },
  analysis: {
    label: "分析",
    next: null,
    route: ROUTES.ANALYSIS.WORKBOOK,
  },
};

/**
 * 一気通貫の工程順 (ステッパー表示・進捗計算に使う)。
 * modelMode で分岐し、generic（汎用モデル）は model 工程を飛ばす。
 * 未選択 (null) は build 相当（全工程）を返す。
 */
export const getStageOrder = (modelMode: ModelMode | null): TutorialStage[] =>
  modelMode === "generic"
    ? ["normalization", "evaluation", "analysis"]
    : ["normalization", "model", "evaluation", "analysis"];

/**
 * 現工程の次工程（最終は null）。modelMode に応じて model を飛ばす。
 * ハンドオフ先・最終工程判定はこの関数を唯一の根拠にする。
 */
export const getNextStage = (
  stage: TutorialStage,
  modelMode: ModelMode | null,
): TutorialStage | null => {
  const order = getStageOrder(modelMode);
  const index = order.indexOf(stage);
  return index >= 0 && index < order.length - 1 ? order[index + 1] : null;
};

/**
 * 中断/離脱からの復元先ルートを state から導く（ADR-0024）。
 *
 * - 名寄せ: 生きている draft job + 該当ステップへ deep-link。draft が無ければ工程入口へ降格
 * - 分析: 保存した workbook/sheet/view へ deep-link
 * - モデル/推定: 工程入口へ。フォームの選択は画面側 rehydrate が snapshot から復元する
 *
 * draft の存在検証は呼び出し側 (resume 実行時) で行い、無ければ工程入口へ降格する。
 */
export const resolveResumeRoute = (
  state: Pick<TutorialState, "stage" | "draftJobId" | "resumeState">,
): string => {
  const { stage, draftJobId, resumeState } = state;
  if (!stage) return ROUTES.HOME;

  switch (stage) {
    case "normalization": {
      if (draftJobId == null) return TUTORIAL_STAGES.normalization.route;
      const step =
        resumeState?.stage === "normalization" ? resumeState.step : 0;
      return `${ROUTES.NORMALIZATION.RECREATE(String(draftJobId))}?step=${step}`;
    }
    case "analysis": {
      if (resumeState?.stage === "analysis") {
        return ROUTES.ANALYSIS.WORKBOOK_EDIT({
          id: resumeState.workbookId,
          queryParams: {
            sheetId: resumeState.sheetId,
            viewId: resumeState.viewId,
          },
        });
      }
      return TUTORIAL_STAGES.analysis.route;
    }
    case "model":
    case "evaluation":
      // 画面 mount 時に snapshot から rehydrate するため、入口ルートで足りる。
      return TUTORIAL_STAGES[stage].route;
  }
};

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  describe("getStageOrder / getNextStage: modelMode 分岐", () => {
    it("build は全4工程、generic は model を飛ばす3工程", () => {
      expect(getStageOrder("build")).toEqual([
        "normalization",
        "model",
        "evaluation",
        "analysis",
      ]);
      expect(getStageOrder("generic")).toEqual([
        "normalization",
        "evaluation",
        "analysis",
      ]);
      expect(getStageOrder(null)).toEqual(getStageOrder("build"));
    });

    it("次工程は modelMode に従う（generic は名寄せの次が推定）", () => {
      expect(getNextStage("normalization", "build")).toBe("model");
      expect(getNextStage("normalization", "generic")).toBe("evaluation");
      expect(getNextStage("model", "build")).toBe("evaluation");
      expect(getNextStage("evaluation", "build")).toBe("analysis");
      expect(getNextStage("analysis", "build")).toBeNull();
    });
  });

  describe("resolveResumeRoute: 中断/離脱からの復元先", () => {
    it("stage 未設定は HOME", () => {
      expect(
        resolveResumeRoute({
          stage: null,
          draftJobId: null,
          resumeState: null,
        }),
      ).toBe(ROUTES.HOME);
    });

    it("名寄せ・draft 無しは工程入口へ降格", () => {
      expect(
        resolveResumeRoute({
          stage: "normalization",
          draftJobId: null,
          resumeState: null,
        }),
      ).toBe(ROUTES.NORMALIZATION.ROOT);
    });

    it("名寄せ・draft 有りは resume step へ deep-link", () => {
      expect(
        resolveResumeRoute({
          stage: "normalization",
          draftJobId: 7,
          resumeState: { stage: "normalization", step: 3 },
        }),
      ).toBe(`${ROUTES.NORMALIZATION.RECREATE("7")}?step=3`);
    });

    it("名寄せ・draft 有りだが resumeState が別 stage なら step=0", () => {
      expect(
        resolveResumeRoute({
          stage: "normalization",
          draftJobId: 7,
          resumeState: null,
        }),
      ).toBe(`${ROUTES.NORMALIZATION.RECREATE("7")}?step=0`);
    });

    it("分析・resumeState 有りは workbook/sheet/view へ deep-link", () => {
      expect(
        resolveResumeRoute({
          stage: "analysis",
          draftJobId: null,
          resumeState: {
            stage: "analysis",
            workbookId: 2,
            sheetId: 5,
            viewId: 9,
          },
        }),
      ).toBe(
        ROUTES.ANALYSIS.WORKBOOK_EDIT({
          id: 2,
          queryParams: { sheetId: 5, viewId: 9 },
        }),
      );
    });

    it("分析・resumeState 無しは工程入口へ降格", () => {
      expect(
        resolveResumeRoute({
          stage: "analysis",
          draftJobId: null,
          resumeState: null,
        }),
      ).toBe(ROUTES.ANALYSIS.WORKBOOK);
    });

    it("モデル/推定は入口ルート（画面 mount 時に rehydrate）", () => {
      expect(
        resolveResumeRoute({
          stage: "model",
          draftJobId: null,
          resumeState: null,
        }),
      ).toBe(ROUTES.MODEL.CREATE);
      expect(
        resolveResumeRoute({
          stage: "evaluation",
          draftJobId: null,
          resumeState: null,
        }),
      ).toBe(ROUTES.EVALUATION.CREATE);
    });
  });
}
