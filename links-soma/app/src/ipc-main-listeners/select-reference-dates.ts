import { eq, desc } from "drizzle-orm";
import {
  data_set_detail_buildings,
  type SelectDataSetDetailBuilding,
  type SelectDataSetResult,
} from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export type ReferenceDate = SelectDataSetDetailBuilding["reference_date"];

/**
 * "2020-01-01" などの日付を配列で取得する
 */
export const selectReferenceDates = (async (
  _: unknown,
  { dataSetResultId }: { dataSetResultId: SelectDataSetResult["id"] },
): Promise<ReferenceDate[]> => {
  const result = await db
    .selectDistinct({
      reference_date: data_set_detail_buildings.reference_date,
    })
    .from(data_set_detail_buildings)
    .where(eq(data_set_detail_buildings.data_set_result_id, dataSetResultId))
    .orderBy(desc(data_set_detail_buildings.reference_date));

  return result.map((r) => r.reference_date);
}) satisfies IpcMainListener;
