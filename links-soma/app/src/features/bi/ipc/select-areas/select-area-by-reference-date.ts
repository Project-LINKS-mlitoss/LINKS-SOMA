import { and, eq } from "drizzle-orm";
import { data_set_detail_areas } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { type FeatureData } from "../../types";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../../ipc-main-listeners";
import { buildFeatureAreas } from "../../util";

/**
 * 同一地域（area_group + key_code）を別の推定基準日で取得する。
 * 推定日フィルターを切り替えたとき、開いているポップアップを新しい推定日の
 * 同一対象へ差し替えるために使う。該当がなければ null（＝非表示）。
 */
export const selectAreaByReferenceDate = ((
  _: unknown,
  params: {
    dataSetResultId: number;
    areaGroup: string;
    keyCode: string;
    referenceDate: string;
  },
): FeatureData | null => {
  try {
    const data = db
      .select()
      .from(data_set_detail_areas)
      .where(
        and(
          eq(data_set_detail_areas.data_set_result_id, params.dataSetResultId),
          eq(data_set_detail_areas.area_group, params.areaGroup),
          eq(data_set_detail_areas.key_code, params.keyCode),
          eq(data_set_detail_areas.reference_date, params.referenceDate),
        ),
      )
      .get();

    return data ? buildFeatureAreas(data) : null;
  } catch (error) {
    mainProcessLogger.error(
      `Error fetching area by reference date - date: ${params.referenceDate}`,
      error as Error,
    );
    return null;
  }
}) satisfies IpcMainListener;
