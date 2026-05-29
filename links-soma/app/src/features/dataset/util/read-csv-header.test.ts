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
});
