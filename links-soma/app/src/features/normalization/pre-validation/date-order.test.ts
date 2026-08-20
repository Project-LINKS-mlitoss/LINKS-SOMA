import { describe, expect } from "vitest";
import { dateOrder } from "./date-order";
import type { SampleColumn } from "./types";

const sampled = (values: string[]): SampleColumn => ({
  values,
  truncated: true,
});
const full = (values: string[]): SampleColumn => ({
  values,
  truncated: false,
});

describe("dateOrder（前後関係・操作補助・PV-10）", (it) => {
  it("同一行で earlier > later（逆転）があれば issue", () => {
    const v = dateOrder(full(["20230101"]), full(["20220101"]));
    expect(v.status).toBe("issue");
  });

  it("issue は両値を文言キーで返す（文章化は画面側 lang.ts）", () => {
    expect(dateOrder(full(["20230101"]), full(["20220101"])).message).toEqual({
      key: "dateOrderReversed",
      params: { earlier: "20230101", later: "20220101" },
    });
  });

  it("形式混在（yyyy-mm-dd と yyyymmdd）でも正規化して比較する", () => {
    expect(dateOrder(full(["2023-01-01"]), full(["20220101"])).status).toBe(
      "issue",
    );
  });

  it("順序が正しく全件読了なら clear", () => {
    expect(dateOrder(full(["20220101"]), full(["20230101"])).status).toBe(
      "clear",
    );
  });

  it("比較できない行（欠損・和暦）は飛ばす（逆転扱いしない）", () => {
    // 開栓のみ欠損 / 和暦は比較対象外。逆転は無いので clear。
    const earlier = full(["", "令和5年4月1日", "20220101"]);
    const later = full(["20220101", "20230101", "20230101"]);
    expect(dateOrder(earlier, later).status).toBe("clear");
  });

  it("逆転なしでも打ち切りなら unknown（事後へ委ねる）", () => {
    expect(dateOrder(sampled(["20220101"]), sampled(["20230101"])).status).toBe(
      "unknown",
    );
  });
});
