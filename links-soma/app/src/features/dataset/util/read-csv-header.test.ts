import { join } from "path";
import { describe, expect } from "vitest";
import { readCSVHeaders } from "./read-csv-headers";

describe("read-csv-header", (it) => {
  it("should read the header of a CSV file", async () => {
    const header = await readCSVHeaders(
      join(import.meta.dirname, "sample.csv"),
    );
    expect(header).toEqual([
      " ヘッダー1",
      "ヘッダー2",
      "ヘッダー    3",
      "ヘッダー4  ",
    ]);
  });

  // 検証情報の追加カラム取得は、削除済みデータセットのパスを渡しうる。
  // reject でなく未処理の error イベントになると、呼び出し側では捕捉できず落ちる
  it("rejects when the file does not exist", async () => {
    await expect(
      readCSVHeaders(join(import.meta.dirname, "no-such-file.csv")),
    ).rejects.toThrow();
  });
});
