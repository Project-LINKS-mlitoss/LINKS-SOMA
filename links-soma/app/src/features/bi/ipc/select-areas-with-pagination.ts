import { count, eq } from "drizzle-orm";
import {
  data_set_detail_areas,
  type SelectDataSetDetailArea,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export type PaginatedAreasResponse = {
  data: SelectDataSetDetailArea[];
  totalCount: number;
};

export const selectAreasWithPagination = (async (
  _: unknown,
  {
    dataSetResultId,
    page,
    limitPerPage,
  }: {
    dataSetResultId: SelectDataSetDetailArea["data_set_result_id"];
    page: number;
    limitPerPage: number;
  },
): Promise<PaginatedAreasResponse> => {
  if (!dataSetResultId) return { data: [], totalCount: 0 };

  const offset = (page - 1) * limitPerPage;

  const [data, totalCountResult] = await Promise.all([
    db
      .select()
      .from(data_set_detail_areas)
      .where(eq(data_set_detail_areas.data_set_result_id, dataSetResultId))
      .limit(limitPerPage)
      .offset(offset),
    db
      .select({ count: count() })
      .from(data_set_detail_areas)
      .where(eq(data_set_detail_areas.data_set_result_id, dataSetResultId)),
  ]);

  return {
    data,
    totalCount: totalCountResult[0]?.count ?? 0,
  };
}) satisfies IpcMainListener;
