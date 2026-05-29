import { eq } from "drizzle-orm";
import { data_set_detail_buildings } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { type FeatureData } from "../../types";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../../ipc-main-listeners";
import { buildFeatureBuildings } from "../../util";

export const selectBuilding = ((
  _: unknown,
  params: {
    dataSetDetailBuildingsId: number;
  },
): FeatureData | null => {
  try {
    const data = db
      .select()
      .from(data_set_detail_buildings)
      .where(eq(data_set_detail_buildings.id, params.dataSetDetailBuildingsId))
      .get();

    const feature: FeatureData | null = data
      ? buildFeatureBuildings(data)
      : null;
    return feature || null;
  } catch (error) {
    mainProcessLogger.error(
      `Error fetching single building - dataSetDetailBuildingsId: ${params.dataSetDetailBuildingsId}`,
      error as Error,
    );
    return null;
  }
}) satisfies IpcMainListener;
