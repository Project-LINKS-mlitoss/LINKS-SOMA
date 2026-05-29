import { eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { job_results, type SelectJobResult } from "../../../db/schema";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectJobResults = (async (
  _: unknown,
  { jobId }: { jobId: number },
): Promise<SelectJobResult | undefined> => {
  const result = db
    .select()
    .from(job_results)
    .where(eq(job_results.job_id, jobId))
    .get();

  return result;
}) satisfies IpcMainListener;
