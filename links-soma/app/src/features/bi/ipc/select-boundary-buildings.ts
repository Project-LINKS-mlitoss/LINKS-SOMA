import { eq } from "drizzle-orm";
import { db } from "../../../db/client";
import {
  data_set_detail_buildings,
  type SelectDataSetDetailBuilding,
} from "../../../db/schema";
import { type IpcMainListener } from "../../../ipc-main-listeners";

export interface SelectBoundaryBuildingsParams {
  dataSetResultId: number;
  // probability は 0〜100 のパーセント値。内部で /100 して predicted_probability(0〜1) と比較する
  probability: number;
  limit: number;
  excludeIds?: number[];
}

type SelectBoundaryBuildingsResponse = SelectDataSetDetailBuilding[];

export const selectBoundaryBuildings = (async (
  _: unknown,
  {
    dataSetResultId,
    probability,
    limit,
    excludeIds = [],
  }: SelectBoundaryBuildingsParams,
): Promise<SelectBoundaryBuildingsResponse> => {
  const target = probability / 100;
  const excludeSet = new Set(excludeIds);

  // abs 並びは drizzle で表現しづらいため、対象 data_set_result_id 分を全件取得して JS で近傍ソートする
  // (1自治体分の件数のため許容)。select() 無指定で full row を取得するのは select-building の作法と同じ。
  const rows = await db
    .select()
    .from(data_set_detail_buildings)
    .where(eq(data_set_detail_buildings.data_set_result_id, dataSetResultId))
    .all();

  const candidates = rows.filter(
    (row) => row.predicted_probability !== null && !excludeSet.has(row.id),
  );

  candidates.sort((a, b) => {
    const distA = Math.abs((a.predicted_probability ?? 0) - target);
    const distB = Math.abs((b.predicted_probability ?? 0) - target);
    if (distA !== distB) return distA - distB;
    return a.id - b.id;
  });

  return candidates.slice(0, limit);
}) satisfies IpcMainListener;
