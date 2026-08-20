import { and, eq } from "drizzle-orm";
import { data_set_detail_buildings } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { type FeatureData } from "../../types";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../../ipc-main-listeners";
import { buildFeatureBuildings } from "../../util";

/**
 * 同一建物（normalized_address）を別の推定基準日で取得する。
 * 推定日フィルターを切り替えたとき、開いているポップアップを新しい推定日の
 * 同一対象へ差し替えるために使う。該当がなければ null（＝非表示）。
 */
export const selectBuildingByReferenceDate = ((
  _: unknown,
  params: {
    dataSetResultId: number;
    normalizedAddress: string;
    referenceDate: string;
  },
): FeatureData | null => {
  try {
    const data = db
      .select()
      .from(data_set_detail_buildings)
      .where(
        and(
          eq(
            data_set_detail_buildings.data_set_result_id,
            params.dataSetResultId,
          ),
          eq(
            data_set_detail_buildings.normalized_address,
            params.normalizedAddress,
          ),
          eq(data_set_detail_buildings.reference_date, params.referenceDate),
        ),
      )
      .get();

    return data ? buildFeatureBuildings(data) : null;
  } catch (error) {
    mainProcessLogger.error(
      `Error fetching building by reference date - date: ${params.referenceDate}`,
      error as Error,
    );
    return null;
  }
}) satisfies IpcMainListener;
