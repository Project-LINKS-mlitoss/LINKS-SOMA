import { and, asc } from "drizzle-orm";
import { data_set_detail_areas } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import type {
  FeatureData,
  AreaQueryParamsWithViewportAndLastId,
} from "../../types";
import { buildFeatureAreas } from "../../util";
import type { IpcMainListener } from "../../../../ipc-main-listeners";
import { conditionsBuilder } from "./_shared";

export const selectAreasViewportChunk = ((
  _: unknown,
  params: AreaQueryParamsWithViewportAndLastId & { batchSize: number },
): FeatureData[] => {
  try {
    const conditions = conditionsBuilder(params);

    // 地域データは緯度・経度フィールドがないため、
    // WKT geometryによる精密フィルタリングのみを使用

    const data = db
      .select()
      .from(data_set_detail_areas)
      .where(and(...conditions))
      .orderBy(asc(data_set_detail_areas.id))
      .limit(params.batchSize)
      .all();

    const features: (FeatureData | null)[] = data.map(buildFeatureAreas);
    const result = features.filter((f): f is FeatureData => f !== null);

    return result;
  } catch (error) {
    mainProcessLogger.error(
      "Error fetching area viewport data",
      error as Error,
    );
    return [];
  }
}) satisfies IpcMainListener;
