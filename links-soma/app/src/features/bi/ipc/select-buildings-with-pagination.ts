import { count, eq } from "drizzle-orm";
import {
  data_set_detail_buildings,
  type SelectDataSetDetailBuilding,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export type PaginatedBuildingsResponse = {
  data: SelectDataSetDetailBuilding[];
  totalCount: number;
};

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
): Promise<PaginatedBuildingsResponse> => {
  if (!dataSetResultId) return { data: [], totalCount: 0 };

  const offset = (page - 1) * limitPerPage;

  const [data, totalCountResult] = await Promise.all([
    db
      .select()
      .from(data_set_detail_buildings)
      .where(eq(data_set_detail_buildings.data_set_result_id, dataSetResultId))
      .limit(limitPerPage)
      .offset(offset),
    db
      .select({ count: count() })
      .from(data_set_detail_buildings)
      .where(eq(data_set_detail_buildings.data_set_result_id, dataSetResultId)),
  ]);

  return {
    data,
    totalCount: totalCountResult[0]?.count ?? 0,
  };
}) satisfies IpcMainListener;
