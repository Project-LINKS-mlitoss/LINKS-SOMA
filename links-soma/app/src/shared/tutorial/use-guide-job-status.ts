/**
 * ガイドが参照中のジョブ（名寄せ draft_job_id）の状態を取得する hook（ADR-0024）。
 *
 * 進行中ポップオーバーで「処理中/完了/エラー」を反映するために使う。
 *
 * 鮮度の方針（#1845 の SWR stale 罠を避ける）:
 * - SWR を使わず local state + 直 IPC + pub/sub（既存 useFetchJobsWithPagination と同型）
 * - アプリにはバックグラウンド完了の push が無く、一覧も polling しない設計のため、
 *   「処理中(status="")の間だけ」軽い polling で完了を反映する。完了/エラー/離脱で停止。
 * - この hook はポップオーバーを開いている間だけ mount される想定なので、
 *   polling もその間に限定される（閉じれば unmount され停止）。
 */

import { useState, useEffect, useCallback } from "react";
import { type SelectJob } from "../../db/schema";
import { subscribeJobChanged } from "../../features/job/hooks/job-change-notifier";

/** 処理中の間だけの polling 間隔（ms）。 */
const POLL_MS = 4000;

export const useGuideJobStatus = (jobId: number | null): SelectJob | null => {
  const [job, setJob] = useState<SelectJob | null>(null);

  const fetch = useCallback(async (): Promise<void> => {
    if (jobId == null) {
      setJob(null);
      return;
    }
    const result = (await window.ipcRenderer.invoke("selectJob", {
      id: jobId,
    })) as SelectJob | undefined;
    setJob(result ?? null);
  }, [jobId]);

  // 初回 + ジョブ変更通知（保存・削除等のユーザー操作起点）で再取得。
  useEffect(() => {
    void fetch();
    return subscribeJobChanged(() => void fetch());
  }, [fetch]);

  // 処理中（status === ""）の間だけ polling で完了を反映する。
  useEffect(() => {
    if (jobId == null || job?.status !== "") return;
    const timer = setInterval(() => void fetch(), POLL_MS);
    return () => clearInterval(timer);
  }, [jobId, job?.status, fetch]);

  return job;
};
