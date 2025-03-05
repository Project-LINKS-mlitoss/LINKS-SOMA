import { eq } from "drizzle-orm";
import { type InsertModelFile, jobs, model_files } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

type Params = {
  insertParams: InsertModelFile;
  jobId: number;
};
export const createModelFiles = (async (
  _: unknown,
  { insertParams: { file_path, file_name }, jobId }: Params,
): Promise<void> => {
  db.transaction((tx) => {
    tx.insert(model_files)
      .values({
        file_name,
        file_path,
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
