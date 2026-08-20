/**
 * 対話的閾値調整（FR022）。
 *
 * 判定境界付近の建物を数件ずつ「空き家として扱うか」回答させ、両方向二分探索でおすすめ閾値に
 * 近づける。各プローブで現在の確率帯（5%刻みグリッド）に近い建物を最大 3 件取得し、
 * 多数決の結果で探索範囲を狭める。収束後、反映方法を 2 通り提示する（Notion データフロー準拠）:
 * - 閾値カラム切替: 推定はやり直さず view の threshold パラメータを切り替える（実機能・即時）。
 * - 推定ステップ再実行: 収束閾値と元 job の入力（model_path / normalized_dataset_paths /
 *   area_grouping）を引き継ぎ、推定作成画面へ prefill 遷移する（FR022）。ワンクリック実行ではなく、
 *   ユーザーが内容確認のうえ「推定開始」を押す既存フローに合流させる。元 job の入力が復元できない
 *   （CSV インポート由来で job_id NULL 等）場合はボタンを無効化し理由を提示する。
 *
 * モデル適合閾値の自動算出・標準フォーマット出力は本スコープ外（ML 中心のため別途）。
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  makeStyles,
  tokens,
  Dialog,
  DialogTrigger,
  Spinner,
  Text,
} from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import {
  Button,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from "../../../../../shared/components/ui";
import { lang } from "../../../../../shared/config/lang";
import { ROUTES } from "../../../../../shared/config/routes";
import { type EvaluationPrefillState } from "../../../../evaluation/hooks/use-form-data-evaluate";
import { THRESHOLD_VALUES } from "../../../types/schema/parameter";
import {
  useFetchEstimationThreshold,
  useFetchEstimationParameters,
} from "../../../hooks";
import type { SelectDataSetDetailBuilding } from "../../../../../db/schema";
import { type SelectBoundaryBuildingsParams } from "../../../ipc/select-boundary-buildings";
import { rendererLogger } from "../../../../../shared/utils/renderer-logger";
import { BuildingJudgmentCard } from "./building-judgment-card";

const t = lang.components["threshold-assistant"];

type Judgment = "vacant" | "not";

/** 5% 刻みのグリッド（[5, 10, ..., 95]）。探索はこの index 上で行う。 */
const GRID: readonly number[] = THRESHOLD_VALUES;
/** 開始確率が取得できないときのデフォルト（45% 相当）。 */
const DEFAULT_PROB = 45;
/** 1 プローブで判定する件数。 */
const PROBE_SIZE = 3;

/** prob(%) に最も近いグリッド index を返す。 */
const nearestGridIdx = (prob: number): number => {
  let best = 0;
  let bestDist = Infinity;
  GRID.forEach((g, i) => {
    const d = Math.abs(g - prob);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
};

/** 探索 1 ステップ分のスナップショット（戻る用）。 */
type Snapshot = {
  loIdx: number;
  hiIdx: number;
  currentIdx: number;
  excludeIds: number[];
};

const useStyles = makeStyles({
  surface: {
    // 建物カード3件（各3セクション）が収まる意図的な固定幅。狭い画面では viewport に追従。
    width: "640px",
    maxWidth: "92vw",
  },
  intro: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalM,
    display: "block",
  },
  stepHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    columnGap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalS,
  },
  stepHeading: {
    fontWeight: tokens.fontWeightSemibold,
  },
  progress: {
    color: tokens.colorNeutralForeground3,
  },
  prompt: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalM,
    display: "block",
  },
  cards: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalM,
  },
  hint: {
    color: tokens.colorNeutralForeground3,
  },
  centerState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    rowGap: tokens.spacingVerticalM,
    padding: `${tokens.spacingVerticalXXL} 0`,
  },
  navRow: {
    display: "flex",
    columnGap: tokens.spacingHorizontalS,
  },
  suggested: {
    display: "flex",
    alignItems: "baseline",
    columnGap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalL}`,
    marginTop: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  suggestedValue: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
  },
  convergedPanel: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalM,
  },
  reapply: {
    display: "flex",
    flexDirection: "column",
    rowGap: tokens.spacingVerticalS,
  },
  // ボタンは内容幅に（縦 flex の既定 stretch だと 640px 全幅バーになり崩れて見える）。
  reapplyButton: {
    alignSelf: "flex-start",
  },
  reapplyHeading: {
    fontWeight: tokens.fontWeightSemibold,
  },
});

export const ThresholdAssistant = ({
  dataSetResultId,
  onApply,
}: {
  dataSetResultId: number | null | undefined;
  /** 閾値カラム切替で反映するコールバック（view の threshold パラメータ設定＋保存）。 */
  onApply: (value: string) => void | Promise<void>;
}): JSX.Element => {
  const styles = useStyles();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // 推定実行時の閾値（0〜1）。開始 index の決定に使う。
  const { data: estimationThreshold } = useFetchEstimationThreshold({
    dataSetResultId,
  });

  // 推定再実行のための元 job 入力（model_path / normalized_dataset_paths / area_grouping）。
  // 復元不可（CSV インポート由来で job_id NULL 等）なら null → 再実行ボタンを無効化する。
  const { data: estimationParameters } = useFetchEstimationParameters({
    dataSetResultId,
  });

  // 探索状態
  const [loIdx, setLoIdx] = useState(-1); // 最後に「非空き家」と判定した index
  const [hiIdx, setHiIdx] = useState(GRID.length); // 最後に「空き家」と判定した index
  const [currentIdx, setCurrentIdx] = useState(0);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [excludeIds, setExcludeIds] = useState<number[]>([]);

  // 現在プローブの建物と各判定
  const [buildings, setBuildings] = useState<SelectDataSetDetailBuilding[]>([]);
  const [judgments, setJudgments] = useState<
    Record<number, Judgment | undefined>
  >({});
  const [loading, setLoading] = useState(false);
  const [converged, setConverged] = useState(false);
  const [step, setStep] = useState(1);

  // 開始 index（estimationThreshold が来たら算出。null は DEFAULT_PROB 相当）。
  const startIdx = nearestGridIdx(
    estimationThreshold != null ? estimationThreshold * 100 : DEFAULT_PROB,
  );

  // 現在の確率帯の建物を取得する。
  const loadProbe = useCallback(
    async (idx: number, currentExcludeIds: number[]): Promise<void> => {
      if (dataSetResultId == null) {
        setBuildings([]);
        return;
      }
      setLoading(true);
      setJudgments({});
      try {
        const params: SelectBoundaryBuildingsParams = {
          dataSetResultId,
          probability: GRID[idx],
          limit: PROBE_SIZE,
          excludeIds: currentExcludeIds,
        };
        const rows = (await window.ipcRenderer.invoke(
          "selectBoundaryBuildings",
          params,
        )) as SelectDataSetDetailBuilding[];
        setBuildings(rows);
      } catch (error) {
        rendererLogger.error(
          "閾値調整の境界建物取得に失敗しました",
          error instanceof Error ? error : new Error(String(error)),
          { dataSetResultId },
        );
        setBuildings([]);
      } finally {
        setLoading(false);
      }
    },
    [dataSetResultId],
  );

  // 探索を初期状態にして最初のプローブを読み込む。
  const start = useCallback((): void => {
    setLoIdx(-1);
    setHiIdx(GRID.length);
    setCurrentIdx(startIdx);
    setHistory([]);
    setExcludeIds([]);
    setConverged(false);
    setStep(1);
    void loadProbe(startIdx, []);
  }, [startIdx, loadProbe]);

  // ダイアログを開いたときに探索を開始する。
  useEffect(() => {
    if (open) start();
    // start は startIdx に依存するため open 変化時のみ実行する
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open 変化時のみ探索を初期化する意図
  }, [open]);

  const close = (): void => {
    setOpen(false);
  };

  // 多数決で verdict を決め、探索範囲を狭めて次のプローブへ。
  const handleNext = (): void => {
    const judged = buildings
      .map((b) => judgments[b.id])
      .filter((v): v is Judgment => v != null);
    const vacantCount = judged.filter((v) => v === "vacant").length;
    const notCount = judged.filter((v) => v === "not").length;
    // 同数は vacant 寄りに倒す（vacant数 >= not数）。
    const verdict: Judgment = vacantCount >= notCount ? "vacant" : "not";

    // 戻る用に現在状態を保存
    const snapshot: Snapshot = { loIdx, hiIdx, currentIdx, excludeIds };

    let nextLo = loIdx;
    let nextHi = hiIdx;
    if (verdict === "vacant") {
      nextHi = currentIdx;
    } else {
      nextLo = currentIdx;
    }

    const nextExcludeIds = [...excludeIds, ...buildings.map((b) => b.id)];

    // 範囲の中点（lo < idx < hi）。範囲が空なら収束。
    if (nextLo + 1 >= nextHi) {
      setLoIdx(nextLo);
      setHiIdx(nextHi);
      setHistory((prev) => [...prev, snapshot]);
      setExcludeIds(nextExcludeIds);
      setConverged(true);
      setBuildings([]);
      return;
    }

    const nextIdx = Math.floor((nextLo + nextHi) / 2);
    setLoIdx(nextLo);
    setHiIdx(nextHi);
    setCurrentIdx(nextIdx);
    setHistory((prev) => [...prev, snapshot]);
    setExcludeIds(nextExcludeIds);
    setStep((prev) => prev + 1);
    void loadProbe(nextIdx, nextExcludeIds);
  };

  // 履歴を 1 つ戻して直前状態のプローブを再読込。
  const handleBack = (): void => {
    const prev = history[history.length - 1];
    if (prev == null) return;
    setHistory((h) => h.slice(0, -1));
    setLoIdx(prev.loIdx);
    setHiIdx(prev.hiIdx);
    setCurrentIdx(prev.currentIdx);
    setExcludeIds(prev.excludeIds);
    setConverged(false);
    setStep((s) => Math.max(1, s - 1));
    void loadProbe(prev.currentIdx, prev.excludeIds);
  };

  // 収束結果。hiIdx が末尾のままなら一度も vacant が無く、据え置き（null）。
  const suggested: number | null = hiIdx < GRID.length ? GRID[hiIdx] : null;

  const handleApplyColumn = async (): Promise<void> => {
    if (suggested == null) return;
    await onApply(String(suggested));
    close();
  };

  // 復元可能か（収束おすすめ閾値があり、かつ元 job 入力が取れている）。
  const canRerun = suggested != null && estimationParameters != null;

  // 収束した閾値で推定作成画面へ prefill 遷移する（ワンクリック実行ではない）。
  // suggested は %（例: 65）なのでフォームの 0〜1 スケールへ /100 して渡す。
  // 着地後はユーザーが内容確認のうえ「推定開始」を押す既存フローに合流する。
  const handleApplyRerun = (): void => {
    if (suggested == null || estimationParameters == null) return;
    const state: EvaluationPrefillState = {
      evaluationPrefill: {
        form: {
          model_path: estimationParameters.model_path,
          normalized_dataset_paths:
            estimationParameters.normalized_dataset_paths,
          area_grouping: estimationParameters.area_grouping,
          settings: { threshold: suggested / 100 },
        },
      },
    };
    close();
    navigate(ROUTES.EVALUATION.CREATE, { state });
  };

  // 全件に判定が付いたら「次へ」可能（建物 0 件のときは押せない）。
  const allJudged =
    buildings.length > 0 && buildings.every((b) => judgments[b.id] != null);

  return (
    <Dialog
      onOpenChange={(_, data) => (data.open ? setOpen(true) : close())}
      open={open}
    >
      <DialogTrigger disableButtonEnhancement>
        <Button appearance="outline" size="small">
          {t.openButton}
        </Button>
      </DialogTrigger>
      <DialogSurface className={styles.surface}>
        <DialogBody>
          <DialogTitle
            action={
              <DialogTrigger action="close">
                <Button
                  appearance="subtle"
                  aria-label={t.close}
                  icon={<Dismiss24Regular />}
                />
              </DialogTrigger>
            }
          >
            {t.dialogTitle}
          </DialogTitle>
          <DialogContent>
            <Text className={styles.intro} size={200}>
              {t.introBinary}
            </Text>

            {loading ? (
              <div className={styles.centerState}>
                <Spinner label={t.loading} size="small" />
              </div>
            ) : converged ? (
              <div className={styles.convergedPanel}>
                {suggested != null ? (
                  <div className={styles.suggested}>
                    <span>{t.suggestedLabel}</span>
                    <span className={styles.suggestedValue}>{suggested}%</span>
                  </div>
                ) : (
                  <Text className={styles.hint} size={200}>
                    {t.noVacant}
                  </Text>
                )}
                <div className={styles.reapply}>
                  <span className={styles.reapplyHeading}>
                    {t.reapplyHeading}
                  </span>
                  <Button
                    appearance="primary"
                    className={styles.reapplyButton}
                    disabled={suggested == null}
                    onClick={handleApplyColumn}
                  >
                    {t.applyColumn}
                  </Button>
                  <Text className={styles.hint} size={200}>
                    {t.applyColumnHint}
                  </Text>
                  {/* 推定再実行: 収束閾値＋元 job 入力を引き継ぎ推定作成画面へ prefill 遷移する。
                      元 job の入力が復元できない（CSV インポート由来等）場合は無効化し理由を示す。 */}
                  <Button
                    appearance="outline"
                    className={styles.reapplyButton}
                    disabled={!canRerun}
                    onClick={handleApplyRerun}
                  >
                    {t.applyRerun}
                  </Button>
                  <Text className={styles.hint} size={200}>
                    {estimationParameters == null
                      ? t.applyRerunUnavailableHint
                      : t.applyRerunHint}
                  </Text>
                </div>
              </div>
            ) : buildings.length === 0 ? (
              <div className={styles.centerState}>
                <Text className={styles.hint} size={200}>
                  {t.noData}
                </Text>
              </div>
            ) : (
              <>
                <div className={styles.stepHeader}>
                  <span className={styles.stepHeading}>
                    {t.stepHeading.replace("{prob}", String(GRID[currentIdx]))}
                  </span>
                  <Text className={styles.progress} size={200}>
                    {t.progress.replace("{step}", String(step))}
                  </Text>
                </div>
                <Text className={styles.prompt} size={200}>
                  {t.judgePrompt
                    .replace("{prob}", String(GRID[currentIdx]))
                    .replace("{count}", String(buildings.length))}
                </Text>
                <div className={styles.cards}>
                  {buildings.map((building) => (
                    <BuildingJudgmentCard
                      key={building.id}
                      building={building}
                      onChange={(v) =>
                        setJudgments((prev) => ({
                          ...prev,
                          [building.id]: v,
                        }))
                      }
                      value={judgments[building.id]}
                    />
                  ))}
                </div>
                <Text className={styles.hint} size={200}>
                  {t.majorityHint}
                </Text>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <div className={styles.navRow}>
              <Button
                appearance="subtle"
                disabled={history.length === 0 || loading}
                onClick={handleBack}
              >
                {t.back}
              </Button>
              <Button appearance="subtle" disabled={loading} onClick={start}>
                {t.restart}
              </Button>
              {!converged && (
                <Button
                  appearance="primary"
                  disabled={!allJudged || loading}
                  onClick={handleNext}
                >
                  {t.next}
                </Button>
              )}
            </div>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
