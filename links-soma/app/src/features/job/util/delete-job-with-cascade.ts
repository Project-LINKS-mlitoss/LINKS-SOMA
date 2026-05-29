import { eq } from "drizzle-orm";
import { type db } from "../../../db/client";
import { jobs, job_tasks, job_results } from "../../../db/schema";
import { deleteDataSetFile } from "../../dataset/util/delete-dataset-file";

/**
 * トランザクション内で使用するDB型
 */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * 単一のjobを削除する（関連するtasks, resultsも含む）
 *
 * @param tx - トランザクションオブジェクト
 * @param jobId - 削除対象のjobId
 */
export const deleteJobById = async (
  tx: Transaction,
  jobId: number,
): Promise<void> => {
  // 結果ファイルを削除
  const results = await tx
    .select()
    .from(job_results)
    .where(eq(job_results.job_id, jobId))
    .all();

  results.forEach((r) => {
    deleteDataSetFile(r.file_path);
  });

  // DB上のレコードを削除
  await tx.delete(job_results).where(eq(job_results.job_id, jobId)).run();
  await tx.delete(job_tasks).where(eq(job_tasks.job_id, jobId)).run();
  await tx.delete(jobs).where(eq(jobs.id, jobId)).run();
};
