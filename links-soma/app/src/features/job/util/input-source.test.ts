import { describe, expect, it } from "vitest";
import { formatInputSource } from "./input-source";

describe("formatInputSource", () => {
  it("1本の文字列はそのまま返す。Python が書き込む通常の形", () => {
    expect(
      formatInputSource(
        "「水道閉開栓状況」に「住民基本台帳」を住所で結合（A）",
      ),
    ).toBe("「水道閉開栓状況」に「住民基本台帳」を住所で結合（A）");
  });

  it("配列は1行へ畳む。型が配列も許すため", () => {
    expect(formatInputSource(["水道閉開栓状況", "住民基本台帳"])).toBe(
      "水道閉開栓状況, 住民基本台帳",
    );
  });

  it("結合元が無ければ空文字を返す。呼び出し側が括弧書きの有無を空文字で判定するため", () => {
    expect(formatInputSource(undefined)).toBe("");
    expect(formatInputSource(null)).toBe("");
    expect(formatInputSource("")).toBe("");
    expect(formatInputSource([])).toBe("");
  });
});
