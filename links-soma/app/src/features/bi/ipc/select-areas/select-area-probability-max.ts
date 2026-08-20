import { eq, max } from "drizzle-orm";
import { data_set_detail_areas } from "../../../../db/schema";
import { db } from "../../../../db/client";
import { mainProcessLogger } from "../../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../../ipc-main-listeners";
import { type View } from "../../types";

/**
 * area の推定空き家割合（predicted_probability）のデータセット全体の最大値。
 * レンジスライダーの目盛り上限をデータ分布に合わせるために使う（割合は building と違い上限が一定でない）。
 */
export const selectAreaProbabilityMax = ((
  _: unknown,
  { dataSetResultId }: { dataSetResultId: View["dataSetResultId"] },
): number | null => {
  try {
    const result = db
      .select({ max: max(data_set_detail_areas.predicted_probability) })
      .from(data_set_detail_areas)
      .where(eq(data_set_detail_areas.data_set_result_id, dataSetResultId))
      .get();

    return result?.max ?? null;
  } catch (error) {
    mainProcessLogger.error(
      "Error fetching area probability max",
      error as Error,
    );
    return null;
  }
}) satisfies IpcMainListener;
