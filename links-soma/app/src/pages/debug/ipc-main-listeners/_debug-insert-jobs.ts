import { type InsertJob, jobs, result_views } from "../../../schema";
import { db } from "../../../utils/db";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const _debugInsertJobs = (async (
  _: unknown,
  { type, parameters, is_named }: InsertJob,
): Promise<{ insertedId: number }> => {
  const res = await db
    .insert(jobs)
    .values({
      type,
      parameters,
      is_named,
    })
    .returning({
      insertedId: result_views.id,
    })
    .get();

  return res;
}) satisfies IpcMainListener;
