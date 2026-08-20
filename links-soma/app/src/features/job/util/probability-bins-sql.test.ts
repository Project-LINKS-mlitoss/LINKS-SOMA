/**
 * 確率帯を数える SQL の境界を検証する。
 *
 * 帯の抜け・重なり・取りこぼしは実データでしか気付きにくいうえ、リポジトリの
 * better-sqlite3 は Electron 向けにビルドされていて Node からロードできない。
 * そこで drizzle が生成した SQL 文とパラメータを直接読み、境界の並びを確かめる。
 */

import { drizzle } from "drizzle-orm/sqlite-proxy";
import { describe, expect, it } from "vitest";
import { data_set_detail_buildings } from "../../../db/schema";
import {
  BIN_COUNT,
  binCountSelection,
  binUpperPercents,
} from "./probability-bins";

/**
 * 集計クエリの SQL 文とパラメータ。
 * SQL を組み立てるだけで実行しないため、ネイティブモジュールを要さない
 * sqlite-proxy ドライバを使う（better-sqlite3 は Electron 向けビルドで読めない）。
 */
const query = (): { sql: string; params: unknown[] } =>
  drizzle(async () => ({ rows: [] }))
    .select(binCountSelection())
    .from(data_set_detail_buildings)
    .toSQL();

describe("binUpperPercents", () => {
  it("10%刻みで100%まで並べる", () => {
    expect(binUpperPercents()).toEqual([
      10, 20, 30, 40, 50, 60, 70, 80, 90, 100,
    ]);
  });

  it("最後の上限は必ず100。確率100%の建物を取りこぼさないため", () => {
    expect(binUpperPercents().at(-1)).toBe(100);
  });

  it("上限は重複せず単調増加する", () => {
    const percents = binUpperPercents();

    expect(new Set(percents).size).toBe(percents.length);
    expect([...percents].sort((a, b) => a - b)).toEqual(percents);
  });
});

describe("binCountSelection", () => {
  it("帯の本数ぶんの列を返す", () => {
    expect(Object.keys(binCountSelection())).toHaveLength(BIN_COUNT);
  });

  it("境界値を下側の帯に入れる。判定が「しきい値を超えたら空き家」のため", () => {
    // 2本目以降は「下限を超え、上限以下」。境界がどちらの帯に属すかを式で確かめる
    const column = '"data_set_detail_buildings"."predicted_probability"';
    expect(query().sql).toContain(`${column} > ? and ${column} <= ?`);
  });

  it("最初の帯だけ下限を持たない。確率0を取りこぼさないため", () => {
    const firstBin = Object.keys(binCountSelection())[0];

    expect(firstBin).toBe("bin10");
    // 下限つきの比較は BIN_COUNT-1 本ぶんだけ現れる
    const lowerBoundCount = query().sql.split("> ?").length - 1;
    expect(lowerBoundCount).toBe(BIN_COUNT - 1);
  });

  it("境界は隙間なく連続する。どの確率もいずれか1本の帯に入るため", () => {
    // パラメータは帯の順に [上限] [下限, 上限] [下限, 上限] … と並ぶ
    const params = query().params as number[];
    expect(params).toEqual([
      0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.4, 0.4, 0.5, 0.5, 0.6, 0.6, 0.7, 0.7, 0.8,
      0.8, 0.9, 0.9, 1,
    ]);
  });
});
