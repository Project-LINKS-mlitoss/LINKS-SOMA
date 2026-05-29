import { eq } from "drizzle-orm";
import {
  data_set_detail_buildings,
  data_set_results,
  type SelectDataSetResult,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const deleteDataSetResult = (async (
  _: unknown,
  {
    id,
  }: {
    id: SelectDataSetResult["id"];
  },
): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx.delete(data_set_results).where(eq(data_set_results.id, id));
    await tx
      .delete(data_set_detail_buildings)
      .where(eq(data_set_detail_buildings.data_set_result_id, id));
    await tx
      .delete(data_set_detail_buildings)
      .where(eq(data_set_detail_buildings.data_set_result_id, id));
  });
}) satisfies IpcMainListener;
