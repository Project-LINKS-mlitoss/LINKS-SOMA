import { eq } from "drizzle-orm";
import { data_set_detail_areas, type SelectDataSetDetailArea } from "../schema";
import { db } from "../utils/db";
import { type IpcMainListener } from ".";

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
): Promise<SelectDataSetDetailArea[]> => {
  if (!dataSetResultId) return [];
  const offset = (page - 1) * limitPerPage;

  const result = await db
    .select()
    .from(data_set_detail_areas)
    .where(eq(data_set_detail_areas.data_set_result_id, dataSetResultId))
    .limit(limitPerPage)
    .offset(offset);

  return result;
}) satisfies IpcMainListener;
