import { join } from "path";
import { assert, describe, expect } from "vitest";
import { readShpAttributes } from "./read-shp-attributes";

describe("read-shp-attributes", (it) => {
  it("should read the attributes of a SHP file", async () => {
    const path = join(import.meta.dirname, "sample.zip");
    const attributes = await readShpAttributes(path);

    expect(attributes).toEqual([
      "N03_001",
      "N03_002",
      "N03_003",
      "N03_004",
      "N03_005",
      "N03_007",
    ]);
  });
});
