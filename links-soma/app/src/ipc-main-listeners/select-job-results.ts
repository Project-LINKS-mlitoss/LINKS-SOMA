import { eq } from "drizzle-orm";
import { db } from "../utils/db";
import { job_results, type SelectJobResult } from "../schema";
import { type IpcMainListener } from ".";

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
