import { and, max } from "drizzle-orm";
import { data_set_detail_buildings } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { type BuildingQueryParams } from "../../types";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../../ipc-main-listeners";
import { conditionsBuilder } from "./_shared";

export const selectBuildingsLastId = ((
  _: unknown,
  params: BuildingQueryParams,
): number | null => {
  try {
    const conditions = conditionsBuilder(params);

    // 同じ条件で最大IDを取得
    const maxIdResult = db
      .select({ maxId: max(data_set_detail_buildings.id) })
      .from(data_set_detail_buildings)
      .where(and(...conditions))
      .get();

    return maxIdResult?.maxId ?? null;
  } catch (error) {
    mainProcessLogger.error(
      `Error fetching buildings last ID - dataSetResultId: ${params.dataSetResultId}, referenceDate: ${params.referenceDate}`,
      error as Error,
    );
    return null;
  }
}) satisfies IpcMainListener;
