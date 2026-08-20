import { describe, expect, it } from "vitest";
import {
  BIN_COUNT,
  binLabel,
  toProbabilityBinRows,
  type ProbabilityBin,
} from "./probability-bins";

/** 10%刻み・全帯そろった集計を、件数を差し替えながら組み立てる */
const bins = (counts: number[]): ProbabilityBin[] =>
  counts.map((count, index) => ({
    upperPercent: (index + 1) * (100 / BIN_COUNT),
    count,
  }));

describe("binLabel", () => {
  it("上限のみを示すラベルを返す", () => {
    expect(binLabel(10)).toBe("～10%");
    expect(binLabel(100)).toBe("～100%");
  });
});

describe("toProbabilityBinRows", () => {
  it("件数と割合を併記する", () => {
    const rows = toProbabilityBinRows(bins([75, 25, 0, 0, 0, 0, 0, 0, 0, 0]));

    expect(rows[0]).toEqual(["～10%", "75件（75.0%）"]);
    expect(rows[1]).toEqual(["～20%", "25件（25.0%）"]);
  });

  it("件数が0の帯も残す。分布の形は空の帯を含めて読むため", () => {
    const rows = toProbabilityBinRows(bins([100, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

    expect(rows).toHaveLength(BIN_COUNT);
    expect(rows[9]).toEqual(["～100%", "0件（0.0%）"]);
  });

  it("割合の合計が100%になる", () => {
    const rows = toProbabilityBinRows(bins([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]));

    const sum = rows.reduce(
      (acc, [, value]) => acc + Number.parseFloat(value.split("（")[1]),
      0,
    );
    expect(sum).toBeCloseTo(100, 5);
  });

  it("4桁以上の件数は桁区切りする", () => {
    const rows = toProbabilityBinRows(bins([42103, 0, 0, 0, 0, 0, 0, 0, 0, 0]));

    expect(rows[0][1]).toBe("42,103件（100.0%）");
  });

  it("集計対象が0件なら行を返さない。空のセクションを出さないため", () => {
    expect(toProbabilityBinRows(bins([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toEqual(
      [],
    );
    expect(toProbabilityBinRows([])).toEqual([]);
  });
});
