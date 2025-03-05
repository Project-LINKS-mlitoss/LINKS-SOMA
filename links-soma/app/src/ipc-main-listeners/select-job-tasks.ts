import { type IpcMainInvokeEvent } from "electron";
import { eq } from "drizzle-orm";
import { db } from "../utils/db";
import { job_tasks, type SelectJobTask } from "../schema";
import { type IpcMainListener } from ".";

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
