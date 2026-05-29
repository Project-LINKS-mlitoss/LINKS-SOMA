import { type IpcMainInvokeEvent } from "electron";
import { and, count, desc, eq, ne, type SQL } from "drizzle-orm";
import { db } from "../../../db/client";
import { jobs, type SelectJob } from "../../../db/schema";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  jobId?: SelectJob["id"];
  type?: SelectJob["type"];
  page?: number;
  limitPerPage?: number;
  /** 下書きを除外するかどうか */
  excludeDraft?: boolean;
};

export type PaginatedJobsResponse = {
  data: SelectJob[];
  totalCount: number;
};

export const selectJobsWithPagination = (async (
  _event: IpcMainInvokeEvent,
  { jobId, type, page, limitPerPage, excludeDraft }: Params,
): Promise<PaginatedJobsResponse> => {
  const currentPage = page ?? 1;
  const perPage = limitPerPage ?? 50;

  const conditions: SQL[] = [];

  if (excludeDraft) {
    conditions.push(ne(jobs.status, "draft"));
  }
  if (jobId) {
    conditions.push(eq(jobs.id, jobId));
  }
  if (type) {
    conditions.push(eq(jobs.type, type));
  } else {
    // type未指定の場合、ウィザード内部処理用のjoin_checkを除外
    conditions.push(ne(jobs.type, "join_check"));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const offset = (currentPage - 1) * perPage;

  const [result, totalCountResult] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(whereClause)
      .orderBy(desc(jobs.created_at))
      .limit(perPage)
      .offset(offset),
    db.select({ count: count() }).from(jobs).where(whereClause),
  ]);

  const parsed = result.map((job) => {
    if (typeof job?.parameters === "string") {
      return {
        ...job,
        parameters: JSON.parse(job.parameters),
      };
    }
    return job;
  });

  return {
    data: parsed,
    totalCount: totalCountResult[0]?.count ?? 0,
  };
}) satisfies IpcMainListener;
