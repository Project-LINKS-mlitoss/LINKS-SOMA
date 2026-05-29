import { and } from "drizzle-orm";
import { data_set_detail_buildings } from "../../../../db/schema";
import { db } from "../../../../db/client";
import {
  type FeatureData,
  type BuildingQueryParamsWithLastId,
} from "../../types";
import { buildFeatureBuildings } from "../../util";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../../ipc-main-listeners";
import { type BuildingProperties } from "../../components/views/map/map-container/_components/building-popup";
import { conditionsBuilder } from "./_shared";

export const selectBuildingsChunk = ((
  _: unknown,
  params: BuildingQueryParamsWithLastId & { batchSize: number },
): FeatureData<BuildingProperties>[] => {
  try {
    const conditions = conditionsBuilder(params);

    const data = db
      .select()
      .from(data_set_detail_buildings)
      .where(and(...conditions))
      .limit(params.batchSize)
      .all();

    const features: (FeatureData<BuildingProperties> | null)[] = data.map(
      buildFeatureBuildings,
    );
    return features.filter(
      (f): f is FeatureData<BuildingProperties> => f !== null,
    );
  } catch (error) {
    mainProcessLogger.error(
      `Error fetching buildings chunk - dataSetResultId: ${params.dataSetResultId}, referenceDate: ${params.referenceDate}, batchSize: ${params.batchSize}, lastId: ${params.lastId}`,
      error as Error,
    );
    return [];
  }
}) satisfies IpcMainListener;
