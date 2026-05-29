import { eq } from "drizzle-orm";
import { type SelectWorkbook, workbooks } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectWorkbook = (async (
  _: unknown,
  { id }: { id: number },
): Promise<SelectWorkbook | undefined> => {
  const data = await db
    .select()
    .from(workbooks)
    .where(eq(workbooks.id, id))
    .get();

  return data;
}) satisfies IpcMainListener;
