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
 * 推定再実行（FR022）のための、元 job の推定入力を復元する。
 *
 * 推定作成画面へ prefill 遷移する際に必要な入力一式を返す。
 * data_set_results → jobs → parameters（parameterType === "result"）の経路で取得する
 * （selectEstimationThreshold と同経路。あちらは threshold だけ、こちらは入力全体）。
 *
 * CSV インポート経由の結果は job_id が NULL（または parameters が result 型でない）ため
 * 復元できない。その場合は null を返し、UI 側でボタンを無効化させる。
 *
 * 注: threshold（settings.threshold）は本 IPC では返さない。再実行時の閾値は
 * 対話的調整で収束したおすすめ値を使うため、呼び出し側が別途渡す。
 */
export type EstimationParameters = {
  model_path: string;
  normalized_dataset_paths: string[];
  area_grouping: {
    path: string;
    columns: {
      area_group_id: string;
      area_group_name: string;
    };
  };
};

export const selectEstimationParameters = (async (
  _: unknown,
  { dataSetResultId }: Params,
): Promise<EstimationParameters | null> => {
  const result = await db
    .select({ parameters: jobs.parameters })
    .from(data_set_results)
    .innerJoin(jobs, eq(jobs.id, data_set_results.job_id))
    .where(eq(data_set_results.id, dataSetResultId))
    .get();

  if (!result?.parameters) return null;

  const params = result.parameters;
  if (params.parameterType !== "result") return null;

  return {
    model_path: params.model_path,
    normalized_dataset_paths: params.normalized_dataset_paths,
    area_grouping: params.area_grouping,
  };
}) satisfies IpcMainListener;
