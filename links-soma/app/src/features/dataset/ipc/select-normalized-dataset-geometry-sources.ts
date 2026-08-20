import { inArray, eq } from "drizzle-orm";
import { normalized_data_sets, job_results, jobs } from "../../../db/schema";
import { db } from "../../../db/client";
import { type IpcMainListener } from "../../../ipc-main-listeners";

/**
 * 名寄せデータが地域集計に使える建物ジオメトリを持つか判定する（issue #1924）。
 *
 * 地域集計（E032）は建物ジオメトリを地域ポリゴンへ空間結合する。建物ジオメトリは名寄せの
 * 空間結合（E016）で付与されるが、E016 は **ジオコーディングが無いと丸ごとスキップされる**
 * （IF001.py: `if has_geocoding:`）。建物ポリゴンは E016 内でしか使われないため、ジオコーディングが
 * 無ければ建物ポリゴンを渡しても geometry は付かない。よって地域集計の可否はジオコーディングの
 * 有無だけで決まる。使っていない名寄せデータでは推定画面で地域集計フォームを出さない。
 *
 * 判定は名寄せジョブのパラメータ（normalized_data_sets → job_results → jobs.parameters）を辿る。
 * アップロードで直接入った名寄せデータは job_results_id が無く判定できない。その場合 determinable=false
 * を返し、UI 側は安全側（表示）に倒す。
 */
export type NormalizedDatasetGeometrySource = {
  path: string;
  /** 名寄せジョブのパラメータを辿れて判定できたか */
  determinable: boolean;
  /** ジオコーディングを使用したか（地域集計に必要な建物ジオメトリの唯一の源。determinable=false のとき無意味） */
  hasGeocoding: boolean;
};

/** データソースが実際に使われたか（job-parameters-section:560 の慣習に一致） */
const isUsed = (entry?: { id: number; path: string }): boolean =>
  Boolean(entry && entry.id !== 0 && entry.path);

export const selectNormalizedDatasetGeometrySources = (async (
  _: unknown,
  { paths }: { paths: string[] },
): Promise<NormalizedDatasetGeometrySource[]> => {
  if (!paths || paths.length === 0) return [];

  const rows = await db
    .select({
      path: normalized_data_sets.file_path,
      parameters: jobs.parameters,
    })
    .from(normalized_data_sets)
    .leftJoin(
      job_results,
      eq(job_results.id, normalized_data_sets.job_results_id),
    )
    .leftJoin(jobs, eq(jobs.id, job_results.job_id))
    .where(inArray(normalized_data_sets.file_path, paths));

  return rows.map((row) => {
    const params = row.parameters;
    // preprocess（名寄せ）以外・パラメータ欠落（アップロード直挿し等）は判定不能
    if (!params || params.parameterType !== "preprocess") {
      return { path: row.path, determinable: false, hasGeocoding: false };
    }
    // ジオコーディングのみが建物ジオメトリの源。建物ポリゴンは E016 内でしか使われず、
    // ジオコーディングが無いと E016 がスキップされるため単独では geometry を生まない。
    return {
      path: row.path,
      determinable: true,
      hasGeocoding: isUsed(params.data.geocoding),
    };
  });
}) satisfies IpcMainListener;
