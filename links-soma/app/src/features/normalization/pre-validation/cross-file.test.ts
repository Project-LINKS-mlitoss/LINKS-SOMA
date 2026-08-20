import { describe, expect } from "vitest";
import { referenceIntegrity, resolveReferences } from "./cross-file";
import type { SampleColumn } from "./types";

const sampled = (values: string[]): SampleColumn => ({
  values,
  truncated: true,
});
const full = (values: string[]): SampleColumn => ({
  values,
  truncated: false,
});

describe("referenceIntegrity（片側性: issue 側を確定）", (it) => {
  const parent = new Set(["A001", "A002", "A003"]);

  it("子サンプルに親へ無い値があれば issue を確定する", () => {
    expect(referenceIntegrity(sampled(["A001", "X999"]), parent).status).toBe(
      "issue",
    );
  });

  it("子サンプルが全件親に在り打ち切りなら unknown（事後へ委ねる）", () => {
    expect(referenceIntegrity(sampled(["A001", "A002"]), parent).status).toBe(
      "unknown",
    );
  });

  it("子が全件読了で全件親に在れば clear を確定する", () => {
    expect(referenceIntegrity(full(["A001", "A002"]), parent).status).toBe(
      "clear",
    );
  });

  it("空文字は欠損観点の責務なので参照判定から除外する", () => {
    expect(referenceIntegrity(full(["A001", ""]), parent).status).toBe("clear");
  });

  it("親キーが空なら検証不能で unknown（全件 issue の偽陽性を避ける）", () => {
    expect(referenceIntegrity(full(["A001"]), new Set()).status).toBe(
      "unknown",
    );
  });
});

describe("resolveReferences（フォーム状態→具体値の解決）", (it) => {
  const data = {
    water_status: {
      path: "水道開閉栓状況.csv",
      columns: { water_supply_number: "水道番号" },
    },
    water_usage: {
      path: "水道使用量.csv",
      columns: { water_supply_number: "給水番号" },
    },
  };

  it("子・親の実カラムとファイル名を解決する", () => {
    expect(resolveReferences("water_usage", data)).toEqual([
      {
        parentFilename: "水道開閉栓状況.csv",
        parentColumn: "水道番号",
        childColumn: "給水番号",
        impact: "continue",
      },
    ]);
  });

  it("親ファイル未選択なら参照を捨てる（事後に委ねる）", () => {
    const noParent = { ...data, water_status: { path: "", columns: {} } };
    expect(resolveReferences("water_usage", noParent)).toEqual([]);
  });

  it("参照を持たないデータセットは空配列", () => {
    expect(resolveReferences("geocoding", data)).toEqual([]);
  });
});
