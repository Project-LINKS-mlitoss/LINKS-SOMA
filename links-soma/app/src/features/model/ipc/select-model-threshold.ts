import { and, eq, sql } from "drizzle-orm";
import {
  job_tasks,
  model_files,
  type SelectModelFile,
} from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

type Params = {
  modelFileId: SelectModelFile["id"];
};

export type ModelThreshold = {
  /** 学習時に逆算された判定閾値（0.0〜1.0）。取得不可なら null */
  threshold: number | null;
  /** 閾値算出の前提となった再現率目標（0.0〜1.0）。取得不可なら null */
  recallTarget: number | null;
};

/**
 * モデルが学習時に保存した推奨閾値を取得する。
 * model_files → created_by_job_id → job_tasks.result(model_create) の経路で取得。
 *
 * 手動アップロードモデル・旧形式・非数値などで取得できない場合は null を返す。
 * 呼び出し側はこの null をもって「推奨閾値なし＝手動設定が必要」と判断する。
 */
export const selectModelThreshold = (async (
  _: unknown,
  { modelFileId }: Params,
): Promise<ModelThreshold> => {
  // 1 モデルジョブに複数 job_task がある場合に先頭が model_create とは限らないため、
  // taskResultType で明示的に絞り込む（result は JSON 列なので json_extract で参照）。
  const row = await db
    .select({ result: job_tasks.result })
    .from(model_files)
    .innerJoin(job_tasks, eq(job_tasks.job_id, model_files.created_by_job_id))
    .where(
      and(
        eq(model_files.id, modelFileId),
        sql`json_extract(${job_tasks.result}, '$.taskResultType') = 'model_create'`,
      ),
    )
    .get();

  // SQL 側で model_create に限定済み。TS 上の union 絞り込みのため再判定する。
  const result = row?.result;
  if (!result || result.taskResultType !== "model_create") {
    return { threshold: null, recallTarget: null };
  }

  // E021 が string で保存するため number 化する。NaN は取得不可として null に倒す。
  const toNumberOrNull = (value: string | undefined): number | null => {
    if (value == null) return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    threshold: toNumberOrNull(result.threshold),
    recallTarget: toNumberOrNull(result.recallTarget),
  };
}) satisfies IpcMainListener;
