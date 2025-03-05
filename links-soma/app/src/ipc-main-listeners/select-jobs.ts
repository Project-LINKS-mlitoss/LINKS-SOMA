import { type IpcMainInvokeEvent } from "electron";
import { desc, eq } from "drizzle-orm";
import { db } from "../utils/db";
import { jobs, type SelectJob } from "../schema";
import { type IpcMainListener } from ".";

type Params = {
  jobId?: SelectJob["id"];
  type?: SelectJob["type"];
};
export const selectJobs = (async (
  _: IpcMainInvokeEvent,
  { jobId, type }: Params,
): Promise<SelectJob[]> => {
  let query = db.select().from(jobs).$dynamic();
  if (jobId) {
    query = query.where(eq(jobs.id, jobId));
  }
  if (type) {
    query = query.where(eq(jobs.type, type));
  }
  query = query.orderBy(desc(jobs.created_at));

  const result = await query;

  const parsed = result.map((job) => {
    if (typeof job?.parameters === "string") {
      return {
        ...job,
        parameters: JSON.parse(job.parameters),
      };
    }
    return job;
  });

  return parsed;
}) satisfies IpcMainListener;
