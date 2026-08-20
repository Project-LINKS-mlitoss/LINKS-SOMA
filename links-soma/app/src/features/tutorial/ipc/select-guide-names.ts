import { desc, eq } from "drizzle-orm";
import { db } from "../../../db/client";
import {
  data_set_results,
  job_results,
  model_files,
  normalized_data_sets,
} from "../../../db/schema";
import { type GuideNames } from "../../../shared/types/tutorial-resume";
import { type IpcMainListener } from "../../../ipc-main-listeners";

/**
 * ガイドが参照する各工程の成果物の「最新の名前」を、参照ジョブ id から都度導出する（ADR-0024）。
 *
 * 名前はコピー保存せず、保存先テーブルから引く。
 * これにより、後からデータ名をリネームしてもコーチング表示が追従する（SSOT）。
 * - 名寄せ: 名寄せジョブ → job_results → normalized_data_sets.file_name
 * - モデル: ml ジョブ → model_files.created_by_job_id → file_name
 * - 推定:   result ジョブ → data_set_results.job_id → title
 */
type Params = {
  normalizationJobId: number | null;
  modelJobId: number | null;
  evaluationJobId: number | null;
};

const normalizationName = (jobId: number): string | null => {
  const row = db
    .select({ name: normalized_data_sets.file_name })
    .from(normalized_data_sets)
    .innerJoin(
      job_results,
      eq(normalized_data_sets.job_results_id, job_results.id),
    )
    .where(eq(job_results.job_id, jobId))
    .orderBy(desc(normalized_data_sets.id))
    .get();
  return row?.name ?? null;
};

const modelName = (jobId: number): string | null => {
  const row = db
    .select({ name: model_files.file_name })
    .from(model_files)
    .where(eq(model_files.created_by_job_id, jobId))
    .orderBy(desc(model_files.id))
    .get();
  return row?.name ?? null;
};

const evaluationName = (jobId: number): string | null => {
  const row = db
    .select({ name: data_set_results.title })
    .from(data_set_results)
    .where(eq(data_set_results.job_id, jobId))
    .orderBy(desc(data_set_results.id))
    .get();
  return row?.name ?? null;
};

export const selectGuideNames = (async (
  _: unknown,
  { normalizationJobId, modelJobId, evaluationJobId }: Params,
): Promise<GuideNames> => ({
  normalization:
    normalizationJobId != null ? normalizationName(normalizationJobId) : null,
  model: modelJobId != null ? modelName(modelJobId) : null,
  evaluation: evaluationJobId != null ? evaluationName(evaluationJobId) : null,
})) satisfies IpcMainListener;
