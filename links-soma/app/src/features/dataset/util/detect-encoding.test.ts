import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, describe, expect } from "vitest";
import { isLikelyNonUtf8 } from "./detect-encoding";

let dir: string;

const write = (name: string, bytes: Buffer): string => {
  const path = join(dir, name);
  writeFileSync(path, bytes);
  return path;
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "enc-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("isLikelyNonUtf8（文字コード判定・PV-01）", (it) => {
  it("UTF-8の日本語CSVは false（誤検出しない）", async () => {
    const p = write(
      "utf8.csv",
      Buffer.from("水道番号,開栓日\nA001,2022-04-11\n", "utf-8"),
    );
    expect(await isLikelyNonUtf8(p)).toBe(false);
  });

  it("Shift_JISのバイト列は true（非UTF-8を確定）", async () => {
    // 「東京」の Shift_JIS バイト列。UTF-8 としては不正シーケンス。
    const sjis = Buffer.from([0x93, 0x8c, 0x8b, 0x9e, 0x0a]);
    const p = write("sjis.csv", sjis);
    expect(await isLikelyNonUtf8(p)).toBe(true);
  });

  it("ASCIIのみは false", async () => {
    const p = write(
      "ascii.csv",
      Buffer.from("id,date\n1,2020-01-01\n", "utf-8"),
    );
    expect(await isLikelyNonUtf8(p)).toBe(false);
  });
});
