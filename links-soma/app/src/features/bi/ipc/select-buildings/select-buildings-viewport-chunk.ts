import { and, asc, sql } from "drizzle-orm";
import { data_set_detail_buildings } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import type { BuildingQueryParamsWithViewportAndLastId } from "../../types";
import type { IpcMainListener } from "../../../../ipc-main-listeners";
import { conditionsBuilder } from "./_shared";

/**
 * 地図表示用の最小限のデータ型
 * WKT→GeoJSON変換はレンダラー側で行う
 */
export type MinimalBuildingData = {
  id: number;
  bldg_geometry: string | null;
  predicted_probability: number | null;
  lat_geocoding: number | null;
  lon_geocoding: number | null;
};

export const selectBuildingsViewportChunk = ((
  _: unknown,
  params: BuildingQueryParamsWithViewportAndLastId & { batchSize: number },
): MinimalBuildingData[] => {
  try {
    const conditions = conditionsBuilder(params);

    // ビューポート範囲での空間検索条件を追加（マージンなし）
    if (params.viewport) {
      const { minLng, minLat, maxLng, maxLat } = params.viewport;

      const spatialCondition = sql`(
        lat_geocoding BETWEEN ${minLat} AND ${maxLat} AND
        lon_geocoding BETWEEN ${minLng} AND ${maxLng}
      )`;

      conditions.push(spatialCondition);
    }

    // DBクエリ - 必要なカラムのみ選択
    const data = db
      .select({
        id: data_set_detail_buildings.id,
        bldg_geometry: data_set_detail_buildings.bldg_geometry,
        predicted_probability: data_set_detail_buildings.predicted_probability,
        lat_geocoding: data_set_detail_buildings.lat_geocoding,
        lon_geocoding: data_set_detail_buildings.lon_geocoding,
      })
      .from(data_set_detail_buildings)
      .where(and(...conditions))
      .orderBy(asc(data_set_detail_buildings.id))
      .limit(params.batchSize)
      .all();

    return data;
  } catch (error) {
    mainProcessLogger.error("Error fetching viewport data", error as Error);
    return [];
  }
}) satisfies IpcMainListener;
