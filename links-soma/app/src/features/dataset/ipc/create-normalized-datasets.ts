import { eq } from "drizzle-orm";
import {
  type InsertNormalizedDataSet,
  jobs,
  normalized_data_sets,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  insertParams: InsertNormalizedDataSet;
  jobId: number;
};
export const createNormalizedDatasets = (async (
  _: unknown,
  { insertParams: { file_path, file_name, job_results_id }, jobId }: Params,
): Promise<void> => {
  db.transaction((tx) => {
    // 目的はジョブパラメータ（名寄せ設定）を単一ソースとして引き継ぐ。
    const job = tx
      .select({ parameters: jobs.parameters })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .get();
    const purpose =
      job?.parameters.parameterType === "preprocess"
        ? job.parameters.settings.purpose
        : null;

    tx.insert(normalized_data_sets)
      .values({
        file_name,
        file_path,
        job_results_id,
        purpose,
      })
      .run();
    tx.update(jobs)
      .set({
        is_named: true,
      })
      .where(eq(jobs.id, jobId))
      .run();
  });
}) satisfies IpcMainListener;
