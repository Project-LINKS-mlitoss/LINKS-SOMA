import {
  type InsertJob,
  type InsertModelFile,
  job_tasks,
  jobs,
  model_files,
  type SelectModelFile,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type ModelCreateTaskResult } from "../../../shared/types/job-task-result";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const insertModelFile = (async (
  _: unknown,
  values: {
    file_name: InsertModelFile["file_name"];
    file_path: InsertModelFile["file_path"];
    job_task_result?: ModelCreateTaskResult;
  },
): Promise<{
  insertedId: SelectModelFile["id"];
}> => {
  /** モデルファイルと性能結果が紐づけられるように便宜的にjobsを作成する */
  return await db.transaction(async (tx) => {
    const job = tx
      .insert(jobs)
      .values(_jobValue)
      .returning({ id: jobs.id })
      .get();

    const result = tx
      .insert(model_files)
      .values({
        ...values,
        created_by_job_id: job.id,
      })
      .returning({
        insertedId: model_files.id,
      })
      .get();

    if (values.job_task_result) {
      tx.insert(job_tasks)
        .values({
          job_id: job.id,
          result: values.job_task_result,
        })
        .run();
    }

    return result;
  });
}) satisfies IpcMainListener;

const _jobValue: InsertJob = {
  type: "ml",
  status: "complete",
  is_named: true,
  parameters: {
    parameterType: "ml",
    input_path: "",
    database_path: "",
    settings: {
      advanced: {},
      explanatory_variables: [],
    },
  },
};
