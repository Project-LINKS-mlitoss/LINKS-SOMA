import { eq } from "drizzle-orm";
import { type InsertModelFile, jobs, model_files } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  insertParams: InsertModelFile;
};
export const createModelFiles = (async (
  _: unknown,
  { insertParams: { file_path, file_name, created_by_job_id: jobId } }: Params,
): Promise<void> => {
  db.transaction((tx) => {
    tx.insert(model_files)
      .values({
        file_name,
        file_path,
        created_by_job_id: jobId,
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
