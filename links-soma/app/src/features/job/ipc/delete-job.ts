import { eq } from "drizzle-orm";
import { type DraftPreprocessParameters } from "../../../shared/types/job-parameters";
import { db } from "../../../db/client";
import { jobs, type SelectJob } from "../../../db/schema";
import { deleteJobById } from "../util/delete-job-with-cascade";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const deleteJob = (async (
  _: unknown,
  { id }: { id: SelectJob["id"] },
): Promise<void> => {
  await db.transaction(async (tx) => {
    // 削除対象のjobを取得
    const job = await tx.select().from(jobs).where(eq(jobs.id, id)).get();

    // draft jobの場合、紐づくjoinCheckJobも削除
    if (job?.status === "draft" && job.type === "preprocess") {
      const params = job.parameters as DraftPreprocessParameters;
      if (params.joinCheckJobId) {
        mainProcessLogger.info(
          `Deleting associated joinCheckJob: ${params.joinCheckJobId}`,
        );
        await deleteJobById(tx, params.joinCheckJobId);
      }
    }

    // 本体のjobを削除
    await deleteJobById(tx, id);
  });
}) satisfies IpcMainListener;
