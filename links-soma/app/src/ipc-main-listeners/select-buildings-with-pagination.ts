import { eq } from "drizzle-orm";
import {
  data_set_detail_buildings,
  type SelectDataSetDetailBuilding,
} from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

export const selectBuildingsWithPagination = (async (
  _: unknown,
  {
    dataSetResultId,
    page,
    limitPerPage,
  }: {
    dataSetResultId: SelectDataSetDetailBuilding["data_set_result_id"];
    page: number;
    limitPerPage: number;
  },
): Promise<SelectDataSetDetailBuilding[]> => {
  if (!dataSetResultId) return [];

  const offset = (page - 1) * limitPerPage;
  const result = await db
    .select()
    .from(data_set_detail_buildings)
    .where(eq(data_set_detail_buildings.data_set_result_id, dataSetResultId))
    .limit(limitPerPage)
    .offset(offset);

  return result;
}) satisfies IpcMainListener;
