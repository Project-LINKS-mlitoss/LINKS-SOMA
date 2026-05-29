import { type IpcMainInvokeEvent } from "electron";
import { eq } from "drizzle-orm";
import { db } from "../../../db/client";
import { job_tasks, type SelectJobTask } from "../../../db/schema";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectJobTasks = (async (
  _: IpcMainInvokeEvent,
  jobId: SelectJobTask["job_id"],
): Promise<SelectJobTask[]> => {
  const result = await db
    .select()
    .from(job_tasks)
    .where(eq(job_tasks.job_id, jobId));
  return result;
}) satisfies IpcMainListener;
