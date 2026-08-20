import { describe, expect } from "vitest";
import { runRules } from "./engine";
import type { Rule, SampleColumn } from "./types";

const sample = (values: string[], truncated = true): SampleColumn => ({
  values,
  truncated,
});

describe("runRules（ルール駆動ディスパッチ）", (it) => {
  it("aspect で対応する検出器に振り分ける", () => {
    const rules: Rule[] = [
      { dataset: "water_status", column: "水道番号", aspect: "uniqueness" },
    ];
    const [res] = runRules(rules, () => sample(["1", "1"]));
    expect(res.verdict.status).toBe("issue");
  });

  it("対象カラムを取得できなければ unknown（事後へ委ねる）", () => {
    const rules: Rule[] = [{ dataset: "x", aspect: "uniqueness" }];
    const [res] = runRules(rules, () => null);
    expect(res.verdict.status).toBe("unknown");
  });

  it("ルールの件数と順序を保つ", () => {
    const rules: Rule[] = [
      { dataset: "a", aspect: "uniqueness" },
      { dataset: "b", aspect: "date_format" },
    ];
    const results = runRules(rules, () => sample(["2024-01-01", "2025-06-01"]));
    expect(results.map((r) => r.rule.dataset)).toEqual(["a", "b"]);
  });
});
