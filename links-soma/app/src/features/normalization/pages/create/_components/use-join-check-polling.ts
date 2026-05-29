/**
 * 住所の表記ゆれチェックのポーリングロジックを管理するカスタムフック
 *
 * @description
 * - IPCでジョブのタスク一覧を定期的に取得
 * - 各タスクの完了状態を監視し、結果を更新
 * - エラー発生時のハンドリングを提供
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { type SelectJobTask, type SelectJob } from "../../../../../db/schema";
import { type JoinCheckTarget } from "../../../../../shared/types/job-parameters";
import { rendererLogger } from "../../../../../shared/utils/renderer-logger";
import { type JoinResult, type TaskStatus } from "./types-join-check";

/** ポーリング間隔（ミリ秒） */
const POLLING_INTERVAL = 1000;

type UseJoinCheckPollingProps = {
  /** 全タスク完了時のコールバック */
  onComplete: (results: JoinResult[]) => void;
  /** エラー発生時のコールバック（部分成功の場合はresultsも渡される） */
  onError: (message: string, partialResults?: JoinResult[]) => void;
};

type UseJoinCheckPollingReturn = {
  /** ポーリング中かどうか */
  isPolling: boolean;
  /** 現在の結果 */
  results: JoinResult[];
  /** 結果を直接設定（初期化用） */
  setResults: React.Dispatch<React.SetStateAction<JoinResult[]>>;
  /** ポーリングを開始 */
  startPolling: (jobId: number, targets: JoinCheckTarget[]) => void;
  /** ポーリングを停止 */
  stopPolling: () => void;
  /** 現在のジョブID */
  currentJobId: number | null;
};

export const useJoinCheckPolling = ({
  onComplete,
  onError,
}: UseJoinCheckPollingProps): UseJoinCheckPollingReturn => {
  const [results, setResults] = useState<JoinResult[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentJobIdRef = useRef<number | null>(null);

  // コンポーネントアンマウント時にポーリングを停止
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * ポーリングを停止
   */
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    currentJobIdRef.current = null;
    setIsPolling(false);
  }, []);

  /**
   * タスク一覧から結果を構築
   */
  const buildResultsFromTasks = useCallback(
    (tasks: SelectJobTask[], targets: JoinCheckTarget[]): JoinResult[] => {
      return targets.map((target) => {
        // JoinCheckTaskResult型のタスクを検索
        const task = tasks.find((t) => {
          if (!t.result) return false;
          if (t.result.taskResultType !== "join_check") return false;
          return t.result.target === target;
        });

        // 完了したタスクの結果を取得
        if (task?.result && task.result.taskResultType === "join_check") {
          const taskResult = task.result;
          return {
            target,
            status: "complete" as TaskStatus,
            unmatchedRecords: taskResult.unmatchedRecords,
          };
        }

        // 未完了のタスク
        const completedCount = tasks.filter((t) => t.result).length;
        const currentIndex = targets.indexOf(target);
        const isRunning = currentIndex === completedCount;

        return {
          target,
          status: isRunning ? ("running" as TaskStatus) : "pending",
          unmatchedRecords: [],
        };
      });
    },
    [],
  );

  /**
   * ポーリングを開始
   */
  const startPolling = useCallback(
    (jobId: number, targets: JoinCheckTarget[]) => {
      // 既存のポーリングを停止
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      currentJobIdRef.current = jobId;
      setIsPolling(true);

      pollingIntervalRef.current = setInterval(() => {
        void (async () => {
          if (!currentJobIdRef.current) {
            stopPolling();
            return;
          }

          try {
            // ジョブのタスク一覧を取得
            const tasks = (await window.ipcRenderer.invoke(
              "selectJobTasks",
              currentJobIdRef.current,
            )) as SelectJobTask[];

            // タスク結果から状態を更新
            const updatedResults = buildResultsFromTasks(tasks, targets);
            setResults(updatedResults);

            // 全て完了したかチェック
            const allComplete = updatedResults.every(
              (r) => r.status === "complete",
            );
            if (allComplete) {
              stopPolling();
              onComplete(updatedResults);
              return;
            }

            // ジョブがエラー状態かチェック
            const job = (await window.ipcRenderer.invoke("selectJob", {
              id: currentJobIdRef.current,
            })) as SelectJob | null;

            if (job && job.status === "error") {
              stopPolling();

              const errorTask = tasks.find((t) => t.error_msg);
              const errorMessage =
                errorTask?.error_msg ?? "不明なエラーが発生しました。";

              rendererLogger.error(
                "住所の表記ゆれチェックでエラーが発生しました",
                undefined,
                { jobId: currentJobIdRef.current, errorMessage },
              );

              // 未完了のタスクにエラー状態を設定
              const resultsWithError = updatedResults.map((r) => {
                if (r.status === "pending" || r.status === "running") {
                  return { ...r, status: "error" as TaskStatus, errorMessage };
                }
                return r;
              });
              setResults(resultsWithError);

              // 成功したタスクがあるかチェック
              const completedCount = updatedResults.filter(
                (r) => r.status === "complete",
              ).length;

              if (completedCount > 0) {
                onError(errorMessage, resultsWithError);
              } else {
                onError(errorMessage);
              }
            }
          } catch (e) {
            rendererLogger.error(
              "ポーリング中にエラーが発生しました",
              e as Error,
            );
            stopPolling();
            onError("住所の表記ゆれチェックの状態取得中にエラーが発生しました。");
          }
        })();
      }, POLLING_INTERVAL);
    },
    [stopPolling, onComplete, onError, buildResultsFromTasks],
  );

  return {
    isPolling,
    results,
    setResults,
    startPolling,
    stopPolling,
    currentJobId: currentJobIdRef.current,
  };
};
