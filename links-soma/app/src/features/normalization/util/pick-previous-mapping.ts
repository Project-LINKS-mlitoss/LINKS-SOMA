import { type SelectJob } from "../../../db/schema";
import { type PreprocessParameters } from "../../../shared/types/job-parameters";

/**
 * 「前回のカラム設定を適用」提案に使う、過去ジョブから抽出したマッピング。
 */
export type PreviousMapping = {
  /** 提案元ジョブの ID（複製元の同定・ログ用） */
  jobId: SelectJob["id"];
  /** 提案元ジョブの実行日時。バナーの「前回(◯◯)」メタ表示に使う */
  createdAt: SelectJob["created_at"];
  /** データセット別カラムマッピング。form へのプリフィル素材 */
  data: PreprocessParameters["data"];
};

/** データセット単位のカラムマッピング（カラム種別 → 元ファイルのカラム名） */
export type ColumnMap = Record<string, string | undefined>;

/** columns に1つでも非空値があるか（単一データセットのマッピング判定） */
export const hasNonEmptyColumnMap = (columns: ColumnMap): boolean =>
  Object.values(columns).some(
    (value) => typeof value === "string" && value.length > 0,
  );

/**
 * 過去の preprocess ジョブのうち、カラムマッピングが1つでも設定済みか判定する。
 * data.{schemaKey}.columns のいずれかに空でない値があれば true。
 */
export const hasAnyColumnMapping = (
  data: PreprocessParameters["data"],
): boolean =>
  Object.values(data).some(
    (dataset) =>
      dataset != null &&
      "columns" in dataset &&
      dataset.columns != null &&
      hasNonEmptyColumnMap(dataset.columns),
  );

/**
 * 過去の名寄せジョブ一覧から「前回のカラム設定を適用」提案に使う 1 件を選ぶ純粋関数。
 *
 * 選定基準:
 * - status="complete" のジョブのみ対象。「前回うまく通った対応づけ」だけを提案する。
 *   error の復旧は job 詳細の「再実行へ」導線（同一ファイル全再現）が責務を持つため除外。
 *   "draft"（編集中・1件制限）・実行中("")・null も除外。
 * - カラムマッピングが 1 件も無いジョブは押しても無意味なため除外（hasAnyColumnMapping）。
 * - 複数該当時は created_at 降順の先頭（最新）。
 *
 * 返すのは「直近の complete ジョブ 1 件」であって、データセット別に直近を探すのではない。
 * よって直近ジョブに無いデータセットは、より古いジョブが設定を持っていても提案されない
 * （= 前回の対応づけを丸ごと引き継ぐ意図的なスコープ）。
 *
 * 適用は呼び出し側がデータセット単位で行う。直近ジョブが設定を持つデータセットだけ埋まり、
 * 持たないデータセットは空のまま残る（こちらの判断で除外はしない）。
 *
 * @param jobs selectJobs({ type: "preprocess" }) の結果。created_at 降順ソート済み
 *             （useFetchJobs(undefined, "preprocess") 経由で渡る）。
 * @param excludeJobId 現在編集中の下書きジョブ ID。自分自身を提案候補から除外する（任意）。
 * @returns 適用候補のマッピング。提案に値する過去ジョブが無ければ null
 */
export const pickPreviousMapping = (
  jobs: SelectJob[],
  excludeJobId?: SelectJob["id"],
): PreviousMapping | null => {
  for (const job of jobs) {
    if (job.id === excludeJobId) continue;
    if (job.status !== "complete") continue;
    if (job.parameters.parameterType !== "preprocess") continue;
    if (!hasAnyColumnMapping(job.parameters.data)) continue;

    return {
      jobId: job.id,
      createdAt: job.created_at,
      data: job.parameters.data,
    };
  }
  return null;
};
