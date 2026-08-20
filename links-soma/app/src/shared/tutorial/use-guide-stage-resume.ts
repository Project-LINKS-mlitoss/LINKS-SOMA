/**
 * ガイド進行中の工程フォームを「中断/離脱→復元」できるようにする共有フック（ADR-0024）。
 *
 * - rehydrate: mount 時に 1 回だけ、保存 snapshot をフォームへ適用する（apply）。
 * - autosave: フォーム変更 (deps) を debounce して tutorial_state へ snapshot 保存する（takeSnapshot）。
 *
 * ガード:
 * - ガイドが該当 stage で running の時だけ動く（通常利用では何もしない＝guide-scoped）。
 * - rehydrate 完了まで autosave しない（空フォームで保存値を上書きする競合を防ぐ）。
 * - rehydrate は mount あたり 1 回（unmount/remount で入力中の値を上書きしない）。
 */

import { useEffect, useRef, type DependencyList } from "react";
import { type TutorialResumeState } from "../types/tutorial-resume";
import { tutorialStore, type TutorialStage } from "./store";

/** autosave のデバウンス（連続変更を 1 保存に束ねる）。 */
const AUTOSAVE_DEBOUNCE_MS = 400;

export function useGuideStageResume(params: {
  stage: TutorialStage;
  /** 保存 snapshot をフォームへ適用する（非同期可）。snapshot.stage は params.stage と一致する。 */
  apply: (snapshot: TutorialResumeState) => void | Promise<void>;
  /** 現在のフォームから snapshot を作る。 */
  takeSnapshot: () => TutorialResumeState;
  /** autosave のトリガとなるフォーム値。 */
  deps: DependencyList;
}): void {
  const { stage, apply, takeSnapshot, deps } = params;

  // mount あたり 1 回だけ rehydrate を起動するためのフラグ。
  const rehydrateStarted = useRef(false);
  // rehydrate の適用が完了したか。完了するまで autosave を止める。
  const rehydrateDone = useRef(false);

  useEffect(() => {
    if (rehydrateStarted.current) return;
    const s = tutorialStore.getState();
    if (s.phase !== "running" || s.stage !== stage) return;
    rehydrateStarted.current = true;

    const snapshot = s.resumeState;
    if (!snapshot || snapshot.stage !== stage) {
      rehydrateDone.current = true;
      return;
    }
    void Promise.resolve(apply(snapshot)).finally(() => {
      rehydrateDone.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount 時 1 回のみ実行する rehydrate。apply/stage は安定前提のため依存に含めない
  }, []);

  useEffect(() => {
    const s = tutorialStore.getState();
    if (s.phase !== "running" || s.stage !== stage) return;
    if (!rehydrateDone.current) return;
    const timer = setTimeout(() => {
      tutorialStore.setResumeState(takeSnapshot());
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autosave のトリガはフォーム値 deps のみ。takeSnapshot/stage は安定前提のため含めない
  }, deps);
}
