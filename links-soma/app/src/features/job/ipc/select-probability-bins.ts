import { and, eq, isNotNull } from "drizzle-orm";
import { data_set_detail_buildings } from "../../../db/schema";
import { db } from "../../../db/client";
import { mainProcessLogger } from "../../../shared/utils/main-process-logger";
import { type IpcMainListener } from "../../../ipc-main-listeners";
import {
  binCountSelection,
  binUpperPercents,
  type ProbabilityBin,
} from "../util/probability-bins";

/**
 * 建物単位の推定結果を確率帯ごとに集計する（#1987）。検証情報ダウンロードに含める。
 *
 * 帯1本を1列として1行にまとめて数える。確率が記録されていない建物は集計から除き、
 * 対象が0件なら空配列を返す（呼び出し側でセクションごと出さないため）。
 */
export const selectProbabilityBins = ((
  _: unknown,
  { dataSetResultId }: { dataSetResultId: number },
): ProbabilityBin[] => {
  try {
    const row = db
      .select(binCountSelection())
      .from(data_set_detail_buildings)
      .where(
        and(
          eq(data_set_detail_buildings.data_set_result_id, dataSetResultId),
          isNotNull(data_set_detail_buildings.predicted_probability),
        ),
      )
      .get();

    if (!row) return [];

    const bins = binUpperPercents().map((upperPercent) => ({
      upperPercent,
      count: Number(row[`bin${upperPercent}`] ?? 0),
    }));

    return bins.some((bin) => bin.count > 0) ? bins : [];
  } catch (error) {
    // 空配列を返さず送出する。空配列は「確率が未記録」と区別がつかず、
    // 一時的なDB競合で確率帯セクションが黙って消えるため
    mainProcessLogger.error(
      `Error in selectProbabilityBins - dataSetResultId: ${dataSetResultId}`,
      error as Error,
    );
    throw error;
  }
}) satisfies IpcMainListener;
