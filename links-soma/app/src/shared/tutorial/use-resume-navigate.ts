/**
 * ガイドの「この工程を開く / 再開」を 1 箇所に集約したナビゲーション（ADR-0024）。
 *
 * 保存 state から復元先を解決し、名寄せは draft の存在を検証してから移動する
 * （削除済みなら工程入口へ降格＝dangling 参照のガード）。
 * ポップオーバーの主アクションと再開ダイアログの両方から使い、挙動を一本化する。
 */

import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { resolveResumeRoute, TUTORIAL_STAGES } from "./stages";
import { tutorialStore } from "./store";

export const useResumeNavigate = (): (() => Promise<void>) => {
  const navigate = useNavigate();

  return useCallback(async (): Promise<void> => {
    const { stage, draftJobId, resumeState } = tutorialStore.getState();
    let target = resolveResumeRoute({ stage, draftJobId, resumeState });

    // 名寄せの draft が削除済み / 下書きでなくなっていれば、壊れた URL に飛ばず工程入口へ降格する。
    // 位置依存の selectDraftJob（先頭1件）だと下書き複数時に別 job を拾って誤判定するため、
    // 対象 id を直接引く selectJob を使う（draft 単一の前提に依存しない）。
    if (stage === "normalization" && draftJobId != null) {
      const draft = await window.ipcRenderer.invoke("selectJob", {
        id: draftJobId,
      });
      if (!draft || draft.status !== "draft") {
        tutorialStore.setDraftJobId(null);
        target = TUTORIAL_STAGES.normalization.route;
      }
    }

    navigate(target);
  }, [navigate]);
};
