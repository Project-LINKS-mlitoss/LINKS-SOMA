/**
 * 進行中ガイドの全画面共通 UI。
 *
 * 右上のトグルボタンで進行中ポップオーバーを開閉する
 * (design.pen「検討: フロー-進行中ステータスポップオーバー」/「右上ボタンから下方向」準拠)。
 * phase==="running" のときだけ表示。
 *
 * 構成は 2 セクションに分離する（状態と行動は性質が違うため）:
 * - 状態セクション: 4 工程ステッパー + 現工程の状態バッジ（処理中/完了/エラー/下書き）。
 *   「今どこ・何が起きているか」(Visibility of System Status)。
 * - 行動セクション「次にやること」: 実 UI を名指しした指示文 + 主アクション。
 *   「何をすべきか」(Call to Action / Primary Action Prominence)。
 *
 * 代行でなく実 UI への足場架け（Recognition over Recall / 永続的中級者向け）。
 * 用語は「ガイド」(サイドバーボタンと統一)。design は「チュートリアル」表記で、後で統一予定。
 */

import {
  makeStyles,
  mergeClasses,
  tokens,
  Card,
  Divider,
  Badge,
} from "@fluentui/react-components";
import {
  ChevronUpRegular,
  ChevronDownRegular,
  CheckmarkCircleFilled,
  CircleRegular,
  PlayCircleRegular,
} from "@fluentui/react-icons";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { lang } from "../config/lang";
import { ROUTES } from "../config/routes";
import { useFetchResultViews } from "../hooks/use-fetch-result-views";
import { useTutorial, tutorialStore, type TutorialPhase } from "./store";
import { TUTORIAL_STAGES, getStageOrder, getNextStage } from "./stages";
import { useResumeNavigate } from "./use-resume-navigate";
import { useGuideJobStatus } from "./use-guide-job-status";
import { useGuideNames } from "./use-guide-names";
import { resolveStageCoaching, type CoachIntent } from "./coaching";

const t = lang.components.tutorial;

/**
 * コーチング本文の [[…]] を囲った動的対象名をグレーチップに、それ以外を素のテキストに描画する。
 * 対象名（日時付きジョブ名・データ名）を文中でコントラスト表示して識別しやすくする。
 */
const renderActionText = (
  text: string,
  chipClass: string,
): (JSX.Element | string)[] =>
  text.split(/(\[\[.+?\]\])/).map((part, i) =>
    part.startsWith("[[") && part.endsWith("]]") ? (
      <span key={`${i}-${part}`} className={chipClass}>
        {part.slice(2, -2)}
      </span>
    ) : (
      part
    ),
  );

const useStyles = makeStyles({
  container: {
    position: "fixed",
    top: tokens.spacingVerticalL,
    right: tokens.spacingHorizontalL,
    zIndex: "9000",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    rowGap: tokens.spacingVerticalS,
  },
  toggle: {
    boxShadow: tokens.shadow8,
  },
  /** 進行中を表す静的ドット (「アクティブ」を表現。動きは認知負荷になるため静止)。 */
  dot: {
    display: "inline-block",
    width: "8px",
    height: "8px",
    marginRight: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorNeutralForegroundInverted,
  },
  card: {
    width: "268px",
    rowGap: tokens.spacingVerticalM,
  },
  progress: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontWeight: tokens.fontWeightSemibold,
  },
  steps: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXS,
  },
  step: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  stepCurrent: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  marker: {
    flexShrink: 0,
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
  },
  markerDone: {
    color: tokens.colorBrandForeground1,
  },
  markerUpcoming: {
    color: tokens.colorNeutralForeground4,
  },
  /** 進行中工程のマーカー: 静的なブランド色のドット (動きは認知負荷になるため静止)。 */
  markerCurrent: {
    width: "18px",
    height: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  markerDot: {
    width: "10px",
    height: "10px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandForeground1,
  },
  /** 工程ラベル行: ラベルと状態バッジを横並びにする。 */
  labelRow: {
    display: "flex",
    alignItems: "center",
    columnGap: tokens.spacingHorizontalXS,
    flexWrap: "wrap",
  },
  label: {
    fontSize: tokens.fontSizeBase300,
  },
  labelDone: {
    color: tokens.colorNeutralForeground3,
  },
  labelCurrent: {
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  labelUpcoming: {
    color: tokens.colorNeutralForeground3,
  },
  /** 「次にやること」セクション。 */
  action: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalXS,
  },
  actionLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground3,
  },
  actionText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
  },
  /** 動的な対象名（日時付きジョブ名・データ名）のグレーチップ。文中でコントラストを付ける。 */
  chip: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    borderRadius: tokens.borderRadiusSmall,
    padding: `0 ${tokens.spacingHorizontalXS}`,
    fontWeight: tokens.fontWeightMedium,
    // 長い名前でも行内で自然に折り返せるように。
    wordBreak: "break-all",
  },
  /** 補助導線ボタン: 左寄せ・控えめ（主役は本文が指す実 UI）。標準の subtle 見た目を保つ。 */
  actionButton: {
    alignSelf: "flex-start",
  },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: tokens.spacingHorizontalS,
  },
});

/**
 * 開いている間だけ mount される進行カード。
 * ここで初めてジョブ状態 hook を呼ぶことで、polling をポップオーバー表示中に限定する。
 */
const GuideCard = (): JSX.Element | null => {
  const styles = useStyles();
  const {
    stage,
    modelMode,
    draftJobId,
    modelJobId,
    evaluationJobId,
    resumeState,
  } = useTutorial();
  const navigate = useNavigate();
  const location = useLocation();
  const goToResume = useResumeNavigate();
  // 現工程の対象ジョブ id（名寄せ=draft、モデル/推定=実行ジョブ、分析=なし）。
  const stageJobId =
    stage === "normalization"
      ? draftJobId
      : stage === "model"
        ? modelJobId
        : stage === "evaluation"
          ? evaluationJobId
          : null;
  const job = useGuideJobStatus(stageJobId);
  // 各工程の成果物名は参照 id から都度導出する（コピー保存しない・rename 追従）。
  const names = useGuideNames({
    normalizationJobId: draftJobId,
    modelJobId,
    evaluationJobId,
  });
  // 分析工程の進捗判定用: 進行中に入ったワークブックの対象シートのビュー件数を見る。
  // resume_state.analysis が無い（=WB未入場）なら sheetId は null で fetch はスキップされる。
  const analysisResume = resumeState?.stage === "analysis" ? resumeState : null;
  const { data: analysisViews } = useFetchResultViews({
    sheetId: analysisResume?.sheetId ?? null,
  });

  // 呼び出し元 (TutorialGuide) で非 null を保証済みだが、型を絞るためガードする。
  if (!stage) return null;

  const stageOrder = getStageOrder(modelMode);
  const total = stageOrder.length;
  const currentIndex = stageOrder.indexOf(stage);
  const isLast = getNextStage(stage, modelMode) === null;
  // その工程自身の画面にいるか（いる場合は「この工程を開く」導線を出さない）。
  const STAGE_SCREEN_PATH: Record<typeof stage, string> = {
    normalization: "normalization/create",
    model: "model/create",
    evaluation: "evaluation/create",
    analysis: "analysis",
  };
  const onStageScreen = location.pathname.includes(STAGE_SCREEN_PATH[stage]);

  // 名寄せウィザードの現在ステップ文脈（ウィザード内のステップ別コーチングに使う）。
  const normStep =
    resumeState?.stage === "normalization"
      ? { stepType: resumeState.stepType, stepTitle: resumeState.stepTitle }
      : null;

  // 分析の進捗文脈: WB編集へ入ったか（resume_state.analysis）とビュー件数で段階を出し分ける。
  const analysisStep =
    stage === "analysis"
      ? {
          inWorkbook: analysisResume != null,
          hasView: (analysisViews?.length ?? 0) > 0,
        }
      : null;

  // モデル未実行フォームのフィールド進捗（resume_state.model の autosave 値から導出）。
  const modelStep =
    resumeState?.stage === "model"
      ? {
          hasDataset: resumeState.datasetId != null,
          hasVariables: resumeState.variables.length > 0,
        }
      : null;

  // 推定未実行フォームのフィールド進捗（resume_state.evaluation.formValues.display から導出）。
  const evalDisplay =
    resumeState?.stage === "evaluation"
      ? (
          resumeState.formValues as {
            display?: {
              modelName?: string;
              normalizedDatasetNames?: string[];
              spatialFileName?: string;
              /** 地域集計フォームが表示中か（issue #1924）。旧 resume_state では undefined。 */
              showAreaForm?: boolean;
            };
          }
        ).display
      : undefined;
  const evalStep = evalDisplay
    ? {
        hasTarget: (evalDisplay.normalizedDatasetNames?.length ?? 0) > 0,
        hasModel: !!evalDisplay.modelName,
        hasAreaData: !!evalDisplay.spatialFileName,
        // 地域集計フォーム非表示のときは ③ ステップを飛ばす（明示 false のときのみ）
        areaFormHidden: evalDisplay.showAreaForm === false,
      }
    : null;

  const coaching = resolveStageCoaching(
    stage,
    job,
    names,
    onStageScreen,
    modelMode,
    {
      normalization: normStep,
      model: modelStep,
      evaluation: evalStep,
      analysis: analysisStep,
    },
  );
  const primary = coaching.action.primary;

  // 工程別の詳細／一覧ルート（viewDetail/viewList の遷移先解決に使う）。
  const detailRouteFor = (id: number): string => {
    switch (stage) {
      case "model":
        return ROUTES.JOB.DETAIL_ML(String(id));
      case "evaluation":
        return ROUTES.JOB.DETAIL_RESULT(String(id));
      default:
        return ROUTES.JOB.DETAIL_PREPROCESS(String(id));
    }
  };
  const listRouteFor = (): string => {
    switch (stage) {
      case "model":
        return ROUTES.MODEL.ROOT;
      case "evaluation":
        return ROUTES.EVALUATION.ROOT;
      default:
        return ROUTES.NORMALIZATION.ROOT;
    }
  };

  const runIntent = (intent: CoachIntent): void => {
    switch (intent.kind) {
      case "openEntry":
      case "continueInput":
        void goToResume();
        return;
      case "viewList":
        navigate(listRouteFor());
        return;
      case "viewDetail":
        if (stageJobId != null) navigate(detailRouteFor(stageJobId));
        return;
      case "handoffNext":
        tutorialStore.goToStage(intent.next);
        navigate(TUTORIAL_STAGES[intent.next].route);
        return;
    }
  };

  return (
    <Card className={styles.card}>
      {/* 状態セクション: 進捗 + ステッパー + 現工程バッジ */}
      <span className={styles.progress}>
        {t.stepLabel} {currentIndex + 1} / {total}
      </span>

      <div className={styles.steps}>
        {stageOrder.map((key, index) => {
          const info = TUTORIAL_STAGES[key];
          const status =
            index < currentIndex
              ? "done"
              : index === currentIndex
                ? "current"
                : "upcoming";

          return (
            <div
              key={key}
              className={mergeClasses(
                styles.step,
                status === "current" && styles.stepCurrent,
              )}
            >
              {status === "done" && (
                <CheckmarkCircleFilled
                  className={mergeClasses(styles.marker, styles.markerDone)}
                />
              )}
              {status === "current" && (
                <span className={styles.markerCurrent}>
                  <span className={styles.markerDot} />
                </span>
              )}
              {status === "upcoming" && (
                <CircleRegular
                  className={mergeClasses(styles.marker, styles.markerUpcoming)}
                />
              )}
              <span className={styles.labelRow}>
                <span
                  className={mergeClasses(
                    styles.label,
                    status === "done" && styles.labelDone,
                    status === "current" && styles.labelCurrent,
                    status === "upcoming" && styles.labelUpcoming,
                  )}
                >
                  {info.label}
                </span>
                {status === "current" && coaching.badge && (
                  <Badge
                    appearance="tint"
                    color={coaching.badge.tone}
                    size="small"
                  >
                    {coaching.badge.label}
                  </Badge>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <Divider />

      {/* 行動セクション: 次にやること（実 UI 名指し）+ 主アクション */}
      <div className={styles.action}>
        <span className={styles.actionLabel}>{t.coach.nextLabel}</span>
        <span className={styles.actionText}>
          {renderActionText(coaching.action.text, styles.chip)}
        </span>
        {primary && (
          // 主役は本文が指す実 UI。ポップオーバーのボタンは補助導線なので控えめ（subtle）に。
          <Button
            appearance="subtle"
            className={styles.actionButton}
            onClick={() => runIntent(primary.intent)}
            size="small"
          >
            {primary.label}
          </Button>
        )}
        {isLast && (
          <Button
            appearance="outline"
            onClick={() => tutorialStore.openComplete()}
          >
            {t.complete}
          </Button>
        )}
      </div>

      <Divider />
      <div className={styles.footer}>
        <Button
          appearance="subtle"
          onClick={() => tutorialStore.pause()}
          size="small"
        >
          {t.pause}
        </Button>
        <Button
          appearance="subtle"
          onClick={() => tutorialStore.openEndConfirm()}
          size="small"
        >
          {t.finish}
        </Button>
      </div>
    </Card>
  );
};

/** 開始前/中断/完了の入口ボタンのラベル（running はトグルが担うため除外）。 */
const ENTRY_LABELS: Record<Exclude<TutorialPhase, "running">, string> = {
  idle: t.entryStart,
  paused: t.entryResume,
  done: t.entryRestart,
};

/**
 * 右上常駐のガイド入口（ADR-0024）。
 * - running: 進捗トグル + ポップオーバー（次の一手を提示）
 * - idle/done: 起動ダイアログ、paused: 再開ダイアログ
 */
export const TutorialGuide = (): JSX.Element => {
  const styles = useStyles();
  const { phase, stage, modelMode, popoverOpen } = useTutorial();

  // 進行中（stage 確定時）: 進捗トグル + ポップオーバー。
  if (phase === "running" && stage) {
    const stageOrder = getStageOrder(modelMode);
    const total = stageOrder.length;
    const currentIndex = stageOrder.indexOf(stage);
    return (
      <div className={styles.container}>
        <Button
          appearance="primary"
          className={styles.toggle}
          icon={popoverOpen ? <ChevronUpRegular /> : <ChevronDownRegular />}
          iconPosition="after"
          onClick={() => tutorialStore.togglePopover()}
          size="small"
        >
          <span className={styles.dot} />
          {t.runningToggle} ({currentIndex + 1}/{total})
        </Button>

        {popoverOpen && <GuideCard />}
      </div>
    );
  }

  // 開始前 / 中断 / 完了: 右上に常駐する入口ボタン。
  const entryPhase = phase === "running" ? "idle" : phase;
  const handleEntry = (): void => {
    if (phase === "paused") tutorialStore.openResume();
    else tutorialStore.openLaunch(); // idle / done
  };
  return (
    <div className={styles.container}>
      <Button
        appearance="primary"
        className={styles.toggle}
        icon={<PlayCircleRegular />}
        onClick={handleEntry}
        size="small"
      >
        {ENTRY_LABELS[entryPhase]}
      </Button>
    </div>
  );
};
