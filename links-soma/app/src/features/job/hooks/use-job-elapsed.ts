import { useFetchJobs } from "./use-fetch-jobs";
import { useFetchJobTasks } from "./use-fetch-job-tasks";

/**
 * 処理全体の実時間（秒、文字列）。ジョブ作成（プロセスspawn前）→ 全タスク完了。
 *
 * Python内タイマー（E021等のdatetime差分）はプロセス起動・ライブラリimportを
 * 取りこぼすため、ユーザーが実際に待つ時間とずれる。job.created_at と
 * job_tasks.finished_at の差で測ることで起動・import込みの実時間を回収する（NR007）。
 * 処理種別に依存しないため名寄せ・モデル構築・推定で共通に使える。
 */
export const useJobElapsedSec = (jobId: number): string | undefined => {
  const { data: job } = useFetchJobs(jobId);
  const { data: tasks } = useFetchJobTasks({ jobId });

  const start = job?.[0]?.created_at;
  if (!start || !tasks?.length) return undefined;

  const ends = tasks
    .map((t) => t.finished_at)
    .filter((x): x is string => !!x)
    .map((x) => Date.parse(x.replace(" ", "T")));
  if (!ends.length) return undefined;

  const sec = (Math.max(...ends) - Date.parse(start.replace(" ", "T"))) / 1000;
  return Number.isFinite(sec) && sec >= 0 ? String(sec) : undefined;
};
