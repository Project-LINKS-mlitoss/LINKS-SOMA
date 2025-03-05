import { eq } from "drizzle-orm";
import {
  type InsertNormalizedDataSet,
  jobs,
  normalized_data_sets,
} from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

type Params = {
  insertParams: InsertNormalizedDataSet;
  jobId: number;
};
export const createNormalizedDatasets = (async (
  _: unknown,
  { insertParams: { file_path, file_name, job_results_id }, jobId }: Params,
): Promise<void> => {
  db.transaction((tx) => {
    tx.insert(normalized_data_sets)
      .values({
        file_name,
        file_path,
        job_results_id,
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
