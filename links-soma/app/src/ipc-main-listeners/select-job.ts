import { type IpcMainInvokeEvent } from "electron";
import { eq } from "drizzle-orm";
import { db } from "../utils/db";
import { jobs, type SelectJob } from "../schema";
import { type IpcMainListener } from ".";

export const selectJob = (async (
  _: IpcMainInvokeEvent,
  { id }: { id: SelectJob["id"] },
): Promise<SelectJob | undefined> => {
  const result = await db.select().from(jobs).where(eq(jobs.id, id)).get();

  // Pythonから送られてくるデータはstringなので、JSON.parseする
  if (typeof result?.parameters === "string") {
    return {
      ...result,
      parameters: JSON.parse(result.parameters),
    };
  }

  return result;
}) satisfies IpcMainListener;
