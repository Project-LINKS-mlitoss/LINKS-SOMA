import { expect, describe, it } from "vitest";
import { formatDate } from "./format-date";

describe("formatDataのバリデーションテスト", () => {
  const validISO8601String = "2021-01-01T00:00:00.000";
  const invalidISO8601String = "2021:01:01T00:00:00:000";

  const validTimestamp = "2021-01-01 00:00:00";

  const obviouslyInvalidDateString = "abcdefg";

  const validOnlyDate = "2021-01-01";

  it("ISO8601形式（タイムゾーン無）パターンの時正しくパースされる", () => {
    expect(formatDate(validISO8601String)).toBe("2021/01/01 00:00:00");
  });
  it("微妙に間違っているISO8601形式の場合正しくパースされない", () => {
    expect(formatDate(invalidISO8601String)).toBe("");
  });
  it("SQLiteのタイムスタンプが正しくフォーマットされる", () => {
    expect(formatDate(validTimestamp)).toBe("2021/01/01 00:00:00");
  });
  it("不正な日付文字列が入力された場合、空文字列が返される", () => {
    expect(formatDate(obviouslyInvalidDateString)).toBe("");
  });
  it("日付のみの場合、正しくフォーマットされる", () => {
    expect(formatDate(validOnlyDate)).toBe("2021/01/01 00:00:00");
  });

  it("フォーマット文字列に従って、正しくフォーマットされる", () => {
    expect(formatDate(validOnlyDate, "YYYY/MM/DD")).toBe("2021/01/01");
  });
});
