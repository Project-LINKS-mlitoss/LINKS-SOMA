/**
 * ガイドが参照する各工程の成果物名を、参照ジョブ id から都度取得する hook（ADR-0024）。
 *
 * 名前はコピー保存せず、main の selectGuideNames で保存先テーブルから引く。
 * rename にも追従する。
 * SWR は使わず直 IPC + pub/sub（#1845 の stale 罠回避、既存方針と統一）。
 */

import { useState, useEffect, useCallback } from "react";
import { type GuideNames } from "../types/tutorial-resume";
import { subscribeJobChanged } from "../../features/job/hooks/job-change-notifier";

const EMPTY: GuideNames = {
  normalization: null,
  model: null,
  evaluation: null,
};

type Ids = {
  normalizationJobId: number | null;
  modelJobId: number | null;
  evaluationJobId: number | null;
};

export const useGuideNames = ({
  normalizationJobId,
  modelJobId,
  evaluationJobId,
}: Ids): GuideNames => {
  const [names, setNames] = useState<GuideNames>(EMPTY);

  const fetch = useCallback(async (): Promise<void> => {
    const result = (await window.ipcRenderer.invoke("selectGuideNames", {
      normalizationJobId,
      modelJobId,
      evaluationJobId,
    })) as GuideNames;
    setNames(result);
  }, [normalizationJobId, modelJobId, evaluationJobId]);

  // 初回 + ジョブ変更通知（保存・rename 等）で再取得。
  useEffect(() => {
    void fetch();
    return subscribeJobChanged(() => void fetch());
  }, [fetch]);

  return names;
};
