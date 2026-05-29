import { and, count, sql } from "drizzle-orm";
import { data_set_detail_buildings } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import { type BuildingQueryParamsWithViewport } from "../../types";
import { type IpcMainListener } from "../../../../ipc-main-listeners";
import { conditionsBuilder } from "./_shared";

export const selectBuildingsViewportCount = ((
  _: unknown,
  params: BuildingQueryParamsWithViewport,
): number => {
  try {
    const conditions = conditionsBuilder(params);

    // ビューポート範囲での空間検索条件を追加（マージンなし）
    // Note: selectBuildingsViewportChunk と同じ条件で統一
    if (params.viewport) {
      const { minLng, minLat, maxLng, maxLat } = params.viewport;

      const spatialCondition = sql`(
        lat_geocoding BETWEEN ${minLat} AND ${maxLat} AND
        lon_geocoding BETWEEN ${minLng} AND ${maxLng}
      )`;

      conditions.push(spatialCondition);
    }

    const result = db
      .select({ count: count() })
      .from(data_set_detail_buildings)
      .where(and(...conditions))
      .get();

    return result?.count || 0;
  } catch (error) {
    mainProcessLogger.error("Error counting viewport data", error as Error);
    return 0;
  }
}) satisfies IpcMainListener;
