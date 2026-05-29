import { and, count } from "drizzle-orm";
import { data_set_detail_buildings } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { type BuildingQueryParamsWithLastId } from "../../types";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../../ipc-main-listeners";
import { conditionsBuilder } from "./_shared";

export const selectBuildingsCount = ((
  _: unknown,
  params: BuildingQueryParamsWithLastId,
): number | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- lastIdはカウントには不要
    const { lastId: _, ...excludeLastId } = params;
    const conditions = conditionsBuilder(excludeLastId);

    // 同じ条件で最大IDを取得
    const result = db
      .select({ count: count() })
      .from(data_set_detail_buildings)
      .where(and(...conditions))
      .get();

    return result?.count ?? null;
  } catch (error) {
    mainProcessLogger.error(
      `Error fetching buildings count - dataSetResultId: ${params.dataSetResultId}, referenceDate: ${params.referenceDate}`,
      error as Error,
    );
    return null;
  }
}) satisfies IpcMainListener;
