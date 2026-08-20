import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, describe, expect } from "vitest";
import { sampleCSVColumn } from "./sample-csv-column";

let dir: string;

const writeCsv = (content: string): string => {
  const path = join(dir, `${content.length}.csv`);
  writeFileSync(path, content, "utf-8");
  return path;
};

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "pv-sample-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("sampleCSVColumn（先頭N行サンプリング）", (it) => {
  it("sampleSize を超える行があれば打ち切り truncated=true", async () => {
    const path = writeCsv("id\n1\n2\n3\n");
    const result = await sampleCSVColumn(path, "id", 2);
    expect(result).toEqual({ values: ["1", "2"], truncated: true });
  });

  it("全データ行が sampleSize 以下なら全件読了 truncated=false", async () => {
    const path = writeCsv("id\nA\nB\n");
    const result = await sampleCSVColumn(path, "id", 5);
    expect(result).toEqual({ values: ["A", "B"], truncated: false });
  });

  it("出現順と空文字を保つ", async () => {
    const path = writeCsv("id,name\n1,x\n2,\n3,y\n");
    const result = await sampleCSVColumn(path, "name", 5);
    expect(result?.values).toEqual(["x", "", "y"]);
  });

  it("対象カラムが無ければ null（エンジンが unknown 化）", async () => {
    const path = writeCsv("id\n1\n");
    const result = await sampleCSVColumn(path, "missing", 5);
    expect(result).toBeNull();
  });

  it("BOM付きCSVでもヘッダーを正しく解決する（実フィクスチャ相当）", async () => {
    const path = writeCsv("﻿水道番号\nA001\nA001\n");
    const result = await sampleCSVColumn(path, "水道番号", 5);
    expect(result?.values).toEqual(["A001", "A001"]);
  });
});
