import { describe, expect } from "vitest";
import { isLikelyNonUtf8Bytes } from "./is-likely-non-utf8-bytes";

describe("isLikelyNonUtf8Bytes（PV-01 バイト列版）", (it) => {
  it("UTF-8 の日本語は false（読める）", () => {
    const bytes = new TextEncoder().encode("住所,東京都\n");
    expect(isLikelyNonUtf8Bytes(bytes)).toBe(false);
  });

  it("ASCII は false（読める）", () => {
    const bytes = new TextEncoder().encode("address,name\n");
    expect(isLikelyNonUtf8Bytes(bytes)).toBe(false);
  });

  it("Shift_JIS のバイト列は true（読めない）", () => {
    // 「東京」の Shift_JIS バイト列。UTF-8 としては不正。
    const bytes = new Uint8Array([0x93, 0x8c, 0x8b, 0x9e]);
    expect(isLikelyNonUtf8Bytes(bytes)).toBe(true);
  });

  it("空バイト列は false（不正なし）", () => {
    expect(isLikelyNonUtf8Bytes(new Uint8Array([]))).toBe(false);
  });

  it("先頭 MAX_BYTES だけ slice された大きいファイルの末尾で多バイト文字が割れても false（偽陽性回避）", () => {
    // 呼び出し側は file.slice(0, MAX_BYTES) を渡すため、長さがちょうど MAX_BYTES の
    // バッファは「より大きいファイルの先頭」であり得る。末尾が 3バイト文字の先頭バイト
    // （未完）で終わっても、切り詰めとみなして flush せず不正判定しない。
    const MAX_BYTES = 64 * 1024;
    const bytes = new Uint8Array(MAX_BYTES).fill(0x61); // ASCII 'a'
    bytes[MAX_BYTES - 1] = 0xe6; // 3バイト UTF-8 シーケンスの先頭バイト（以降が切れている）
    expect(isLikelyNonUtf8Bytes(bytes)).toBe(false);
  });
});
