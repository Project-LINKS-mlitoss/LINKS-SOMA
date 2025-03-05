import { and, eq, gt, or } from "drizzle-orm";
import {
  data_set_detail_buildings,
  type SelectDataSetDetailBuilding,
} from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const selectBuildingsInBatches = ((
  _: unknown,
  {
    dataSetResultId,
    referenceDate,
    batchSize,
    lastId,
    areas,
  }: {
    dataSetResultId: number;
    batchSize: number;
    referenceDate?: string;
    lastId?: number;
    areas?: string[];
  },
): SelectDataSetDetailBuilding[] | null => {
  try {
    const result = db
      .select()
      .from(data_set_detail_buildings)
      .where(
        and(
          eq(data_set_detail_buildings.data_set_result_id, dataSetResultId),
          referenceDate
            ? eq(data_set_detail_buildings.reference_date, referenceDate)
            : undefined,
          lastId ? gt(data_set_detail_buildings.id, lastId) : undefined,
          areas && areas.length > 0
            ? or(
                ...areas.map((area) =>
                  eq(data_set_detail_buildings.area_group, area),
                ),
              )
            : undefined,
        ),
      )
      .limit(batchSize)
      .all();
    return result;
  } catch (error) {
    console.error("Error fetching data: ", error);
    return null;
  }
}) satisfies IpcMainListener;
