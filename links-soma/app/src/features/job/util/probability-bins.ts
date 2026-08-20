/**
 * 空き家推定確率の確率帯集計（#1987）。
 *
 * 検証情報ダウンロードにのみ含める集計で、処理結果画面には表示しない。
 * 帯は「上限以下」で区切る（`～10%` は 0 以上 10% 以下）。空き家判定が
 * `確率 > しきい値` の「超えたら陽性」であることに合わせ、境界値は下側の帯に入れる。
 */

import { sql } from "drizzle-orm";
import { data_set_detail_buildings } from "../../../db/schema";

/** 確率帯1本の集計結果。upperPercent=10 は「～10%」を表す */
export type ProbabilityBin = {
  /** 帯の上限（%） */
  upperPercent: number;
  /** その帯に入った建物の件数 */
  count: number;
};

/** 確率帯の区切り幅（%）。ここを変えれば帯の本数が変わる */
export const BIN_WIDTH_PERCENT = 10;

/** 帯の表示ラベル。上限のみを示す（例: `～10%`） */
export const binLabel = (upperPercent: number): string => `～${upperPercent}%`;

/**
 * 帯の上限（%）を若い順に並べたもの。10%刻みなら 10, 20, …, 100。
 *
 * 最後の帯の上限は刻み幅の倍数でなく必ず 100 にする。100 を割り切れない刻み幅
 * （3% など）でも確率100%の建物を取りこぼさないため。3%刻みなら最後は 99% でなく
 * 100% の帯になり、99% 超の建物がそこに入る。
 */
export const binUpperPercents = (): number[] => {
  const percents: number[] = [];
  for (let upper = BIN_WIDTH_PERCENT; upper < 100; upper += BIN_WIDTH_PERCENT) {
    percents.push(upper);
  }
  percents.push(100);
  return percents;
};

/** 確率帯の本数 */
export const BIN_COUNT = binUpperPercents().length;

/**
 * 帯ごとの件数を数える SELECT 句。帯1本につき1列を返す。
 *
 * 帯番号を計算で求めず、境界の比較をそのまま書く。「上限以下」という帯の定義が
 * 式から直接読め、切り上げの丸めや浮動小数の補正を挟まずに済むため。
 * 下限を除外・上限を含めるのは、空き家判定が `確率 > しきい値` の
 * 「超えたら陽性」であることに合わせ、境界値を下側の帯へ入れるため。
 */
export const binCountSelection = (): Record<
  string,
  ReturnType<typeof sql<number>>
> => {
  const column = data_set_detail_buildings.predicted_probability;
  const selection: Record<string, ReturnType<typeof sql<number>>> = {};
  const upperPercents = binUpperPercents();

  upperPercents.forEach((upperPercent, index) => {
    const upper = upperPercent / 100;
    // 下限は前の帯の上限。刻み幅から引かないのは、最後の帯だけ上限が 100 に
    // 丸められる場合（100 を割り切れない刻み幅）に隙間ができるのを防ぐため
    const withinBin =
      index === 0
        ? // 最初の帯だけ下限を持たない。確率0を取りこぼさないため
          sql`${column} <= ${upper}`
        : sql`${column} > ${upperPercents[index - 1] / 100} and ${column} <= ${upper}`;
    selection[`bin${upperPercent}`] =
      sql<number>`sum(case when ${withinBin} then 1 else 0 end)`;
  });

  return selection;
};

/**
 * 集計結果を検証情報ダウンロードの行（ラベル・値）へ整形する。
 *
 * 割合の分母は全帯の合計。推定結果件数ではなく合計を使うのは、確率が
 * 記録されていない建物を集計から除いているため（分母がずれると合計が 100% にならない）。
 * 件数が 0 の帯も残す。帯ごとの分布の形は、空いている帯も含めて初めて読める。
 */
export const toProbabilityBinRows = (
  bins: ProbabilityBin[],
): [string, string][] => {
  const total = bins.reduce((sum, bin) => sum + bin.count, 0);
  if (total === 0) return [];

  return bins.map((bin) => {
    const percent = ((bin.count / total) * 100).toFixed(1);
    return [
      binLabel(bin.upperPercent),
      `${bin.count.toLocaleString()}件（${percent}%）`,
    ];
  });
};
