import { eq } from "drizzle-orm";
import { jobs, job_tasks, job_results, type SelectJob } from "../schema";
import { db } from "../utils/db";
import { deleteDataSetFile } from "../utils/delete-dataset-file";
import { type IpcMainListener } from ".";

export const deleteJob = (async (
  _: unknown,
  { id }: { id: SelectJob["id"] },
): Promise<void> => {
  await db.transaction(async (tx) => {
    const results = await tx
      .select()
      .from(job_results)
      .where(eq(job_results.job_id, id))
      .all();

    results.forEach((r) => {
      deleteDataSetFile(r.file_path);
    });

    await tx.delete(job_results).where(eq(job_results.job_id, id)).run();

    await tx.delete(job_tasks).where(eq(job_tasks.job_id, id)).run();

    await tx.delete(jobs).where(eq(jobs.id, id)).run();
  });
}) satisfies IpcMainListener;
