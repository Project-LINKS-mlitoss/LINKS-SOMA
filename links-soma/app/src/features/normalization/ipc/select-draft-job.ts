import { eq, and } from "drizzle-orm";
import { db } from "../../../db/client";
import { jobs, type SelectJob } from "../../../db/schema";
import { type IpcMainListener } from "../../../ipc-main-listeners";

/**
 * 下書きjobを取得する
 * status="draft" かつ type="preprocess" のjobを取得
 * 1件制限なので単一またはnullを返す
 */
export const selectDraftJob = (async (): Promise<SelectJob | null> => {
  const draftJob = db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, "draft"), eq(jobs.type, "preprocess")))
    .get();

  return draftJob ?? null;
}) satisfies IpcMainListener;
