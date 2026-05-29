import { eq } from "drizzle-orm";
import { data_set_detail_areas } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { type FeatureData } from "../../types";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../../ipc-main-listeners";
import { buildFeatureAreas } from "../../util";

export const selectArea = ((
  _: unknown,
  params: {
    dataSetDetailAreasId: number;
  },
): FeatureData | null => {
  try {
    const data = db
      .select()
      .from(data_set_detail_areas)
      .where(eq(data_set_detail_areas.id, params.dataSetDetailAreasId))
      .get();

    const feature: FeatureData | null = data ? buildFeatureAreas(data) : null;
    return feature || null;
  } catch (error) {
    mainProcessLogger.error(
      `Error fetching single area - dataSetDetailAreasId: ${params.dataSetDetailAreasId}`,
      error as Error,
    );
    return null;
  }
}) satisfies IpcMainListener;
