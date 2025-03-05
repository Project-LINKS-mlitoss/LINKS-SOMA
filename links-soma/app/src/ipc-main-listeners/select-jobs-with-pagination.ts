import { type IpcMainInvokeEvent } from "electron";
import { desc, eq } from "drizzle-orm";
import { db } from "../utils/db";
import { jobs, type SelectJob } from "../schema";
import { type IpcMainListener } from ".";

type Params = {
  jobId?: SelectJob["id"];
  type?: SelectJob["type"];
  page?: number;
  limitPerPage?: number;
};

export const selectJobsWithPagination = (async (
  _event: IpcMainInvokeEvent,
  { jobId, type, page, limitPerPage }: Params,
): Promise<SelectJob[]> => {
  const currentPage = page ?? 1;
  const perPage = limitPerPage ?? 50;

  let query = db.select().from(jobs).$dynamic();

  if (jobId) {
    query = query.where(eq(jobs.id, jobId));
  }
  if (type) {
    query = query.where(eq(jobs.type, type));
  }

  // 作成日時の新しい順で並べる
  query = query.orderBy(desc(jobs.created_at));

  const offset = (currentPage - 1) * perPage;
  query = query.limit(perPage).offset(offset);

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
