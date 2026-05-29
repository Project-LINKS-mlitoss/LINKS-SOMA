import { and, count, eq } from "drizzle-orm";
import {
  data_set_detail_areas,
  data_set_detail_buildings,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type View } from "../../bi/types";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export const selectDataSetCount = (async (
  _: unknown,
  {
    dataSetResultId,
    unit,
  }: {
    dataSetResultId: View["dataSetResultId"];
    unit: View["unit"];
  },
): Promise<{ count: number }> => {
  try {
    const countQuery = db.select({ count: count() });

    switch (unit) {
      case "building": {
        const allCount = await countQuery
          .from(data_set_detail_buildings)
          .where(
            and(
              eq(data_set_detail_buildings.data_set_result_id, dataSetResultId),
            ),
          );
        return {
          count: allCount[0].count,
        };
      }
      case "area": {
        const allCount = await countQuery
          .from(data_set_detail_areas)
          .where(
            and(eq(data_set_detail_areas.data_set_result_id, dataSetResultId)),
          );
        return {
          count: allCount[0].count,
        };
      }
    }
  } catch (error) {
    mainProcessLogger.error(
      `Error in selectDataSetCount - dataSetResultId: ${dataSetResultId}, unit: ${unit}`,
      error as Error,
    );
    throw new Error("Failed to fetch data set count");
  }
}) satisfies IpcMainListener;
