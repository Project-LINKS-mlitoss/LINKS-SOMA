import { describe, expect } from "vitest";
import { encodingVerdict } from "./encoding";

describe("encodingVerdict（文字コード・PV-01）", (it) => {
  it("非UTF-8なら issue（文言キーを返す・文章化は画面側 lang.ts）", () => {
    expect(encodingVerdict(true)).toEqual({
      status: "issue",
      message: { key: "encodingNotUtf8" },
    });
  });

  it("UTF-8なら clear", () => {
    expect(encodingVerdict(false).status).toBe("clear");
  });
});
