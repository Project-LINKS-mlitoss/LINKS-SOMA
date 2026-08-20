/**
 * 進行中ポップオーバーの「現工程コーチング」を state から導く（設計判断は ADR-0024）。
 *
 * 状態（badge）と行動（action）を分けて返す。画面に無いコントロールは指さないため、
 * 名寄せ未実行は route 文脈（ウィザード内か否か）で本文と導線を出し分ける。
 * 返すのは表示用データのみ。ナビゲーション実行は呼び出し側が intent で分岐する。
 */

import { type SelectJob } from "../../db/schema";
import { lang } from "../config/lang";
import { type GuideNames } from "../types/tutorial-resume";
import { formatDate } from "../utils/format-date";
import { TUTORIAL_STAGES, getNextStage } from "./stages";
import { type ModelMode, type TutorialStage } from "./store";

const t = lang.components.tutorial.coach;

/** 次工程へのハンドオフボタン文言（遷移先を名指し）。 */
const openNextLabel = (next: TutorialStage): string =>
  t.actionOpenNext.replace("{label}", TUTORIAL_STAGES[next].label);

/**
 * 名寄せウィザードの現在ステップ文脈（tutorial_state.resume_state から供給）。
 * ステップ index は目的で並び替わるため、意味は index でなく種別・対象名で持つ。
 */
export type NormStepContext = {
  stepType?: "intro" | "settings" | "dataset" | "confirmation";
  stepTitle?: string;
};

/**
 * 分析工程の進捗文脈。分析はジョブを持たないため、進捗は resume_state（ワークブック編集へ
 * 入ったか）と対象シートの result_views 件数で判定する。範囲はビュー作成までなので、この 2 つで
 * 「ワークブック作成前 / ビュー未作成 / ビュー作成済み」の 3 段階が導ける。
 */
export type AnalysisStepContext = {
  /** ガイド進行中に分析のワークブック編集画面へ入ったか（resume_state.analysis の有無）。 */
  inWorkbook: boolean;
  /** 対象シートにビューが 1 つ以上あるか（result_views 件数 > 0）。 */
  hasView: boolean;
};

/**
 * モデル構築フォームのフィールド進捗（resume_state.model の autosave から供給）。
 * 未実行画面で「①データ→②カラム→開始」を段階案内するために使う。
 */
export type ModelStepContext = {
  /** ① 名寄せ処理済データを選択済みか（datasetId != null）。 */
  hasDataset: boolean;
  /** ② 説明変数カラムを 1 つ以上選択済みか。 */
  hasVariables: boolean;
};

/**
 * 空き家推定フォームのフィールド進捗（resume_state.evaluation の autosave から供給）。
 * 未実行画面で「推定対象→モデル→地域集計→開始」を段階案内するために使う。
 */
export type EvalStepContext = {
  /** 推定対象（名寄せ処理済データ）を選択済みか。 */
  hasTarget: boolean;
  /** モデルを選択済みか（generic では「汎用モデル」選択）。 */
  hasModel: boolean;
  /** 地域集計用データを選択済みか。 */
  hasAreaData: boolean;
  /**
   * 地域集計フォームが非表示か（issue #1924）。
   * ジオコーディングを使っていない名寄せデータでは地域集計フォームを出さないため、
   * true のとき地域集計ステップを飛ばして「開始」を案内する。旧 resume_state では undefined。
   */
  areaFormHidden?: boolean;
};

/**
 * 各工程の画面内フィールド/ステップ進捗の文脈をまとめて渡す入れ物。
 * stage ごとに該当する 1 つだけ使う（引数の肥大化を避けるため 1 オブジェクトに集約）。
 */
export type StageStepContext = {
  normalization?: NormStepContext | null;
  model?: ModelStepContext | null;
  evaluation?: EvalStepContext | null;
  analysis?: AnalysisStepContext | null;
};

/**
 * ウィザード内（onStageScreen）での「今のステップで取る 1 アクション」を返す。
 * dataset は対象名を名指しし、詳細（取得方法・必要カラム）は右サイドパネルへ委譲する。
 * ステップ種別が未供給（旧データ等）のときは汎用文にフォールバックする。
 */
const resolveWizardStepText = (
  stepCtx: NormStepContext | null,
  modelMode: ModelMode | null,
): string => {
  switch (stepCtx?.stepType) {
    case "intro":
      // 画面内容の確認を促す。build は既定の目的（空き家推定用）のままだと教師データが
      // 揃わないため、目的の切り替えも名指しで促す。
      return modelMode === "build" ? t.normStepIntroBuild : t.normStepIntro;
    case "settings":
      return t.normStepSettings;
    case "dataset":
      return t.normStepDataset.replace(
        "{title}",
        stepCtx.stepTitle ?? "データ",
      );
    case "confirmation":
      return t.normStepConfirm;
    default:
      return t.normInWizard;
  }
};

/** 主アクション押下時の意図。実ルーティングはポップオーバー側で解決する。 */
export type CoachIntent =
  | { kind: "openEntry" } // その工程の入口ルートへ
  | { kind: "continueInput" } // 名寄せ下書きの続きへ
  | { kind: "viewList" } // 名寄せの処理一覧へ
  | { kind: "viewDetail" } // 名寄せジョブ詳細へ
  | { kind: "handoffNext"; next: TutorialStage }; // 次工程へハンドオフ

/** Fluent Badge の color に渡す状態トーン。 */
export type CoachBadgeTone = "brand" | "success" | "danger" | "informative";

export type StageCoaching = {
  /** 状態バッジ（処理中/完了/エラー/下書き）。無い場合 null。 */
  badge: { label: string; tone: CoachBadgeTone } | null;
  /** 次にやること（行動）。本文＋主アクション。 */
  action: {
    text: string;
    primary: { label: string; intent: CoachIntent } | null;
  };
};

/**
 * 名寄せ工程: draft_job_id のジョブ状態と route 文脈で出し分ける。
 *
 * @param job       名寄せ draft_job_id のジョブ（未作成は null）
 * @param inWizard  現在ウィザード（名寄せ作成画面）内にいるか
 * @param modelMode モデル構築の要否（次工程がモデル構築か推定かを分岐）
 */
const resolveNormalization = (
  job: SelectJob | null,
  inWizard: boolean,
  modelMode: ModelMode | null,
  stepCtx: NormStepContext | null,
): StageCoaching => {
  // 未実行（ジョブ未作成 or 参照消失 or 下書き）
  if (!job || job.status === "draft") {
    // ウィザード内なら、画面に無い「始める」ボタンは指さず、今のステップの操作を案内（導線ボタン不要）。
    if (inWizard) {
      return {
        badge:
          job?.status === "draft"
            ? { label: t.badgeDraft, tone: "informative" }
            : null,
        action: {
          text: resolveWizardStepText(stepCtx, modelMode),
          primary: null,
        },
      };
    }
    // ウィザード外（一覧など）。下書きがあれば「続きから」、無ければ「最初の工程」。
    if (job?.status === "draft") {
      return {
        badge: { label: t.badgeDraft, tone: "informative" },
        action: {
          text: t.normDraftList,
          primary: {
            label: t.actionContinue,
            intent: { kind: "continueInput" },
          },
        },
      };
    }
    return {
      badge: null,
      action: {
        text: t.normNotStarted,
        primary: { label: t.actionOpen, intent: { kind: "openEntry" } },
      },
    };
  }

  const time = formatDate(job.created_at);

  if (job.status === "") {
    return {
      badge: { label: t.badgeProcessing, tone: "brand" },
      action: {
        text: t.normProcessing.replace("{time}", time),
        primary: { label: t.actionViewList, intent: { kind: "viewList" } },
      },
    };
  }
  if (job.status === "error") {
    return {
      badge: { label: t.badgeError, tone: "danger" },
      action: {
        text: t.normError.replace("{time}", time),
        primary: { label: t.actionViewError, intent: { kind: "viewDetail" } },
      },
    };
  }
  // status === "complete"
  if (!job.is_named) {
    return {
      badge: { label: t.badgeComplete, tone: "success" },
      action: {
        text: t.normCompleteUnsaved.replace("{time}", time),
        primary: { label: t.actionSave, intent: { kind: "viewDetail" } },
      },
    };
  }
  // 次工程は modelMode で分岐（build=モデル構築 / generic=空き家推定）。
  const next = getNextStage("normalization", modelMode) ?? "model";
  return {
    badge: { label: t.badgeComplete, tone: "success" },
    action: {
      text: t.normCompleteSaved,
      primary: {
        label: openNextLabel(next),
        intent: { kind: "handoffNext", next },
      },
    },
  };
};

/** モデル構築工程: 未実行は保存名を名指し、実行後はジョブ状態で出し分ける。 */
const resolveModel = (
  job: SelectJob | null,
  names: GuideNames,
  onStageScreen: boolean,
  stepCtx: ModelStepContext | null,
): StageCoaching => {
  // 未実行（ジョブ未作成）。
  if (!job) {
    // 画面内でガイド進行中なら、フォームのフィールド進捗（①データ→②カラム→開始）を段階案内。
    if (onStageScreen && stepCtx) {
      const text = !stepCtx.hasDataset
        ? t.modelStepDataset
        : !stepCtx.hasVariables
          ? t.modelStepVariables
          : t.modelStepStart;
      return { badge: null, action: { text, primary: null } };
    }
    // 工程外（一覧など）or 文脈未取得: 前工程の名寄せ名を名指しした総括＋入口導線。
    // その工程の画面にいる場合は「この工程を開く」導線は出さない（画面に無い操作を指さない）。
    return {
      badge: null,
      action: {
        text: names.normalization
          ? t.model.replace("{normalization}", names.normalization)
          : t.modelNoName,
        primary: onStageScreen
          ? null
          : { label: t.actionOpen, intent: { kind: "openEntry" } },
      },
    };
  }
  const time = formatDate(job.created_at);
  if (job.status === "") {
    return {
      badge: { label: t.badgeProcessing, tone: "brand" },
      action: {
        text: t.modelProcessing.replace("{time}", time),
        primary: { label: t.actionViewList, intent: { kind: "viewList" } },
      },
    };
  }
  if (job.status === "error") {
    return {
      badge: { label: t.badgeError, tone: "danger" },
      action: {
        text: t.modelError.replace("{time}", time),
        primary: { label: t.actionViewError, intent: { kind: "viewDetail" } },
      },
    };
  }
  if (!job.is_named) {
    return {
      badge: { label: t.badgeComplete, tone: "success" },
      action: {
        text: t.modelCompleteUnsaved.replace("{time}", time),
        primary: { label: t.actionSave, intent: { kind: "viewDetail" } },
      },
    };
  }
  return {
    badge: { label: t.badgeComplete, tone: "success" },
    action: {
      text: t.modelCompleteSaved,
      primary: {
        label: openNextLabel("evaluation"),
        intent: { kind: "handoffNext", next: "evaluation" },
      },
    },
  };
};

/**
 * 空き家推定工程: 未実行は保存名を名指し、実行後はジョブ状態で出し分ける。
 * 推定結果は自動保存のため「完了」は保存ステップを挟まず、詳細で確認→分析へ。
 */
const resolveEvaluation = (
  job: SelectJob | null,
  names: GuideNames,
  onStageScreen: boolean,
  modelMode: ModelMode | null,
  stepCtx: EvalStepContext | null,
): StageCoaching => {
  if (!job) {
    // 画面内でガイド進行中なら、フォームのフィールド進捗（推定対象→モデル→地域集計→開始）
    // を段階案内。モデルの文言だけ modelMode で分岐（generic=「汎用モデル」を選ぶ）。
    if (onStageScreen && stepCtx) {
      const text = !stepCtx.hasTarget
        ? t.evalStepTarget
        : !stepCtx.hasModel
          ? modelMode === "generic"
            ? t.evalStepModelGeneric
            : t.evalStepModel
          : // 地域集計フォーム非表示時（ジオコーディング未使用）は地域集計を飛ばして「開始」を案内（#1924）
            !stepCtx.areaFormHidden && !stepCtx.hasAreaData
            ? t.evalStepAreaData
            : t.evalStepStart;
      return { badge: null, action: { text, primary: null } };
    }
    // 工程外 or 文脈未取得: 総括文（generic/build と保存名有無で分岐）＋入口導線。
    // 地域集計フォームが非表示と判明しているときは、画面に出ない欄を案内しない（#1924）。
    const noArea = stepCtx?.areaFormHidden === true;
    const text =
      modelMode === "generic"
        ? names.normalization
          ? (noArea ? t.evaluationGenericNoArea : t.evaluationGeneric).replace(
              "{normalization}",
              names.normalization,
            )
          : noArea
            ? t.evaluationGenericNoAreaNoName
            : t.evaluationGenericNoName
        : names.normalization && names.model
          ? (noArea ? t.evaluationNoArea : t.evaluation)
              .replace("{normalization}", names.normalization)
              .replace("{model}", names.model)
          : noArea
            ? t.evaluationNoAreaNoName
            : t.evaluationNoName;
    return {
      badge: null,
      action: {
        text,
        primary: onStageScreen
          ? null
          : { label: t.actionOpen, intent: { kind: "openEntry" } },
      },
    };
  }
  const time = formatDate(job.created_at);
  if (job.status === "") {
    return {
      badge: { label: t.badgeProcessing, tone: "brand" },
      action: {
        text: t.evalProcessing.replace("{time}", time),
        primary: { label: t.actionViewList, intent: { kind: "viewList" } },
      },
    };
  }
  if (job.status === "error") {
    return {
      badge: { label: t.badgeError, tone: "danger" },
      action: {
        text: t.evalError.replace("{time}", time),
        primary: { label: t.actionViewError, intent: { kind: "viewDetail" } },
      },
    };
  }
  // complete（結果は自動保存済み）→ 詳細で結果確認し、分析へ。
  return {
    badge: { label: t.badgeComplete, tone: "success" },
    action: {
      text: t.evalComplete.replace("{time}", time),
      primary: { label: t.actionViewResult, intent: { kind: "viewDetail" } },
    },
  };
};

/**
 * 分析工程（最終工程・ジョブなし）: 「ワークブック作成 → プリセットでビュー作成」までを案内する。
 * 範囲はビュー作成までとし、可視化の細部（種類選択・保存）には踏み込まない。進捗は
 * AnalysisStepContext（WB 入場と result_views 件数）で 3 段階に出し分ける。完了操作自体は
 * 進行ポップオーバーの「完了」ボタンが担う（ここでは主アクションを出さない）。
 */
const resolveAnalysis = (
  names: GuideNames,
  onStageScreen: boolean,
  ctx: AnalysisStepContext | null,
): StageCoaching => {
  // ビュー作成済み: 範囲は完了。あとはポップオーバーの「完了」で終える。
  if (ctx?.hasView) {
    return {
      badge: { label: t.badgeComplete, tone: "success" },
      action: { text: t.analysisViewReady, primary: null },
    };
  }
  // ワークブック内・ビュー未作成: プリセット（テンプレート）でのビュー作成を促す。
  if (ctx?.inWorkbook) {
    return { badge: null, action: { text: t.analysisAddView, primary: null } };
  }
  // 未着手（一覧など）: まずワークブックを作る。工程外なら入口導線を添える。
  return {
    badge: null,
    action: {
      text: names.evaluation
        ? t.analysis.replace("{evaluation}", names.evaluation)
        : t.analysisNoName,
      primary: onStageScreen
        ? null
        : { label: t.actionOpen, intent: { kind: "openEntry" } },
    },
  };
};

/**
 * 現工程のコーチングを導く。
 *
 * @param stage        現工程
 * @param job          現工程の対象ジョブ（normalization=draft, model/evaluation=実行ジョブ。analysis は null）
 * @param names        各工程の成果物名（参照 id から都度導出した現在の名前）
 * @param onStageScreen その工程自身の画面にいるか（いる場合は「この工程を開く」導線を出さない）
 * @param modelMode    モデル構築の要否（次工程分岐・汎用モデル文言に使う）
 * @param step         各工程の画面内フィールド/ステップ進捗文脈（該当 stage の 1 つだけ使う）
 */
export const resolveStageCoaching = (
  stage: TutorialStage,
  job: SelectJob | null,
  names: GuideNames,
  onStageScreen: boolean,
  modelMode: ModelMode | null,
  step: StageStepContext,
): StageCoaching => {
  switch (stage) {
    case "normalization":
      return resolveNormalization(
        job,
        onStageScreen,
        modelMode,
        step.normalization ?? null,
      );
    case "model":
      return resolveModel(job, names, onStageScreen, step.model ?? null);
    case "evaluation":
      return resolveEvaluation(
        job,
        names,
        onStageScreen,
        modelMode,
        step.evaluation ?? null,
      );
    case "analysis":
      return resolveAnalysis(names, onStageScreen, step.analysis ?? null);
  }
};

if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;

  const names: GuideNames = {
    normalization: "名寄せA",
    model: "モデルA",
    evaluation: "推定結果A",
  };

  describe("resolveStageCoaching: 分析工程の進捗別コーチング", () => {
    const analysis = (
      onStageScreen: boolean,
      ctx: AnalysisStepContext | null,
    ): StageCoaching =>
      resolveStageCoaching("analysis", null, names, onStageScreen, null, {
        analysis: ctx,
      });

    it("未着手（WB未入場）は WB 作成を案内し、工程外なら入口導線を出す", () => {
      const c = analysis(false, { inWorkbook: false, hasView: false });
      expect(c.badge).toBeNull();
      expect(c.action.text).toBe(
        t.analysis.replace("{evaluation}", "推定結果A"),
      );
      expect(c.action.primary?.intent).toEqual({ kind: "openEntry" });
    });

    it("工程画面内かつ未着手では入口導線を出さない", () => {
      const c = analysis(true, { inWorkbook: false, hasView: false });
      expect(c.action.primary).toBeNull();
    });

    it("WB入場・ビュー未作成はプリセットでのビュー作成を促す", () => {
      const c = analysis(true, { inWorkbook: true, hasView: false });
      expect(c.badge).toBeNull();
      expect(c.action.text).toBe(t.analysisAddView);
      expect(c.action.primary).toBeNull();
    });

    it("ビュー作成済みは完了バッジ＋準備完了案内（主アクションなし）", () => {
      const c = analysis(true, { inWorkbook: true, hasView: true });
      expect(c.badge).toEqual({ label: t.badgeComplete, tone: "success" });
      expect(c.action.text).toBe(t.analysisViewReady);
      expect(c.action.primary).toBeNull();
    });
  });

  describe("resolveStageCoaching: モデル工程のフィールド進捗（未実行画面内）", () => {
    const model = (
      onStageScreen: boolean,
      ctx: ModelStepContext | null,
    ): StageCoaching =>
      resolveStageCoaching("model", null, names, onStageScreen, "build", {
        model: ctx,
      });

    it("画面内・データ未選択は①データ選択を促す", () => {
      const c = model(true, { hasDataset: false, hasVariables: false });
      expect(c.action.text).toBe(t.modelStepDataset);
      expect(c.action.primary).toBeNull();
    });

    it("画面内・データ選択済/カラム未選択は②カラム選択を促す", () => {
      const c = model(true, { hasDataset: true, hasVariables: false });
      expect(c.action.text).toBe(t.modelStepVariables);
    });

    it("画面内・両方選択済は構築開始を促す", () => {
      const c = model(true, { hasDataset: true, hasVariables: true });
      expect(c.action.text).toBe(t.modelStepStart);
    });

    it("工程外は総括＋入口導線（フィールド進捗は出さない）", () => {
      const c = model(false, { hasDataset: false, hasVariables: false });
      expect(c.action.text).toBe(t.model.replace("{normalization}", "名寄せA"));
      expect(c.action.primary?.intent).toEqual({ kind: "openEntry" });
    });
  });

  describe("resolveStageCoaching: 推定工程のフィールド進捗（未実行画面内）", () => {
    const evaluation = (
      onStageScreen: boolean,
      modelMode: ModelMode | null,
      ctx: EvalStepContext | null,
    ): StageCoaching =>
      resolveStageCoaching(
        "evaluation",
        null,
        names,
        onStageScreen,
        modelMode,
        { evaluation: ctx },
      );

    it("推定対象→モデル→地域集計→開始 の順に段階案内する（build）", () => {
      const base = { hasTarget: false, hasModel: false, hasAreaData: false };
      expect(evaluation(true, "build", base).action.text).toBe(
        t.evalStepTarget,
      );
      expect(
        evaluation(true, "build", { ...base, hasTarget: true }).action.text,
      ).toBe(t.evalStepModel);
      expect(
        evaluation(true, "build", {
          hasTarget: true,
          hasModel: true,
          hasAreaData: false,
        }).action.text,
      ).toBe(t.evalStepAreaData);
      expect(
        evaluation(true, "build", {
          hasTarget: true,
          hasModel: true,
          hasAreaData: true,
        }).action.text,
      ).toBe(t.evalStepStart);
    });

    it("地域集計フォーム非表示（areaFormHidden）なら③を飛ばし開始を案内する（#1924）", () => {
      // ジオコーディングを使っていない名寄せデータでは地域集計が出ないため hasAreaData は false のまま。
      // areaFormHidden=true で ③ ステップをスキップし「開始」へ進める。
      expect(
        evaluation(true, "build", {
          hasTarget: true,
          hasModel: true,
          hasAreaData: false,
          areaFormHidden: true,
        }).action.text,
      ).toBe(t.evalStepStart);
    });

    it("工程外の総括文も地域集計フォーム非表示なら地域集計を案内しない（#1924）", () => {
      // resume_state に showAreaForm=false が残るため、工程外でも非表示が判明している。
      // 画面に出ない欄を案内すると、ユーザーは存在しないカードを探すことになる。
      const ctx = {
        hasTarget: true,
        hasModel: true,
        hasAreaData: false,
        areaFormHidden: true,
      };
      expect(evaluation(false, "build", ctx).action.text).not.toContain(
        "地域集計用データ",
      );
      expect(evaluation(false, "generic", ctx).action.text).not.toContain(
        "地域集計用データ",
      );
      // 非表示が判明していないときは従来どおり地域集計を案内する
      expect(
        evaluation(false, "build", { ...ctx, areaFormHidden: false }).action
          .text,
      ).toContain("地域集計用データ");
    });

    it("generic は②の文言が「汎用モデル」を選ぶ案内になる", () => {
      const c = evaluation(true, "generic", {
        hasTarget: true,
        hasModel: false,
        hasAreaData: false,
      });
      expect(c.action.text).toBe(t.evalStepModelGeneric);
    });

    it("工程外は総括＋入口導線（フィールド進捗は出さない）", () => {
      const c = evaluation(false, "generic", {
        hasTarget: false,
        hasModel: false,
        hasAreaData: false,
      });
      expect(c.action.text).toBe(
        t.evaluationGeneric.replace("{normalization}", "名寄せA"),
      );
      expect(c.action.primary?.intent).toEqual({ kind: "openEntry" });
    });
  });

  // ジョブ状態（未実行/下書き/処理中/エラー/完了）で出し分ける分岐を網羅する。
  // coaching は job の status / created_at / is_named のみ参照するため、最小の mock で足りる。
  const CREATED = "2026-07-15T04:00:00Z";
  const TIME = formatDate(CREATED);
  const makeJob = (status: SelectJob["status"], is_named = false): SelectJob =>
    ({
      id: 1,
      status,
      type: "preprocess",
      process_id: null,
      is_named,
      parameters: {},
      created_at: CREATED,
      updated_at: CREATED,
    }) as unknown as SelectJob;

  describe("resolveStageCoaching: 名寄せ工程の状態別コーチング", () => {
    const norm = (
      job: SelectJob | null,
      inWizard: boolean,
      modelMode: ModelMode | null,
      stepCtx: NormStepContext | null = null,
    ): StageCoaching =>
      resolveStageCoaching("normalization", job, names, inWizard, modelMode, {
        normalization: stepCtx,
      });

    it("未着手（ジョブ無し・工程外）は最初の工程案内＋入口導線", () => {
      const c = norm(null, false, "build");
      expect(c.badge).toBeNull();
      expect(c.action.text).toBe(t.normNotStarted);
      expect(c.action.primary).toEqual({
        label: t.actionOpen,
        intent: { kind: "openEntry" },
      });
    });

    it("下書き・工程外は「続きから」導線（continueInput）", () => {
      const c = norm(makeJob("draft"), false, "build");
      expect(c.badge).toEqual({ label: t.badgeDraft, tone: "informative" });
      expect(c.action.text).toBe(t.normDraftList);
      expect(c.action.primary).toEqual({
        label: t.actionContinue,
        intent: { kind: "continueInput" },
      });
    });

    it("下書き・ウィザード内で種別未供給はフォールバック文（導線なし）", () => {
      const c = norm(makeJob("draft"), true, "build");
      expect(c.badge).toEqual({ label: t.badgeDraft, tone: "informative" });
      expect(c.action.text).toBe(t.normInWizard);
      expect(c.action.primary).toBeNull();
    });

    it("ウィザード内 intro は modelMode で分岐（build/generic）", () => {
      expect(norm(null, true, "build", { stepType: "intro" }).action.text).toBe(
        t.normStepIntroBuild,
      );
      expect(
        norm(null, true, "generic", { stepType: "intro" }).action.text,
      ).toBe(t.normStepIntro);
    });

    it("ウィザード内 settings / dataset / confirmation の各ステップ文", () => {
      expect(
        norm(null, true, "build", { stepType: "settings" }).action.text,
      ).toBe(t.normStepSettings);
      expect(
        norm(null, true, "build", {
          stepType: "dataset",
          stepTitle: "水道閉開栓状況",
        }).action.text,
      ).toBe(t.normStepDataset.replace("{title}", "水道閉開栓状況"));
      expect(
        norm(null, true, "build", { stepType: "confirmation" }).action.text,
      ).toBe(t.normStepConfirm);
    });

    it("処理中は処理中バッジ＋一覧導線（viewList）", () => {
      const c = norm(makeJob(""), false, "build");
      expect(c.badge).toEqual({ label: t.badgeProcessing, tone: "brand" });
      expect(c.action.text).toBe(t.normProcessing.replace("{time}", TIME));
      expect(c.action.primary).toEqual({
        label: t.actionViewList,
        intent: { kind: "viewList" },
      });
    });

    it("エラーはエラーバッジ＋詳細導線（viewDetail）", () => {
      const c = norm(makeJob("error"), false, "build");
      expect(c.badge).toEqual({ label: t.badgeError, tone: "danger" });
      expect(c.action.text).toBe(t.normError.replace("{time}", TIME));
      expect(c.action.primary).toEqual({
        label: t.actionViewError,
        intent: { kind: "viewDetail" },
      });
    });

    it("完了・未保存は完了バッジ＋保存導線（viewDetail）", () => {
      const c = norm(makeJob("complete", false), false, "build");
      expect(c.badge).toEqual({ label: t.badgeComplete, tone: "success" });
      expect(c.action.text).toBe(t.normCompleteUnsaved.replace("{time}", TIME));
      expect(c.action.primary).toEqual({
        label: t.actionSave,
        intent: { kind: "viewDetail" },
      });
    });

    it("完了・保存済みは次工程ハンドオフ（build=モデル / generic=空き家推定）", () => {
      const build = norm(makeJob("complete", true), false, "build");
      expect(build.action.text).toBe(t.normCompleteSaved);
      expect(build.action.primary).toEqual({
        label: t.actionOpenNext.replace("{label}", "モデル構築"),
        intent: { kind: "handoffNext", next: "model" },
      });

      const generic = norm(makeJob("complete", true), false, "generic");
      expect(generic.action.primary).toEqual({
        label: t.actionOpenNext.replace("{label}", "空き家推定"),
        intent: { kind: "handoffNext", next: "evaluation" },
      });
    });
  });

  describe("resolveStageCoaching: モデル工程の状態別コーチング（実行後）", () => {
    const model = (job: SelectJob | null): StageCoaching =>
      resolveStageCoaching("model", job, names, false, "build", {});

    it("処理中は処理中バッジ＋一覧導線", () => {
      const c = model(makeJob(""));
      expect(c.badge).toEqual({ label: t.badgeProcessing, tone: "brand" });
      expect(c.action.text).toBe(t.modelProcessing.replace("{time}", TIME));
      expect(c.action.primary?.intent).toEqual({ kind: "viewList" });
    });

    it("エラーはエラーバッジ＋詳細導線", () => {
      const c = model(makeJob("error"));
      expect(c.badge).toEqual({ label: t.badgeError, tone: "danger" });
      expect(c.action.text).toBe(t.modelError.replace("{time}", TIME));
      expect(c.action.primary?.intent).toEqual({ kind: "viewDetail" });
    });

    it("完了・未保存は保存導線", () => {
      const c = model(makeJob("complete", false));
      expect(c.badge).toEqual({ label: t.badgeComplete, tone: "success" });
      expect(c.action.text).toBe(
        t.modelCompleteUnsaved.replace("{time}", TIME),
      );
      expect(c.action.primary?.intent).toEqual({ kind: "viewDetail" });
    });

    it("完了・保存済みは空き家推定へハンドオフ", () => {
      const c = model(makeJob("complete", true));
      expect(c.action.text).toBe(t.modelCompleteSaved);
      expect(c.action.primary).toEqual({
        label: t.actionOpenNext.replace("{label}", "空き家推定"),
        intent: { kind: "handoffNext", next: "evaluation" },
      });
    });
  });

  describe("resolveStageCoaching: 推定工程の状態別コーチング（実行後）", () => {
    const evaluation = (job: SelectJob | null): StageCoaching =>
      resolveStageCoaching("evaluation", job, names, false, "build", {});

    it("処理中は処理中バッジ＋一覧導線", () => {
      const c = evaluation(makeJob(""));
      expect(c.badge).toEqual({ label: t.badgeProcessing, tone: "brand" });
      expect(c.action.text).toBe(t.evalProcessing.replace("{time}", TIME));
      expect(c.action.primary?.intent).toEqual({ kind: "viewList" });
    });

    it("エラーはエラーバッジ＋詳細導線", () => {
      const c = evaluation(makeJob("error"));
      expect(c.badge).toEqual({ label: t.badgeError, tone: "danger" });
      expect(c.action.text).toBe(t.evalError.replace("{time}", TIME));
      expect(c.action.primary?.intent).toEqual({ kind: "viewDetail" });
    });

    it("完了は結果確認導線（保存ステップを挟まず詳細へ）", () => {
      const c = evaluation(makeJob("complete", false));
      expect(c.badge).toEqual({ label: t.badgeComplete, tone: "success" });
      expect(c.action.text).toBe(t.evalComplete.replace("{time}", TIME));
      expect(c.action.primary).toEqual({
        label: t.actionViewResult,
        intent: { kind: "viewDetail" },
      });
    });
  });
}
