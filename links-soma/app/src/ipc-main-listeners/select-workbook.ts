import { eq } from "drizzle-orm";
import { type SelectWorkbook, workbooks } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

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
