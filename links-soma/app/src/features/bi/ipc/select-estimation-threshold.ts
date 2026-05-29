import { eq } from "drizzle-orm";
import {
  data_set_results,
  jobs,
  type SelectDataSetResult,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  dataSetResultId: SelectDataSetResult["id"];
};

/**
 * 推定実行時に使用された閾値を取得する
 * data_set_results → jobs → parameters.settings.threshold の経路で取得
 * @returns 閾値（0.0〜1.0）。取得不可の場合はnull
 */
export const selectEstimationThreshold = (async (
  _: unknown,
  { dataSetResultId }: Params,
): Promise<number | null> => {
  const result = await db
    .select({ parameters: jobs.parameters })
    .from(data_set_results)
    .innerJoin(jobs, eq(jobs.id, data_set_results.job_id))
    .where(eq(data_set_results.id, dataSetResultId))
    .get();

  if (!result?.parameters) return null;

  const params = result.parameters;
  if (params.parameterType === "result") {
    return params.settings.threshold;
  }

  return null;
}) satisfies IpcMainListener;
