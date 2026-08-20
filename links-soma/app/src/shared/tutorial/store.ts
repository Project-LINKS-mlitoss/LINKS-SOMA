/**
 * ガイド（チュートリアル）動線の状態ストア (provider 不要の外部ストア)。
 *
 * サイドバーの開始ボタンと overlay が別ツリーから同じ状態を読むため、
 * useSyncExternalStore で購読する軽量シングルトンにする。
 *
 * 4 フェーズ (未開始/進行中/中断/完了) と現在 stage、加えて復元情報
 * (名寄せ draft 参照 + 現 stage の resume snapshot) を持つ。
 * 永続化は SQLite の tutorial_state テーブル (singleton)（ADR-0024）。読み取りはこのストアが
 * in-memory の正で、起動時に 1 回 SQLite から hydrate し、変更時に debounce して書き戻す。
 */

import { useSyncExternalStore } from "react";
import { type TutorialResumeState } from "../types/tutorial-resume";
import { rendererLogger } from "../utils/renderer-logger";

/** 一気通貫の工程 (名寄せ → モデル → 推定 → 分析)。 */
export type TutorialStage =
  | "normalization"
  | "model"
  | "evaluation"
  | "analysis";

/** 進行フェーズ。右上入口ボタンの 4 状態に対応。 */
export type TutorialPhase = "idle" | "running" | "paused" | "done";

/**
 * モデル構築の要否（開始時に選択）。
 * - build: 自前でモデルを構築する（名寄せで説明変数データが要る・モデル工程あり）
 * - generic: 汎用モデルを使う（モデル工程をスキップ）
 */
export type ModelMode = "build" | "generic";

export interface TutorialState {
  phase: TutorialPhase;
  stage: TutorialStage | null;
  /** モデル構築の要否 (開始時に選択。null は未選択)。工程順・必須データ・利用モデルを分岐。 */
  modelMode: ModelMode | null;
  /** 名寄せ stage の draft job 参照 (SSOT・上書きガード対象)。 */
  draftJobId: number | null;
  /** モデル stage の実行ジョブ参照 (進行状態バッジ用)。 */
  modelJobId: number | null;
  /** 推定 stage の実行ジョブ参照 (進行状態バッジ用)。 */
  evaluationJobId: number | null;
  /** 現 stage の復元ペイロード (model/evaluation snapshot, analysis の ids)。 */
  resumeState: TutorialResumeState | null;
  /** 起動ダイアログ */
  launchOpen: boolean;
  /** 再開確認ダイアログ */
  resumeOpen: boolean;
  /** 終了確認ダイアログ */
  endConfirmOpen: boolean;
  /** 完了ダイアログ */
  completeOpen: boolean;
  /** 進行中ポップオーバーの開閉 (右上トグルボタンで開閉) */
  popoverOpen: boolean;
}

const initialState: TutorialState = {
  phase: "idle",
  stage: null,
  modelMode: null,
  draftJobId: null,
  modelJobId: null,
  evaluationJobId: null,
  resumeState: null,
  launchOpen: false,
  resumeOpen: false,
  endConfirmOpen: false,
  completeOpen: false,
  // 既定は折りたたみ（ダイアログ・ポップオーバーは基本閉じる）。
  // 明示的な begin()/resume() のときだけ展開する。コールド起動で running を復元しても展開しない。
  popoverOpen: false,
};

/** SQLite に書き戻す対象のキー (ダイアログ開閉は一時状態なので含めない)。 */
const PERSISTED_KEYS = [
  "phase",
  "stage",
  "modelMode",
  "draftJobId",
  "modelJobId",
  "evaluationJobId",
  "resumeState",
] as const satisfies ReadonlyArray<keyof TutorialState>;

/** autosave のデバウンス。連続変更を 1 書き込みに束ねる (design-principles の地図デバウンス実績に準拠)。 */
const PERSIST_DEBOUNCE_MS = 300;

class TutorialStore {
  private state: TutorialState = initialState;
  private readonly listeners = new Set<() => void>();

  /** hydrate を適用済みか。二重適用と、ユーザー操作後の遅延 hydrate を防ぐ。 */
  private hydrated = false;
  /** ユーザー操作で永続フィールドが変化したか。true なら遅延 hydrate を捨てる。 */
  private mutated = false;

  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private persistInFlight = false;
  private persistQueued = false;

  constructor() {
    void this.hydrate();
  }

  getState = (): TutorialState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * 起動時に SQLite から 1 回だけ復元する。
   *
   * レンダラの module-load で走るため、main の IPC ハンドラ登録より早いと
   * "No handler registered" で失敗しうる（起動時の競合）。idempotent ガード
   * (mutated/hydrated) 済みなので、失敗時は登録完了を待って短いバックオフでリトライする。
   */
  private hydrate = async (attempt = 0): Promise<void> => {
    if (this.mutated || this.hydrated) return;
    try {
      const row = await window.ipcRenderer.invoke("selectTutorialState");
      // await 中にユーザーが操作 / 別の hydrate が適用していれば、古い値で上書きしない。
      if (this.mutated || this.hydrated) return;
      this.hydrated = true;
      if (!row) return;
      // "done"（完了）はそのセッション限りの表示状態。リロード時は idle に戻し、
      // 入口ボタンを「もう一度」でなく「ガイド」に戻す。完了が恒久的に残るのを防ぐ。
      // stage / job 参照 / resume_state も idle と整合するようクリアする。
      const isDone = row.phase === "done";
      this.state = {
        ...this.state,
        phase: isDone ? "idle" : row.phase,
        stage: isDone ? null : row.stage,
        modelMode: isDone ? null : row.model_mode,
        draftJobId: isDone ? null : row.draft_job_id,
        modelJobId: isDone ? null : row.model_job_id,
        evaluationJobId: isDone ? null : row.evaluation_job_id,
        resumeState: isDone ? null : row.resume_state,
      };
      this.listeners.forEach((listener) => listener());
    } catch (error) {
      // IPC 未登録（起動時競合）が主因。最大 ~3s リトライしてから諦める。
      if (attempt < 15) {
        setTimeout(() => void this.hydrate(attempt + 1), 200);
        return;
      }
      rendererLogger.error("Tutorial state hydrate failed", error);
    }
  };

  private set(next: Partial<TutorialState>): void {
    const prev = this.state;
    this.state = { ...prev, ...next };
    const persistedChanged = PERSISTED_KEYS.some(
      (key) => prev[key] !== this.state[key],
    );
    if (persistedChanged) {
      this.mutated = true;
      this.schedulePersist();
    }
    this.listeners.forEach((listener) => listener());
  }

  private schedulePersist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      void this.flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  }

  /**
   * SQLite へ書き戻す。直列化して、遅延した古い書き込みが新しい値を上書きしないようにする
   * (#1845 の fire-and-forget race 対策)。flush は常に最新 state を送る。
   */
  private async flushPersist(): Promise<void> {
    if (this.persistInFlight) {
      this.persistQueued = true;
      return;
    }
    this.persistInFlight = true;
    try {
      await window.ipcRenderer.invoke("updateTutorialState", {
        phase: this.state.phase,
        stage: this.state.stage,
        modelMode: this.state.modelMode,
        draftJobId: this.state.draftJobId,
        modelJobId: this.state.modelJobId,
        evaluationJobId: this.state.evaluationJobId,
        resumeState: this.state.resumeState,
      });
    } catch (error) {
      rendererLogger.error("Tutorial state persist failed", error);
    } finally {
      this.persistInFlight = false;
      if (this.persistQueued) {
        this.persistQueued = false;
        void this.flushPersist();
      }
    }
  }

  openLaunch = (): void => this.set({ launchOpen: true });
  closeLaunch = (): void => this.set({ launchOpen: false });

  /** 起動の「始める」: モデル構築の要否を確定し、名寄せ工程から開始。 */
  begin = (modelMode: ModelMode): void =>
    this.set({
      phase: "running",
      stage: "normalization",
      modelMode,
      draftJobId: null,
      modelJobId: null,
      evaluationJobId: null,
      resumeState: null,
      launchOpen: false,
      popoverOpen: true,
    });

  /** 進行中ポップオーバーの開閉トグル。 */
  togglePopover = (): void =>
    this.set({ popoverOpen: !this.state.popoverOpen });

  /** 進行中ポップオーバーを開く（サイドバー「続きへ」等から）。 */
  openPopover = (): void => this.set({ popoverOpen: true });

  /** 次工程へのハンドオフ。stage が変わるので前 stage の resume snapshot はクリアする。 */
  goToStage = (stage: TutorialStage): void =>
    this.set({ stage, resumeState: null });

  /** 名寄せ stage の draft 参照を記録する。 */
  setDraftJobId = (draftJobId: number | null): void => this.set({ draftJobId });

  /** モデル stage の実行ジョブ参照を記録する（構築開始時）。 */
  setModelJobId = (modelJobId: number | null): void => this.set({ modelJobId });

  /** 推定 stage の実行ジョブ参照を記録する（推定開始時）。 */
  setEvaluationJobId = (evaluationJobId: number | null): void =>
    this.set({ evaluationJobId });

  /** 現 stage の復元 snapshot を記録する (autosave)。 */
  setResumeState = (resumeState: TutorialResumeState | null): void =>
    this.set({ resumeState });

  /** 中断 (進行状態は保持)。 */
  pause = (): void => this.set({ phase: "paused" });

  openResume = (): void => this.set({ resumeOpen: true });
  closeResume = (): void => this.set({ resumeOpen: false });
  /** 再開: 中断地点から進行に戻す。 */
  resume = (): void =>
    this.set({ phase: "running", resumeOpen: false, popoverOpen: true });

  openEndConfirm = (): void => this.set({ endConfirmOpen: true });
  closeEndConfirm = (): void => this.set({ endConfirmOpen: false });

  openComplete = (): void => this.set({ completeOpen: true });
  closeComplete = (): void => this.set({ completeOpen: false });
  /** 完了: フェーズを done に。 */
  complete = (): void => this.set({ phase: "done", completeOpen: false });

  /** 初期状態に戻す (終了 / 破棄)。singleton 行は残し、永続フィールドを idle/null に。 */
  reset = (): void => this.set({ ...initialState });
}

export const tutorialStore = new TutorialStore();

/** チュートリアル状態を購読する hook。 */
export const useTutorial = (): TutorialState =>
  useSyncExternalStore(tutorialStore.subscribe, tutorialStore.getState);

if (import.meta.vitest) {
  const { describe, it, expect, vi, beforeEach, afterEach } = import.meta
    .vitest;

  describe("TutorialStore: フェーズ/工程のライフサイクル遷移", () => {
    // 永続化（window.ipcRenderer.invoke）は状態遷移の対象外。fresh インスタンスの
    // 同期的な state 遷移だけを検証するため、IPC はモックし debounce タイマーは進めない。
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("window", {
        ipcRenderer: {
          invoke: vi.fn().mockResolvedValue(null),
          writeRendererLogs: vi.fn().mockResolvedValue(undefined),
        },
      });
    });
    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    const fresh = (): TutorialStore => new TutorialStore();

    it("begin は running・名寄せ開始・modelMode 確定、job参照/resumeをクリアしポップオーバーを開く", () => {
      const s = fresh();
      s.begin("build");
      const st = s.getState();
      expect(st.phase).toBe("running");
      expect(st.stage).toBe("normalization");
      expect(st.modelMode).toBe("build");
      expect(st.draftJobId).toBeNull();
      expect(st.resumeState).toBeNull();
      expect(st.popoverOpen).toBe(true);
    });

    it("goToStage は stage を進め resumeState をクリアする（前工程snapshotの持ち越し防止）", () => {
      const s = fresh();
      s.begin("build");
      s.setResumeState({ stage: "normalization", step: 2 });
      s.goToStage("model");
      expect(s.getState().stage).toBe("model");
      expect(s.getState().resumeState).toBeNull();
    });

    it("pause は phase=paused、進行情報(stage/job参照)は保持する", () => {
      const s = fresh();
      s.begin("build");
      s.setDraftJobId(5);
      s.pause();
      const st = s.getState();
      expect(st.phase).toBe("paused");
      expect(st.stage).toBe("normalization");
      expect(st.draftJobId).toBe(5);
    });

    it("resume は paused から running に戻しポップオーバーを開く", () => {
      const s = fresh();
      s.begin("build");
      s.pause();
      s.resume();
      const st = s.getState();
      expect(st.phase).toBe("running");
      expect(st.popoverOpen).toBe(true);
      expect(st.resumeOpen).toBe(false);
    });

    it("complete は phase=done、完了ダイアログを閉じる", () => {
      const s = fresh();
      s.begin("build");
      s.openComplete();
      s.complete();
      expect(s.getState().phase).toBe("done");
      expect(s.getState().completeOpen).toBe(false);
    });

    it("reset は全永続フィールドを idle/null に戻す", () => {
      const s = fresh();
      s.begin("build");
      s.setDraftJobId(9);
      s.setModelJobId(3);
      s.goToStage("model");
      s.reset();
      const st = s.getState();
      expect(st.phase).toBe("idle");
      expect(st.stage).toBeNull();
      expect(st.modelMode).toBeNull();
      expect(st.draftJobId).toBeNull();
      expect(st.modelJobId).toBeNull();
      expect(st.evaluationJobId).toBeNull();
      expect(st.resumeState).toBeNull();
    });

    it("job参照 setter は各工程のジョブidだけを更新する", () => {
      const s = fresh();
      s.begin("build");
      s.setDraftJobId(1);
      s.setModelJobId(2);
      s.setEvaluationJobId(3);
      const st = s.getState();
      expect(st.draftJobId).toBe(1);
      expect(st.modelJobId).toBe(2);
      expect(st.evaluationJobId).toBe(3);
    });

    it("subscribe したリスナは状態変化で通知され、unsubscribe 後は通知されない", () => {
      const s = fresh();
      const listener = vi.fn();
      const unsub = s.subscribe(listener);
      s.begin("build");
      expect(listener).toHaveBeenCalled();
      unsub();
      const callsBefore = listener.mock.calls.length;
      s.pause();
      expect(listener.mock.calls.length).toBe(callsBefore);
    });
  });
}
