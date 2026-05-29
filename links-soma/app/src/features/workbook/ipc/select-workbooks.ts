import { desc } from "drizzle-orm";
import { type SelectWorkbook, workbooks } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectWorkbooks = (async (): Promise<SelectWorkbook[]> => {
  const all = await db
    .select()
    .from(workbooks)
    .orderBy(desc(workbooks.created_at));

  return all;
}) satisfies IpcMainListener;
